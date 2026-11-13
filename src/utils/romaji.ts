/**
 * Kana read as rough Hepburn rōmaji (シトラス → shitorasu, しろいあさ →
 * shiroiasa), so searches can be typed in rōmaji. Used by song search
 * (songTitles.ts) and the "already in the archive?" venue check.
 */
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
