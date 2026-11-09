/** Lowercase, full-width → half-width, no spaces: "Ｋｉｃｈｉ ｊｏｊｉ" ≈ "kichijoji". For matching, not display. */
export const normalize = (t: string) => t.normalize('NFKC').toLowerCase().replace(/[\s　·・]/g, '');
