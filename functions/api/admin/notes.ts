/**
 * /api/admin/notes (admin only). Behind the admin sign-in (api/admin/_middleware.ts).
 * See functions/lib/notes.ts.
 */
import { type Env, getCredentials } from '../../lib/sheets';
import { handleAdminNotes } from '../../lib/notes';

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const { sheetId, email, privateKey } = getCredentials(env);
  return handleAdminNotes(request, { sheetId, saEmail: email, saKey: privateKey });
};
