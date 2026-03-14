/**
 * POST /api/docs → create a blank Google Doc in the lyrics folder.
 */
import { createDoc } from '../../lib/docs';
import type { Env } from '../../lib/sheets';

interface DocsEnv extends Env {
  VITE_LYRICS_FOLDER_ID: string;
}

export const onRequestPost: PagesFunction<DocsEnv> = async ({ request, env }) => {
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const folderId = env.VITE_LYRICS_FOLDER_ID;

  if (!email || !privateKey || !folderId) {
    return Response.json({ error: 'Missing Google auth or folder env vars' }, { status: 500 });
  }

  try {
    const body: any = await request.json();
    const docId = await createDoc(body.title, folderId, email, privateKey);
    return Response.json({ docId });
  } catch (err) {
    console.error('[docs-create]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
