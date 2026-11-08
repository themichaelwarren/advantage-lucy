/**
 * Short edge cache for the public /api/sheets/* data, so most visits don't
 * wait on Google Sheets. Admin saves clear it (see api/admin/_middleware.ts),
 * so edits still show up straight away.
 */
export const SHEET_TABS = [
  'events', 'albums', 'tracklists', 'songs', 'people', 'setlists', 'news',
  'blog', 'photos', 'venues', 'areas', 'prefectures', 'countries',
];

// Served from the edge for this long; after that the next visit refetches
export const EDGE_TTL_SECONDS = 300;

export function sheetCacheKey(origin: string, tab: string): Request {
  return new Request(`${origin}/api/sheets/${tab}`, { method: 'GET' });
}

/** Clear every cached tab: one save can affect several (events join venues and areas). */
export async function purgeSheetCache(origin: string): Promise<void> {
  const cache = (caches as unknown as { default: Cache }).default;
  await Promise.all(SHEET_TABS.map(tab => cache.delete(sheetCacheKey(origin, tab))));
}
