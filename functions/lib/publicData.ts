/**
 * The public view of a sheet tab, through the same edge cache as
 * /api/sheets/:tab (same cache key, so the two share entries and an admin
 * save clears both).
 */
import {
  type Env, getCredentials,
  fetchEvents, fetchAlbums, fetchTracklists, fetchSongs, fetchNews, fetchVenues, fetchPhotos,
} from './sheets';
import { EDGE_TTL_SECONDS, sheetCacheKey } from './edgeCache';
import { publicView } from './visibility';

const fetchers = {
  events: fetchEvents, albums: fetchAlbums, tracklists: fetchTracklists,
  songs: fetchSongs, news: fetchNews, venues: fetchVenues, photos: fetchPhotos,
} as const;
export type PublicTab = keyof typeof fetchers;

export async function readPublicTab(
  tab: PublicTab, origin: string, env: Env, waitUntil: (p: Promise<unknown>) => void,
): Promise<Record<string, any>[]> {
  const cache = (caches as unknown as { default: Cache }).default;
  const key = sheetCacheKey(origin, tab);
  const hit = await cache.match(key);
  if (hit) return hit.json();
  const { sheetId, email, privateKey } = getCredentials(env);
  const related = tab === 'tracklists' ? await fetchAlbums(sheetId, email, privateKey) : undefined;
  const data = publicView(tab, await fetchers[tab](sheetId, email, privateKey), related as never) as Record<string, any>[];
  const res = Response.json(data, { headers: { 'Cache-Control': `public, max-age=0, s-maxage=${EDGE_TTL_SECONDS}` } });
  waitUntil(cache.put(key, res));
  return data;
}
