/**
 * GET /api/sheets/:tab → fetch data from the named sheet tab.
 */
import {
  type Env, getCredentials,
  fetchEvents, fetchAlbums, fetchTracklists, fetchSongs, fetchPeople, fetchSetlists, fetchNews, fetchBlog, fetchPhotos,
  fetchVenues, fetchAreas, fetchPrefectures, fetchCountries,
} from '../../lib/sheets';
import { EDGE_TTL_SECONDS, sheetCacheKey } from '../../lib/edgeCache';
import { publicView } from '../../lib/visibility';

const fetchers: Record<string, (id: string, e: string, k: string) => Promise<unknown>> = {
  events: fetchEvents,
  albums: fetchAlbums,
  tracklists: fetchTracklists,
  songs: fetchSongs,
  people: fetchPeople,
  setlists: fetchSetlists,
  news: fetchNews,
  blog: fetchBlog,
  photos: fetchPhotos,
  venues: fetchVenues,
  areas: fetchAreas,
  prefectures: fetchPrefectures,
  countries: fetchCountries,
};

export const onRequestGet: PagesFunction<Env> = async ({ request, params, env, waitUntil }) => {
  const tab = (params.tab as string).toLowerCase();
  const fetcher = fetchers[tab];
  if (!fetcher) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // Serve from the edge cache when we can (cleared on every admin save)
  const cache = (caches as unknown as { default: Cache }).default;
  const key = sheetCacheKey(new URL(request.url).origin, tab);
  const hit = await cache.match(key);
  if (hit) return hit;

  try {
    const { sheetId, email, privateKey } = getCredentials(env);
    const data = await fetcher(sheetId, email, privateKey);
    // Public: hidden, scheduled-for-later and not-yet-public setlists never leave the server
    // (and draft releases' tracklists)
    const related = tab === 'setlists' ? await fetchEvents(sheetId, email, privateKey)
      : tab === 'tracklists' ? await fetchAlbums(sheetId, email, privateKey) : undefined;
    const res = Response.json(publicView(tab, data, related as never), {
      headers: { 'Cache-Control': `public, max-age=0, s-maxage=${EDGE_TTL_SECONDS}` },
    });
    waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (err) {
    console.error('[sheets-api]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
