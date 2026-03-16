/**
 * GET /api/sheets/:tab → fetch data from the named sheet tab.
 */
import {
  type Env, getCredentials,
  fetchEvents, fetchAlbums, fetchTracklists, fetchSongs, fetchPeople, fetchSetlists, fetchNews, fetchBlog,
  fetchVenues, fetchAreas, fetchPrefectures, fetchCountries,
} from '../../lib/sheets';

const fetchers: Record<string, (id: string, e: string, k: string) => Promise<unknown>> = {
  events: fetchEvents,
  albums: fetchAlbums,
  tracklists: fetchTracklists,
  songs: fetchSongs,
  people: fetchPeople,
  setlists: fetchSetlists,
  news: fetchNews,
  blog: fetchBlog,
  venues: fetchVenues,
  areas: fetchAreas,
  prefectures: fetchPrefectures,
  countries: fetchCountries,
};

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const tab = (params.tab as string).toLowerCase();
  const fetcher = fetchers[tab];
  if (!fetcher) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const { sheetId, email, privateKey } = getCredentials(env);
    const data = await fetcher(sheetId, email, privateKey);
    return Response.json(data);
  } catch (err) {
    console.error('[sheets-api]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
