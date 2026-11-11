import type { Song } from '../types';
import { normalize } from './text';
import { hira } from './songTitles';
import { parseTypedTime } from './youtube';

/**
 * A setlist pasted from a YouTube description, one song a line, in any of
 * the usual shapes:
 *   0:00 Hello mate!        1. シトラス 4:12        05:30 - May
 *   [12:01] メトロ           1:02:03 / 風にあずけて    M3 グッバイ (8:45)
 * Lines without a time are still songs (a setlist with no timestamps).
 * Lines that are only a time, or look like a heading ("Setlist:", "MC"),
 * are skipped.
 */
export interface PastedSong { title: string; start: number | null }

const TIME = /(?:^|[\s[(（【|])(\d{1,2}:\d{2}(?::\d{2})?)(?=$|[\s\])）】|,、.\-–—])/;
// Not songs: headings, talk, sound effects, breaks ("Setlist:", "MC 2", "Opening SE", "転換")
const SKIP = /^(?:set ?list|セットリスト|セトリ|songs?|曲目|tracklist|encore|アンコール|start|end|break|休憩|転換|入場|退場|挨拶|チューニング|tuning|talk|トーク|(?:opening|ending|intro|outro|オープニング|エンディング)?\s*(?:se|bgm|sound ?check)?|mc\s*\d*|(?:opening|ending|intro|outro|オープニング|エンディング))\s*[:：]?$/i;

export function parseTimestamps(text: string): PastedSong[] {
  const out: PastedSong[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) continue;
    const m = line.match(TIME);
    const start = m ? parseTypedTime(m[1]) : null;
    // Take the time out along with any brackets around it: "[12:01]", "(16:30)"
    if (m) line = line.replace(new RegExp(`[[(（【]?\\s*${m[1]}\\s*[\\])）】]?`), ' ').trim();
    // Numbering, bullets and separators around the title
    line = line
      .replace(/^(?:(?:M|#|No\.?)\s*\d{1,2}\b\s*[.)．、:：\-–—]?|\d{1,2}\s*[.)．、:：\-–—])\s*/i, '')
      .replace(/^[-–—•・|/:：>\s]+/, '')
      .replace(/[-–—|/:：\s]+$/, '')
      .replace(/^[[(（【]\s*[\])）】]\s*/, '')
      .replace(/\s*[(（]\s*[)）]\s*$/, '')
      .trim();
    if (!line || SKIP.test(line)) continue;
    out.push({ title: line, start });
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
