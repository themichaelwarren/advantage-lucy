/**
 * GET /api/docs/:docId → the plain text of a song's lyrics doc. Only the
 * lyrics of public songs (hidden lyrics and drafts excluded), unless a
 * signed-in admin asks. See functions/lib/lyricsAccess.ts.
 */
import { fetchDocText } from '../../lib/docs';
import { type Env, getCredentials, fetchSongs } from '../../lib/sheets';
import { mayReadDoc } from '../../lib/lyricsAccess';

interface DocsEnv extends Env { VITE_GOOGLE_CLIENT_ID?: string; VITE_ADMIN_EMAILS?: string }

export const onRequestGet: PagesFunction<DocsEnv> = async ({ params, env, request }) => {
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !privateKey) return Response.json({ error: 'Missing Google auth env vars' }, { status: 500 });

  const docId = String(params.docId || '');
  const allowed = await mayReadDoc(docId, request.headers.get('Authorization'),
    { clientId: env.VITE_GOOGLE_CLIENT_ID, adminEmails: env.VITE_ADMIN_EMAILS },
    async () => { const c = getCredentials(env); return fetchSongs(c.sheetId, c.email, c.privateKey) as never; },
  ).catch(() => false);
  if (!allowed) return Response.json({ error: 'Not found' }, { status: 404 });

  try {
    const text = await fetchDocText(docId, email, privateKey);
    return Response.json({ text });
  } catch (err) {
    console.error('[docs-api]', err);
    return Response.json({ error: 'server' }, { status: 500 });
  }
};
