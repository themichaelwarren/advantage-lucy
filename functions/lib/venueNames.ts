/**
 * Venues that changed their name (ON AIR WEST → Shibuya O-WEST → TSUTAYA
 * O-WEST → Spotify O-WEST) stay one venue. The Venues row holds the name
 * it has now; its optional `former_names` column lists the old ones, one
 * per line, each with the month it was used until:
 *
 *   2003-12 | ON AIR WEST | ON AIR WEST
 *   2013-12 | Shibuya O-WEST | 渋谷 O-WEST
 *   2021-12 | TSUTAYA O-WEST | TSUTAYA O-WEST
 *
 * ("used until 2003-12" = shows before December 2003 get that name.) A
 * show then reads with the name on its flyer, and the venue page lists
 * them all. Shared by the Functions, the dev server and the app.
 */

export interface FormerName { until: string; name_en: string; name_ja: string }

/** "2003-12 | ON AIR WEST | ON AIR WEST" lines → names, oldest first. */
export function parseFormerNames(cell?: string): FormerName[] {
  return (cell || '')
    .split(/\r?\n/)
    .map(line => line.split('|').map(x => x.trim()))
    .filter(([until, en, ja]) => /^\d{4}-\d{2}(-\d{2})?$/.test(until || '') && (en || ja))
    .map(([until, en = '', ja = '']) => ({ until, name_en: en, name_ja: ja }))
    .sort((a, b) => a.until.localeCompare(b.until));
}

export function formatFormerNames(names: FormerName[]): string {
  return names
    .filter(n => /^\d{4}-\d{2}(-\d{2})?$/.test(n.until) && (n.name_en.trim() || n.name_ja.trim()))
    .sort((a, b) => a.until.localeCompare(b.until))
    .map(n => `${n.until} | ${n.name_en.trim()} | ${n.name_ja.trim()}`)
    .join('\n');
}

/**
 * The venue's name on `date` (YYYY-MM-DD). "2003-10-11" < "2003-12" and
 * "2003-12-05" > "2003-12", so a plain string compare does the months right.
 */
export function venueNameAt(
  venue: { name_en?: string; name_ja?: string; former_names?: string } | undefined,
  date: string,
): { name_en: string; name_ja: string; former: boolean } {
  const now = { name_en: venue?.name_en || '', name_ja: venue?.name_ja || '', former: false };
  if (!venue || !date) return now;
  const then = parseFormerNames(venue.former_names).find(n => date < n.until);
  return then ? { name_en: then.name_en || then.name_ja, name_ja: then.name_ja || then.name_en, former: true } : now;
}

/** Every name a venue has had (for search and the "already in the archive?" check). */
export const allVenueNames = (venue: { name_en?: string; name_ja?: string; former_names?: string }) =>
  [venue.name_en, venue.name_ja, ...parseFormerNames(venue.former_names).flatMap(n => [n.name_en, n.name_ja])].filter((x): x is string => !!x);

/** "2003-12" → "2003.11": the last month a name was used. */
const monthBefore = (until: string) => {
  const [y, m] = until.slice(0, 7).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** Each former name with when it was used: "〜2003.11", "2003.12〜2013.11"; newest first. */
export function formerPeriods(names: FormerName[], dash = '〜'): { name_en: string; name_ja: string; period: string }[] {
  const asc = [...names].sort((a, b) => a.until.localeCompare(b.until));
  return asc.map((n, i) => ({
    name_en: n.name_en, name_ja: n.name_ja,
    period: `${i > 0 ? asc[i - 1].until.slice(0, 7).replace('-', '.') : ''}${dash}${monthBefore(n.until)}`,
  })).reverse();
}
