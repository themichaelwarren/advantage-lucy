/**
 * GET  /api/reserve?event=<id>  is the show taking reservations, up to how many tickets
 * POST /api/reserve             reserve tickets (see functions/lib/reservations.ts)
 */
import { type Env, getCredentials } from '../lib/sheets';
import type { NotifyEnv } from '../lib/notify';
import { handleReserveGet, handleReservePost, type ReserveContext } from '../lib/reservations';

interface ReserveEnv extends Env, NotifyEnv { TURNSTILE_SECRET?: string }

function context(env: ReserveEnv, request: Request): ReserveContext {
  const { sheetId, email, privateKey } = getCredentials(env);
  return { sheetId, saEmail: email, saKey: privateKey, env, siteUrl: env.SITE_URL || new URL(request.url).origin };
}

export const onRequestGet: PagesFunction<ReserveEnv> = async ({ request, env }) => {
  try {
    return await handleReserveGet(new URL(request.url), context(env, request));
  } catch (err) {
    console.error('[reserve]', err);
    return Response.json({ error: 'server' }, { status: 500 });
  }
};

export const onRequestPost: PagesFunction<ReserveEnv> = async ({ request, env }) =>
  handleReservePost(request, context(env, request), request.headers.get('CF-Connecting-IP'));
