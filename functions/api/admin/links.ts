/**
 * /api/admin/links (admin only). Behind the admin sign-in (api/admin/_middleware.ts).
 * See functions/lib/links.ts.
 */
import { type Env, getCredentials } from '../../lib/sheets';
import { handleAdminLinks } from '../../lib/links';

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const { sheetId, email, privateKey } = getCredentials(env);
  return handleAdminLinks(request, { sheetId, saEmail: email, saKey: privateKey });
};
