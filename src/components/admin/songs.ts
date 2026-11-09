import type { Song } from '../../types';
import { createRow } from '../../services/adminService';
import { makeId } from './ui';
import { normalize } from './SuggestInput';

/**
 * Setlist placeholders that aren't real song titles (yet): "???",
 * "??? (vocal)", "新曲", "新曲（インスト）", "New song (untitled)".
 */
export const isPlaceholderTitle = (t: string) =>
  /[?？]/.test(t) || /^(新曲|new song|untitled)\s*([（(].*[)）])?$/i.test(t.trim());

/**
 * Make sure every title typed into a setlist or tracklist is in Songs,
 * like new venues are. Returns `canonical(title)`: the existing song's exact
 * title when it differs only in case, spaces or full-width letters, so
 * "hello  again" is saved as "Hello again" instead of becoming a duplicate.
 * New songs get an ID made automatically; credits and lyrics stay blank
 * for later. Placeholders like "???" or "新曲（インスト）" are left out.
 */
export async function addMissingSongs(titles: string[], songs: Song[]) {
  const byKey = new Map(songs.filter(x => x.title).map(x => [normalize(x.title), x.title]));
  const taken = new Set(songs.map(x => x.id));
  const added: Song[] = [];

  for (const raw of titles) {
    const title = raw.trim();
    const key = normalize(title);
    if (!title || byKey.has(key) || isPlaceholderTitle(title)) continue;
    const id = makeId([/^[\x20-\x7e]+$/.test(title) ? title : `song-${Date.now().toString(36)}-${added.length}`], taken);
    const song: Song = { id, title, music_by: '', lyrics_by: '', lyrics_doc_id: '' };
    await createRow('Songs', { ...song });
    taken.add(id);
    byKey.set(key, title);
    added.push(song);
  }

  const canonical = (t: string) => byKey.get(normalize(t.trim())) ?? t.trim();
  return { added, canonical };
}
