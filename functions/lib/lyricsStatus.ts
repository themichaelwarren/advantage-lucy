/**
 * Which lyrics docs actually have lyrics (admin only). Reads every song's
 * doc once (a few at a time) and says "text", "empty" (the doc exists but
 * has nothing in it) or "error" (missing, or not shared with the site).
 * Kept for half an hour at the edge; ?fresh=1 checks again.
 */
import { fetchDocText } from './docs';
import { fetchSongs } from './sheets';

export type LyricsState = 'text' | 'empty' | 'error';
const TTL = 30 * 60;

async function check(docIds: string[], email: string, key: string): Promise<Record<string, LyricsState>> {
  const out: Record<string, LyricsState> = {};
  let i = 0;
  const worker = async () => {
    while (i < docIds.length) {
      const id = docIds[i++];
      try { out[id] = (await fetchDocText(id, email, key)).replace(/\s/g, '') ? 'text' : 'empty'; }
      catch { out[id] = 'error'; }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return out;
}

export async function handleLyricsStatus(request: Request, env: { sheetId: string; email: string; key: string }): Promise<Response> {
  const url = new URL(request.url);
  const cache = typeof caches !== 'undefined' ? (caches as unknown as { default?: Cache }).default : undefined;
  const cacheKey = new Request(`${url.origin}/__admin/lyrics-status`);
  if (cache && !url.searchParams.has('fresh')) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }
  const songs = await fetchSongs(env.sheetId, env.email, env.key);
  const ids = [...new Set(songs.map(s => (s.lyrics_doc_id || '').trim()).filter(Boolean))];
  const body = { status: await check(ids, env.email, env.key), checkedAt: new Date().toISOString() };
  const res = Response.json(body, { headers: { 'Cache-Control': `private, max-age=0, s-maxage=${TTL}` } });
  if (cache) await cache.put(cacheKey, res.clone());
  return res;
}
