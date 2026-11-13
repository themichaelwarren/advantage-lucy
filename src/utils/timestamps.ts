import type { Song } from '../types';
import { normalize } from './text';
import { hira } from './songTitles';
import { parseTypedTime } from './youtube';

/**
 * A setlist pasted from a YouTube description or a setlist website, one
 * song a line, in any of the usual shapes:
 *   0:00 Hello mate!        1. シトラス 4:12        05:30 - May
 *   [12:01] メトロ           1:02:03 / 風にあずけて    M3 グッバイ (8:45)
 *   01. シトラス（新曲）     EN1. 地球               setlist.fm's "Song Play Video"
 * Lines without a time are still songs. Headings start a new set:
 * "Encore" / "アンコール" / "EN" → the encore ('e', then 'e2'…), "Set 2" /
 * "2部" / "第二部" → set 2; "EN1." in front of a song puts it in the encore.
 * A whole setlist on one line ("シトラス / めまい / 地球") is split up.
 * Notes after a title ("（新曲）", "※初披露", "(cover)") go to the row's
 * notes. Lines that are only a time, a date (the show's own heading) or
 * talk ("MC", "SE") are skipped.
 */
export interface PastedSong { title: string; start: number | null; set: string; note: string }

const TIME = /(?:^|[\s[(（【|])(\d{1,2}:\d{2}(?::\d{2})?)(?=$|[\s\])）】|,、.\-–—])/;
// Not songs: headings, talk, sound effects, breaks ("Setlist:", "MC 2", "Opening SE", "転換")
const SKIP = /^(?:set ?list|セットリスト|セトリ|songs?|曲目|tracklist|start|end|break|休憩|転換|入場|退場|挨拶|チューニング|tuning|talk|トーク|(?:opening|ending|intro|outro|オープニング|エンディング)?\s*(?:se|bgm|sound ?check)?|mc\s*\d*|(?:opening|ending|intro|outro|オープニング|エンディング))\s*[:：]?$/i;
// "Encore", "アンコール", "EN", "Encore 2", "W アンコール", "ダブルアンコール"
const ENCORE = /^(?:w\s*|ダブル\s*)?(?:encore|アンコール|en|e\.n\.?)\s*(\d?)\s*[:：.]?$/i;
// "Set 2", "2nd set", "2部", "第2部", "第二部", "本編" (= set 1)
const SET = /^(?:set\s*(\d)|(\d)(?:st|nd|rd|th)\s*set|第?\s*([1-9一二三])\s*部|本編)\s*[:：]?$/i;
// "EN1. 地球", "E2 May", "Encore 1: …" in front of a song
const EN_PREFIX = /^(?:en|e|encore)\s*(\d{1,2})?\s*[.)．、:：\-–—]\s*|^(?:en|encore)(\d{1,2})\s+/i;
// A note after the title: （新曲）, (cover), [new song], ※…
const NOTE = /\s*(?:[(（[【]\s*((?:[^)）\]】]*?(?:新曲|初披露|初演奏|未発表|cover|カバー|new|acoustic|アコースティック|弾き語り|ver\.?|version|remix|short|short ver|一部|メドレー|medley)[^)）\]】]*?))\s*[)）\]】]|※\s*(.+))\s*$/i;
const KANJI_NUM: Record<string, string> = { 一: '1', 二: '2', 三: '3' };

export function parseTimestamps(text: string): PastedSong[] {
  const out: PastedSong[] = [];
  let set = '1';
  let encores = 0;
  const encoreSet = (n?: string) => {
    const k = n ? Number(n) : encores + 1;
    encores = Math.max(encores, k);
    return k <= 1 ? 'e' : `e${k}`;
  };
  // A whole setlist on one line: "シトラス / めまい / 地球"
  const lines = text.split(/\r?\n/).flatMap(l => {
    const parts = l.split(/\s+[/／→>]\s+|\s*／\s*|\s*→\s*/).map(x => x.trim()).filter(Boolean);
    return parts.length >= 3 && !TIME.test(l) ? parts : [l];
  });
  for (const raw of lines) {
    let line = raw.trim().replace(/\s*Play Video\s*$/i, '');
    if (!line) continue;
    // Headings that start a set ("Encore:", "-encore-", "【アンコール】")
    const bare = line.replace(/^[-–—•・#*=~〜\s<[【(（]+|[-–—•・#*=~〜\s>\]】)）]+$/g, '');
    const en = bare.match(ENCORE);
    if (en) { set = encoreSet(en[1]); continue; }
    const st = bare.match(SET);
    if (st) { set = st[1] || st[2] || KANJI_NUM[st[3]] || st[3] || '1'; continue; }
    // The show's own heading ("2003.10.11 渋谷nest"): not a song
    if (/\b\d{4}\s*[./年-]\s*\d{1,2}\s*[./月-]\s*\d{1,2}/.test(line)) continue;
    const m = line.match(TIME);
    const start = m ? parseTypedTime(m[1]) : null;
    // Take the time out along with any brackets around it: "[12:01]", "(16:30)"
    if (m) line = line.replace(new RegExp(`[[(（【]?\\s*${m[1]}\\s*[\\])）】]?`), ' ').trim();
    // "EN1. 地球": this song is in an encore
    let songSet = set;
    const ep = line.match(EN_PREFIX);
    // (the number is the song's place in the encore: EN1, EN2… all go in the same one)
    if (ep && line.length > ep[0].length) { if (!set.startsWith('e')) set = encoreSet(); songSet = set; line = line.slice(ep[0].length); }
    // Numbering, bullets and separators around the title
    line = line
      .replace(/^(?:(?:M|#|No\.?)\s*\d{1,2}\b\s*[.)．、:：\-–—]?|\d{1,2}\s*[.)．、:：\-–—])\s*/i, '')
      .replace(/^[-–—•・|/:：>\s]+/, '')
      .replace(/[-–—|/:：\s]+$/, '')
      .replace(/^[[(（【]\s*[\])）】]\s*/, '')
      .replace(/\s*[(（]\s*[)）]\s*$/, '')
      .trim();
    // A note after the title goes to the row's notes
    let note = '';
    const n = line.match(NOTE);
    if (n && n.index! > 0) { note = (n[1] || n[2] || '').trim(); line = line.slice(0, n.index).trim(); }
    if (!line || SKIP.test(line)) continue;
    out.push({ title: line, start, set: songSet, note });
  }
  return out;
}

/** Loose key for matching names: case, width, kana, spaces and punctuation don't matter. */
export const looseKey = (t: string) =>
  hira(normalize(t || '')).replace(/[\s!！?？.,，、。'’‘"“”・\-–—~〜～()（）[\]「」『』☆★♪*:：/]/g, '');

/** The known song a pasted name means (by any title or the reading), if any. */
export function matchSong(name: string, songs: Song[]): Song | undefined {
  const k = looseKey(name);
  if (!k) return undefined;
  return songs.find(x => [x.title, x.title_en, x.title_kana].some(t => t && looseKey(t) === k));
}
