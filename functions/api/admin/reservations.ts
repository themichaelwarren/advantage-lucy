/**
 * /api/admin/reservations: list, add, change and re-confirm ticket
 * reservations. Behind the admin sign-in check (api/admin/_middleware.ts).
 * See functions/lib/reservations.ts.
 */
import { type Env, getCredentials } from '../../lib/sheets';
import type { NotifyEnv } from '../../lib/notify';
import { handleAdminReservations } from '../../lib/reservations';

interface ReserveEnv extends Env, NotifyEnv {}

export const onRequest: PagesFunction<ReserveEnv> = async ({ request, env }) => {
  const { sheetId, email, privateKey } = getCredentials(env);
  return handleAdminReservations(request, {
    sheetId, saEmail: email, saKey: privateKey, env,
    siteUrl: env.SITE_URL || new URL(request.url).origin,
  });
};
