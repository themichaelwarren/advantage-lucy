/**
 * Are the archive's links still alive? (admin only)
 *   videos: every video link in the Media tab. YouTube says 404 for a
 *           deleted video and 401/403 for a private one (or one that can't
 *           be embedded) when asked for its oEmbed; other links are loaded.
 *   listen: every streaming link on releases, loaded (redirects followed).
 * Services that refuse automated visitors (403/429/503…) count as
 * "unknown", not broken, so nothing is flagged by mistake.
 * Kept at the edge for 6 hours; ?fresh=1 checks again.
 */
import { listMedia } from './media';
import { fetchAlbums } from './sheets';
import { LISTEN_SERVICES } from './listen';

export type LinkState = 'ok' | 'gone' | 'private' | 'broken' | 'unknown';
const TTL = 6 * 3600;
const UA = 'Mozilla/5.0 (compatible; advantageLucySite/1.0; link check)';

const isYouTube = (u: string) => /^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i.test(u);

async function checkVideo(url: string): Promise<LinkState> {
  try {
    if (isYouTube(url)) {
      const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, { headers: { 'User-Agent': UA } });
      if (res.ok) return 'ok';
      if (res.status === 404 || res.status === 400) return 'gone';
      if (res.status === 401 || res.status === 403) return 'private';
      return 'unknown';
    }
    return await checkPage(url);
  } catch { return 'unknown'; }
}

async function checkPage(url: string): Promise<LinkState> {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,*/*' } });
    res.body?.cancel().catch(() => {});
    if (res.ok) return 'ok';
    if (res.status === 404 || res.status === 410) return 'broken';
    return 'unknown';
  } catch { return 'unknown'; }
}

async function pool<T>(items: string[], run: (x: string) => Promise<T>, n = 6): Promise<Record<string, T>> {
  const out: Record<string, T> = {};
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const x = items[i++]; out[x] = await run(x); } }));
  return out;
}

export async function handleLinkCheck(request: Request, env: { sheetId: string; email: string; key: string }): Promise<Response> {
  const url = new URL(request.url);
  const cache = typeof caches !== 'undefined' ? (caches as unknown as { default?: Cache }).default : undefined;
  const cacheKey = new Request(`${url.origin}/__admin/link-check`);
  if (cache && !url.searchParams.has('fresh')) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }
  const [media, albums] = await Promise.all([
    listMedia(env.sheetId, env.email, env.key),
    fetchAlbums(env.sheetId, env.email, env.key),
  ]);
  const videoUrls = [...new Set(media.filter(r => r.kind === 'show' || r.kind === 'song').map(r => r.url.trim()).filter(Boolean))];
  const listenUrls = [...new Set(albums.flatMap(a => [a.listenUrl, ...LISTEN_SERVICES.map(x => a.listen?.[x.key])]).filter((u): u is string => !!u && /^https?:\/\//.test(u)))];
  const [videos, listen] = await Promise.all([pool(videoUrls, checkVideo), pool(listenUrls, checkPage, 4)]);
  const res = Response.json({ videos, listen, checkedAt: new Date().toISOString() }, { headers: { 'Cache-Control': `private, max-age=0, s-maxage=${TTL}` } });
  if (cache) await cache.put(cacheKey, res.clone());
  return res;
}
