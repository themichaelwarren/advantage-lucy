/**
 * Every /api/admin/* request (reads of headers included) must come from a
 * signed-in admin. See lib/adminAuth.ts.
 *
 * Saves are also written to the activity log (lib/activity.ts): the row as
 * it was is read before the save, and the entry is added after it worked.
 */
import { checkAdmin } from '../../lib/adminAuth';
import { purgeSheetCache } from '../../lib/edgeCache';
import { type Env as SheetEnv, getCredentials } from '../../lib/sheets';
import { safePlan, recordActivity } from '../../lib/activity';

interface Env extends SheetEnv {
  VITE_GOOGLE_CLIENT_ID?: string;
  VITE_ADMIN_EMAILS?: string;
}

export const onRequest: PagesFunction<Env> = async ({ request, env, next, waitUntil }) => {
  const check = await checkAdmin(request.headers.get('Authorization'), {
    clientId: env.VITE_GOOGLE_CLIENT_ID,
    adminEmails: env.VITE_ADMIN_EMAILS,
  });
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  let plan = null;
  let ctx = null;
  if (request.method !== 'GET') {
    try {
      const { sheetId, email, privateKey } = getCredentials(env);
      ctx = { sheetId, saEmail: email, saKey: privateKey };
      const url = new URL(request.url);
      const isJson = (request.headers.get('Content-Type') || '').includes('application/json');
      const body = isJson ? await request.clone().json().catch(() => ({})) : {};
      plan = await safePlan(ctx, { method: request.method, path: url.pathname, query: url.searchParams, body });
    } catch (err) {
      console.error('[activity] middleware', err);
    }
  }

  const res = await next();
  if (request.method !== 'GET' && res.ok) {
    // A successful save changes the public data: drop the edge-cached copy
    await purgeSheetCache(new URL(request.url).origin);
    if (plan && ctx) waitUntil(recordActivity(ctx, plan, check.email).catch(err => console.error('[activity] record', err)));
  }
  return res;
};
