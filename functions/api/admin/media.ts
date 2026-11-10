/**
 * /api/admin/media: videos of shows and songs (admin only, private tab).
 * Behind the admin sign-in check (api/admin/_middleware.ts). See functions/lib/media.ts.
 */
import { type Env, getCredentials } from '../../lib/sheets';
import { handleAdminMedia } from '../../lib/media';

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const { sheetId, email, privateKey } = getCredentials(env);
  return handleAdminMedia(request, { sheetId, saEmail: email, saKey: privateKey });
};
