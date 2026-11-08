/**
 * GET /api/admin/messages: contact form messages, newest first.
 * Behind the admin sign-in check (api/admin/_middleware.ts).
 */
import { type Env, getCredentials } from '../../lib/sheets';
import { listMessages } from '../../lib/messages';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const { sheetId, email, privateKey } = getCredentials(env);
    return Response.json({ messages: await listMessages(sheetId, email, privateKey) });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
