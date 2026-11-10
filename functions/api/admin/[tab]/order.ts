/**
 * POST /api/admin/:tab/order {ids} → put the tab's rows in that order.
 * (Admin sign-in and the cache purge come from the admin middleware.)
 */
import { type Env, getCredentials, reorderRows } from '../../../lib/sheets';

export const onRequestPost: PagesFunction<Env> = async ({ request, params, env }) => {
  try {
    const { sheetId, email, privateKey } = getCredentials(env);
    const body: any = await request.json();
    if (!Array.isArray(body.ids)) return Response.json({ error: 'Missing ids' }, { status: 400 });
    await reorderRows(sheetId, params.tab as string, body.ids.map(String), email, privateKey);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
