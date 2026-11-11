/**
 * Who may read a lyrics doc through /api/docs/:docId. Signed-in admins:
 * any. Everyone else: only the lyrics of a song that's public and whose
 * lyrics aren't hidden. (Before this, the route read any Google Doc the
 * site's account could open, for anyone who had its id.)
 */
import { checkAdmin } from './adminAuth';
import { publicView } from './visibility';

export interface LyricsAccessConfig { clientId?: string; adminEmails?: string }

export async function mayReadDoc(
  docId: string,
  authHeader: string | null | undefined,
  config: LyricsAccessConfig,
  loadSongs: () => Promise<Record<string, unknown>[]>,
): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{10,}$/.test(docId)) return false;
  if (authHeader && (await checkAdmin(authHeader, config)).ok) return true;
  const songs = publicView('songs', await loadSongs() as never) as Record<string, unknown>[];
  return songs.some(x => x.lyrics_doc_id === docId);
}
