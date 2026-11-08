/**
 * GET /api/admin/attachment/:name: a photo attached to a message.
 * Admin only (api/admin/_middleware.ts); never cached publicly.
 */
import { isAttachmentName, SUBMISSIONS_PREFIX } from '../../../lib/attachments';

interface Env { POSTERS: R2Bucket }

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const name = String(params.name || '');
  if (!isAttachmentName(name)) return new Response('Not found', { status: 404 });
  const object = await env.POSTERS.get(SUBMISSIONS_PREFIX + name);
  if (!object) return new Response('Not found', { status: 404 });
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
