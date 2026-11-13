/**
 * フリガナ for bookings. Name readings can't be worked out from kanji
 * (渡邊 may be わたなべ or わたのべ), so the Japanese booking form asks for it,
 * and the admin sorts and runs the door list by it. Shared by the site and
 * the server (reservations.ts).
 */

/** Hiragana and half-width katakana → full-width katakana; spacing tidied. */
export function toKatakana(text: string): string {
  return (text || '').normalize('NFKC')
    .replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[\s　]+/g, ' ')
    .trim();
}

/** Only katakana (and the marks a reading uses: ー ・ spaces). */
export const isKatakana = (text: string) => /^[ァ-ヺー・・ー\s=＝]+$/.test(toKatakana(text));

/** A name written with kanji needs a reading; kana or Latin names sort as they are. */
export const needsKana = (name: string) => /[㐀-鿿豈-﫿々〆ヵヶ]/.test(name || '');

/** What to sort a booking by: its reading if it has one, else its name (kana as katakana). */
export const sortKey = (r: { name: string; kana?: string }) => toKatakana(r.kana || '') || toKatakana(r.name || '');
