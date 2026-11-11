/**
 * GET /api/admin/link-check: which video and listen links still work.
 * Admin only (api/admin/_middleware.ts). See lib/linkCheck.ts.
 */
import { type Env, getCredentials } from '../../lib/sheets';
import { handleLinkCheck } from '../../lib/linkCheck';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const { sheetId, email, privateKey } = getCredentials(env);
  return handleLinkCheck(request, { sheetId, email, key: privateKey });
};
