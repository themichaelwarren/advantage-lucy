/**
 * GET /api/admin/lyrics-status: which lyrics docs have text, are empty, or
 * can't be read. Admin only (api/admin/_middleware.ts). See lib/lyricsStatus.ts.
 */
import { type Env, getCredentials } from '../../lib/sheets';
import { handleLyricsStatus } from '../../lib/lyricsStatus';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const { sheetId, email, privateKey } = getCredentials(env);
  return handleLyricsStatus(request, { sheetId, email, key: privateKey });
};
