/**
 * GET   /api/admin/messages: contact form messages, newest first.
 * PATCH /api/admin/messages {id, status}: mark one new ('') or done.
 * Behind the admin sign-in check (api/admin/_middleware.ts).
 */
import { type Env, getCredentials } from '../../lib/sheets';
import { listMessages, setMessageStatus } from '../../lib/messages';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const { sheetId, email, privateKey } = getCredentials(env);
    return Response.json({ messages: await listMessages(sheetId, email, privateKey) });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { id, status } = await request.json() as { id?: string; status?: string };
    const { sheetId, email, privateKey } = getCredentials(env);
    await setMessageStatus(sheetId, email, privateKey, id || '', status ?? '');
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 400 });
  }
};
