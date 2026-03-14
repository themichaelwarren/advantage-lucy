/**
 * GET /api/docs/:docId → fetch plain text from a Google Doc.
 */
import { fetchDocText } from '../../lib/docs';
import type { Env } from '../../lib/sheets';

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !privateKey) {
    return Response.json({ error: 'Missing Google auth env vars' }, { status: 500 });
  }

  try {
    const text = await fetchDocText(params.docId as string, email, privateKey);
    return Response.json({ text });
  } catch (err) {
    console.error('[docs-api]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
