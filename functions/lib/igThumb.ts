/**
 * An Instagram post's image, served from our own site. Instagram's image
 * server only allows its own pages to show its images (Cross-Origin-
 * Resource-Policy: same-origin), and the image addresses are signed and
 * expire, so we fetch the current one for the post and pass it on.
 */
export const IG_CODE = /^[A-Za-z0-9_-]{5,40}$/;

export async function fetchInstagramThumb(code: string): Promise<Response> {
  if (!IG_CODE.test(code)) return new Response('Not found', { status: 404 });
  const res = await fetch(`https://www.instagram.com/p/${code}/media/?size=l`, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; advantageLucySite/1.0)', Accept: 'image/*' },
  });
  const type = res.headers.get('content-type') || '';
  if (!res.ok || !type.startsWith('image/')) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=600' } });
  return new Response(res.body, {
    headers: {
      'Content-Type': type,
      // A post's picture doesn't change: browsers keep it a day, the edge a week
      'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    },
  });
}
