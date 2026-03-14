/**
 * GET /api/images/:key — serve an image from R2.
 */

interface Env {
  POSTERS: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  if (!env.POSTERS) {
    return new Response('R2 not configured', { status: 500 });
  }

  const key = params.key as string;
  const object = await env.POSTERS.get(key);

  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
};
