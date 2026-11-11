/**
 * "Is this already in the archive?" checks for new venues and shows.
 *
 * Venues: names are compared without the words every venue has ("club",
 * "live house", "ホール"…), in both languages, and across scripts
 * (ナミキジャンクション vs 並木ジャンクション: the shared ジャンクション;
 * ナミキ vs "Namiki": kana read as rōmaji). These are hints, not rules:
 * the admin shows them and lets you carry on.
 *
 * Shows: the same date at the same venue is almost surely the same show;
 * the same date somewhere else is just worth a look (in-stores happen).
 */

import { allVenueNames } from '../../functions/lib/venueNames';

const GENERIC = [
  'live house', 'livehouse', 'club', 'live', 'house', 'hall', 'studio', 'cafe', 'café', 'bar', 'the', 'theater', 'theatre', 'space', 'shop', 'store', 'records', 'record', 'tower', 'temple', 'park', 'shrine', 'church',
  'ライブハウス', 'ライヴハウス', 'クラブ', 'ライブ', 'ライヴ', 'ホール', 'スタジオ', 'カフェ', 'バー', 'シアター', '劇場', 'レコード', 'ハウス', 'タワー', '寺', '公園', '神社', '教会',
];

/** NFKC, lower case, no spaces or punctuation */
const flat = (t: string) => (t || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

/** The part of a name that tells venues apart. */
export function venueCore(name: string): string {
  let t = (name || '').normalize('NFKC').toLowerCase();
  for (const g of GENERIC) t = t.split(g).join(' ');
  return flat(t);
}

// ---- kana → rōmaji (enough to compare with an English name) ----
const KANA: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o', か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko', さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to', な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no', は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo', や: 'ya', ゆ: 'yu', よ: 'yo', ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro', わ: 'wa', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go', ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo', だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo', ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po', ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
};
const YOON: Record<string, string> = { ゃ: 'ya', ゅ: 'yu', ょ: 'yo' };

/** Hiragana/katakana to rough Hepburn; anything else is dropped. */
export function kanaToRomaji(text: string): string {
  // katakana → hiragana
  const h = (text || '').normalize('NFKC').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  let out = '';
  for (let i = 0; i < h.length; i++) {
    const c = h[i], next = h[i + 1];
    if (c === 'っ') { const r = KANA[next] || ''; out += r.charAt(0); continue; }
    if (c === 'ー') { out += out.slice(-1); continue; }
    if (YOON[c]) { out = (out.replace(/i$/, '') + YOON[c]).replace(/(sh|ch|j)y(?=[aou]$)/, '$1'); continue; }
    if (KANA[c]) out += KANA[c];
  }
  return out;
}
const hasKana = (t: string) => /[ぁ-ヿ]/.test(t);

function lcs(a: string, b: string): number {
  if (!a || !b) return 0;
  let best = 0;
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : 0;
      if (prev[j] > best) best = prev[j];
      diag = tmp;
    }
  }
  return best;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const m = a.length, n = b.length;
  let row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const next = [i];
    for (let j = 1; j <= n; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return 1 - row[n] / Math.max(m, n);
}

export interface VenueLike { id: string; name_en?: string; name_ja?: string; area?: string; former_names?: string }
export interface VenueMatch<V> { venue: V; strong: boolean }

/** Pairs of names that look like the same place. */
function venueScore(a: { name_en?: string; name_ja?: string; former_names?: string }, b: { name_en?: string; name_ja?: string; former_names?: string }): 0 | 1 | 2 {
  // Old names count too: typing "ON AIR WEST" finds Spotify O-WEST
  const names = (v: typeof a) => allVenueNames(v);
  for (const x of names(a)) for (const y of names(b)) {
    const fx = flat(x), fy = flat(y);
    if (fx && fx === fy) return 2;
    const cx = venueCore(x), cy = venueCore(y);
    if (cx.length >= 2 && cx === cy) return 2;
    const short = Math.min(cx.length, cy.length);
    if (short >= 3 && (cx.includes(cy) || cy.includes(cx))) return 1;
    // A long shared run: ジャンクション in both
    const run = lcs(cx, cy);
    const latin = /^[a-z0-9]+$/.test(cx + cy);
    if (run >= (latin ? 6 : 4) && run >= short * 0.6) return 1;
    // Kana read aloud vs an English name: ナミキ ≈ namiki
    if (hasKana(x) && !hasKana(y) && /[a-z]/.test(cy)) {
      const r = venueCore(kanaToRomaji(x));
      if (r.length >= 4 && (similarity(r, cy) >= 0.7 || lcs(r, cy) >= Math.max(6, Math.min(r.length, cy.length) * 0.6))) return 1;
    }
  }
  return 0;
}

/** Existing venues that look like this one (best first), leaving out `exceptId`. */
export function similarVenues<V extends VenueLike>(cand: { name_en?: string; name_ja?: string }, venues: V[], exceptId?: string): VenueMatch<V>[] {
  if (!(cand.name_en || '').trim() && !(cand.name_ja || '').trim()) return [];
  return venues
    .filter(v => v.id !== exceptId)
    .map(v => ({ venue: v, s: venueScore(cand, v) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 5)
    .map(x => ({ venue: x.venue, strong: x.s === 2 }));
}

/**
 * Every pair of existing venues that look alike (for "What's missing").
 * Two in different areas aren't counted: that's a chain (Club Quattro in
 * Shibuya and in Umeda), not a double.
 */
export function venueDupes<V extends VenueLike>(venues: V[]): [V, V][] {
  const out: [V, V][] = [];
  for (let i = 0; i < venues.length; i++)
    for (let j = i + 1; j < venues.length; j++) {
      const a = venues[i], b = venues[j];
      if (a.area && b.area && a.area !== b.area) continue;
      if (venueScore(a, b)) out.push([a, b]);
    }
  return out;
}

export interface ShowLike { id: string; date: string; venue_id?: string }

/** Shows already on this date: the same venue (likely the same show) first. */
export function sameDayShows<E extends ShowLike>(cand: { date: string; venue_id?: string }, events: E[], exceptId?: string): { event: E; sameVenue: boolean }[] {
  if (!cand.date) return [];
  return events
    .filter(e => e.id !== exceptId && e.date === cand.date)
    .map(e => ({ event: e, sameVenue: !!cand.venue_id && e.venue_id === cand.venue_id }))
    .sort((a, b) => Number(b.sameVenue) - Number(a.sameVenue));
}

/** Existing shows that look doubled: same date, same venue. */
export function showDupes<E extends ShowLike>(events: E[]): [E, E][] {
  const by = new Map<string, E[]>();
  for (const e of events) {
    if (!e.date || !e.venue_id) continue;
    const k = `${e.date}|${e.venue_id}`;
    by.set(k, [...(by.get(k) || []), e]);
  }
  const out: [E, E][] = [];
  for (const list of by.values()) for (let i = 1; i < list.length; i++) out.push([list[0], list[i]]);
  return out;
}
