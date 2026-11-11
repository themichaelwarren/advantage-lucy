/**
 * /api/admin/filters: filtered senders and where their messages go.
 * Admin only (api/admin/_middleware.ts). See functions/lib/filters.ts.
 */
import { type Env, getCredentials } from '../../lib/sheets';
import { handleAdminFilters } from '../../lib/filters';

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const { sheetId, email, privateKey } = getCredentials(env);
  return handleAdminFilters(request, { sheetId, saEmail: email, saKey: privateKey });
};
