/**
 * POST /api/admin/rename {kind, from, to}: change a show's, venue's, song's
 * or release's id (its address) and everything pointing at it.
 * Admin only (api/admin/_middleware.ts). See functions/lib/rename.ts.
 */
import { type Env, getCredentials } from '../../lib/sheets';
import { handleAdminRename } from '../../lib/rename';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { sheetId, email, privateKey } = getCredentials(env);
  return handleAdminRename(request, { sheetId, saEmail: email, saKey: privateKey });
};
