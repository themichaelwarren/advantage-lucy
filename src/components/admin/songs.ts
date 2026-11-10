import type { SetlistEntry, Song, TracklistEntry } from '../../types';
import { createRow, replaceRows, getMedia, saveMedia } from '../../services/adminService';
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
    const song: Song = { id, title, music_by: '', lyrics_by: '', lyrics_doc_id: '', original_artist: '' };
    await createRow('Songs', { ...song });
    taken.add(id);
    byKey.set(key, title);
    added.push(song);
  }

  const canonical = (t: string) => byKey.get(normalize(t.trim())) ?? t.trim();
  return { added, canonical };
}

/**
 * Change a song title everywhere it's used: every setlist and tracklist
 * row whose title matches `from` (ignoring case, spaces, full-width) gets
 * `to`. Setlists and tracklists are rewritten per show / per release, with
 * all their other rows unchanged. Returns how many shows and releases changed.
 */
export async function retitleEverywhere(from: string, to: string, setlists: SetlistEntry[], tracklists: TracklistEntry[]) {
  const key = normalize(from);
  const title = to.trim();
  const events = [...new Set(setlists.filter(r => normalize(r.song || '') === key).map(r => r.event))];
  for (const ev of events) {
    await replaceRows('Setlists', ev, setlists.filter(r => r.event === ev).map(r => ({
      event: r.event, song: normalize(r.song || '') === key ? title : r.song,
      set: r.set, order: String(r.order), notes: r.notes || '', status: r.status || '',
    })));
  }
  const releases = [...new Set(tracklists.filter(t => normalize(t.title || '') === key).map(t => t.release))];
  for (const rel of releases) {
    await replaceRows('Tracklists', rel, tracklists.filter(t => t.release === rel).map(t => ({
      release: t.release, track: String(t.track), title: normalize(t.title || '') === key ? title : t.title,
    })));
  }
  // Video start times name the song too (admin-only Media tab)
  try {
    const media = await getMedia();
    const owners = [...new Set(media.filter(r => r.kind === 'part' && normalize(r.song) === key).map(r => r.owner))];
    for (const owner of owners) {
      await saveMedia(owner, media.filter(r => r.owner === owner).map(r => (r.kind === 'part' && normalize(r.song) === key ? { ...r, song: title } : r)));
    }
  } catch { /* no Media tab yet, or offline: setlists and releases are what matter */ }
  return { shows: events.length, releases: releases.length };
}
