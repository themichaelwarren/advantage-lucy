/**
 * GET /api/admin/sheets/:tab: the full tab for the admin, including hidden
 * items, scheduled posts and setlists that aren't public yet. Signed-in
 * admins only (see ../_middleware.ts); never cached.
 */
import {
  type Env, getCredentials,
  fetchEvents, fetchSetlists, fetchNews, fetchBlog, fetchPhotos,
} from '../../../lib/sheets';

const fetchers: Record<string, (id: string, e: string, k: string) => Promise<unknown>> = {
  events: fetchEvents,
  setlists: fetchSetlists,
  news: fetchNews,
  blog: fetchBlog,
  photos: fetchPhotos,
};

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const tab = String(params.tab).toLowerCase();
  const fetcher = fetchers[tab];
  if (!fetcher) return Response.json({ error: 'Not found' }, { status: 404 });
  try {
    const { sheetId, email, privateKey } = getCredentials(env);
    return Response.json(await fetcher(sheetId, email, privateKey), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[admin-sheets]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
