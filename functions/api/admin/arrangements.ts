/**
 * /api/admin/arrangements: keys (and later capo, tunings…) for songs.
 * Admin only (api/admin/_middleware.ts). See functions/lib/arrangements.ts.
 */
import { type Env, getCredentials } from '../../lib/sheets';
import { handleAdminArrangements } from '../../lib/arrangements';

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const { sheetId, email, privateKey } = getCredentials(env);
  return handleAdminArrangements(request, { sheetId, saEmail: email, saKey: privateKey });
};
