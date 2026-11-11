/**
 * GET /api/ig/:code — the picture of Instagram post :code (home page blog
 * thumbnails). Kept in the edge cache so Instagram is asked rarely.
 */
import { fetchInstagramThumb } from '../../lib/igThumb';

export const onRequestGet: PagesFunction = async ({ request, params, waitUntil }) => {
  const cache = caches.default;
  const key = new Request(new URL(request.url).origin + `/api/ig/${params.code}`);
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await fetchInstagramThumb(String(params.code));
  if (res.ok) waitUntil(cache.put(key, res.clone()));
  return res;
};
