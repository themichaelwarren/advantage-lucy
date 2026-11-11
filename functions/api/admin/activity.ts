/**
 * GET /api/admin/activity: the edit history (admin only, private tab).
 * See functions/lib/activity.ts.
 */
import { type Env, getCredentials } from '../../lib/sheets';
import { handleAdminActivity } from '../../lib/activity';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const { sheetId, email, privateKey } = getCredentials(env);
  return handleAdminActivity(request, { sheetId, saEmail: email, saKey: privateKey });
};
