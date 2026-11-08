/**
 * Every /api/admin/* request (reads of headers included) must come from a
 * signed-in admin. See lib/adminAuth.ts.
 */
import { checkAdmin } from '../../lib/adminAuth';
import { purgeSheetCache } from '../../lib/edgeCache';

interface Env {
  VITE_GOOGLE_CLIENT_ID?: string;
  VITE_ADMIN_EMAILS?: string;
}

export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
  const check = await checkAdmin(request.headers.get('Authorization'), {
    clientId: env.VITE_GOOGLE_CLIENT_ID,
    adminEmails: env.VITE_ADMIN_EMAILS,
  });
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });
  const res = await next();
  // A successful save changes the public data: drop the edge-cached copy
  if (request.method !== 'GET' && res.ok) await purgeSheetCache(new URL(request.url).origin);
  return res;
};
