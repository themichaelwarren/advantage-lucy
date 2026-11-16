import type { Song } from '../types';
import { normalize } from './text';
import { kanaToRomaji } from './romaji';

/**
 * Song titles in two languages. `title` is the song's name as written (and
 * what setlists and releases match on). English pages show `title_en`
 * first (mostly romaji, as on streaming services); Japanese pages show
 * `title`. The other one, if different, is a muted subtitle. Japanese
 * pages sort in 50音順 by `title_kana`; English pages A–Z by `title_en`.
 */
type Titled = Pick<Song, 'title' | 'title_en' | 'title_kana'>;
type Lang = 'en' | 'ja';

/** Same rules for releases (Album has the same three fields). */
export const localTitle = (s: Titled, locale: Lang) => songTitle(s, locale);
export const altTitle = (s: Titled, locale: Lang) => songAltTitle(s, locale);

export const songTitle = (s: Titled, locale: Lang) => (locale === 'en' ? s.title_en || s.title : s.title) || '';

/** The title in the other language, or '' when it's the same (Armond, May…). */
export function songAltTitle(s: Titled, locale: Lang): string {
  const main = songTitle(s, locale);
  const other = locale === 'en' ? s.title : s.title_en || '';
  return other && normalize(other) !== normalize(main) ? other : '';
}

const collators = { ja: new Intl.Collator('ja', { sensitivity: 'base', numeric: true }), en: new Intl.Collator('en', { sensitivity: 'base', numeric: true }) };
/** What a song sorts by: 読み on Japanese pages, the English title on English pages. */
export const songSortKey = (s: Titled, locale: Lang) => (locale === 'ja' ? s.title_kana || s.title : s.title_en || s.title) || '';
/** A title written only in kana (ブルーハワイ) is its own reading. */
const KANA_ONLY = /^(?=.*[ぁ-ヿ])[ぁ-ヿ　-〿！-～\s!?・ー〜~.,'’\-0-9]+$/;
/** A song that can't be put in 50音 order until it has a reading (leaf, 遊ぼう！フィジー！). */
export const needsReading = (s: Titled) => !!s.title && !(s.title_kana || '').trim() && !KANA_ONLY.test(s.title);
/** Japanese pages: 50音順 by reading, with songs that have no reading yet at the end (instead of Latin titles jumping to the top). */
export const compareSongs = (locale: Lang) => (a: Titled, b: Titled) =>
  (locale === 'ja' ? Number(needsReading(a)) - Number(needsReading(b)) : 0)
  || collators[locale].compare(songSortKey(a, locale), songSortKey(b, locale));

/**
 * How long a title looks: a Japanese character is about twice as wide as a
 * Latin letter. Used to set long titles a size smaller: " is-long" / " is-longer".
 */
export const titleSizeClass = (t: string) => {
  const w = [...(t || '')].reduce((n, c) => n + (/[\u3000-\u9fff\uff00-\uffef]/.test(c) ? 1 : 0.55), 0);
  return w > 13 ? ' is-longer' : w > 8 ? ' is-long' : '';
};

/** Katakana → hiragana, so しとらす finds シトラス */
export const hira = (t: string) => t.replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** Every way to find a song: シトラス, しとらす, citrus, shitorasu (白い朝 by "shiro", from its reading). */
export const songSearchText = (s: Titled & { original_artist?: string }) => {
  // Rōmaji from the reading, or from a title written all in kana
  const kana = s.title_kana || (/^[\u3041-\u30ff\sー・!?！？]+$/.test(s.title || '') ? s.title : '');
  return hira(normalize([s.title, s.title_en, s.title_kana, s.original_artist, kana ? kanaToRomaji(kana) : ''].filter(Boolean).join(' ')));
};
/** A search box's text, made comparable with songSearchText. */
export const songQuery = (q: string) => hira(normalize(q));
