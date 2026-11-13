import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminStrings } from '../../i18n/admin';
import type { Event, SetlistEntry } from '../../types';
import { useAllSongs, useAllAlbums, useAllTracklists, useVenues } from '../../hooks/useSheetData';
import { showDupes, venueDupes } from '../../utils/duplicates';
import { getLyricsStatus, getLinkCheck, isDeadLink, getMedia, UNSORTED_VIDEOS, type LinkCheck } from '../../services/adminService';
import { LISTEN_SERVICES } from '../../../functions/lib/listen';
import { todayInJapan } from '../../utils/showDates';

/**
 * What's missing in the archive (admin home): one line per kind of gap,
 * with how many and a link to exactly those. Lines with nothing missing
 * don't show; when everything's there, it says so.
 */
export const hasJapanese = (t?: string) => /[぀-ヿ㐀-鿿]/.test(t || '');

export default function DataHealth({ s, prefix, events, setlists }: {
  s: AdminStrings; prefix: string; events: Event[]; setlists: SetlistEntry[];
}) {
  const { songs } = useAllSongs();
  const { albums } = useAllAlbums();
  const { tracklists } = useAllTracklists();
  const { venues } = useVenues();
  const [lyrics, setLyrics] = useState<Record<string, string> | null>(null);
  useEffect(() => { getLyricsStatus().then(r => setLyrics(r.status)).catch(() => setLyrics({})); }, []);
  const [links, setLinks] = useState<LinkCheck | null>(null);
  const [linksDone, setLinksDone] = useState(false);
  // Videos saved without a show (date unknown), waiting to be connected
  const [unsorted, setUnsorted] = useState(0);
  useEffect(() => { getMedia().then(m => setUnsorted(new Set(m.filter(r => r.owner === UNSORTED_VIDEOS).map(r => r.url)).size)).catch(() => {}); }, []);
  useEffect(() => { getLinkCheck().then(setLinks).catch(() => {}).finally(() => setLinksDone(true)); }, []);
  // The lyrics and link checks are slow the first time (then kept for hours)
  const checking = lyrics === null || !linksDone;

  const lines = useMemo(() => {
    const today = todayInJapan();
    const withSetlist = new Set(setlists.map(r => r.event));
    const withTracks = new Set(tracklists.map(t => t.release));
    const jaSongs = songs.filter(x => x.id && hasJapanese(x.title));
    const jaReleases = albums.filter(a => hasJapanese(a.title));
    return [
      { n: jaSongs.filter(x => !x.title_en).length, label: s.dhSongsNoEn, to: `${prefix}/songs?flag=noen` },
      { n: jaSongs.filter(x => !x.title_kana).length, label: s.dhSongsNoKana, to: `${prefix}/songs?flag=nokana` },
      { n: lyrics ? songs.filter(x => x.lyrics_doc_id && lyrics[x.lyrics_doc_id] === 'empty').length : 0, label: s.dhLyricsEmpty, to: `${prefix}/songs?flag=emptylyrics` },
      { n: jaReleases.filter(a => !a.title_en).length, label: s.dhReleasesNoEn, to: `${prefix}/releases?filter=noen` },
      { n: albums.filter(a => !a.coverUrl).length, label: s.dhReleasesNoCover, to: `${prefix}/releases?filter=nocover` },
      { n: albums.filter(a => !withTracks.has(a.title)).length, label: s.dhReleasesNoTracks, to: `${prefix}/releases?filter=notracks` },
      { n: links ? Object.values(links.videos).filter(isDeadLink).length : 0, label: s.dhDeadVideos, to: `${prefix}/videos?filter=dead` },
      { n: unsorted, label: s.dhUnsortedVideos, to: `${prefix}/videos?filter=unsorted` },
      { n: links ? albums.filter(a => [a.listenUrl, ...LISTEN_SERVICES.map(x => a.listen?.[x.key])].some(u => u && isDeadLink(links.listen[u]))).length : 0, label: s.dhDeadListen, to: `${prefix}/releases?filter=deadlink` },
      { n: events.filter(e => (e.end_date || e.date) < today && !withSetlist.has(e.id)).length, label: s.dhShowsNoSetlist, to: `${prefix}/events?filter=nosetlist` },
      { n: events.filter(e => e.setlist_added && !e.setlist_source).length, label: s.dhSetlistsNoSource, to: `${prefix}/events?filter=nosource` },
      // Possible doubles, counted as items (a pair is two)
      { n: new Set(showDupes(events.map(e => ({ ...e, venue_id: e.venue_id || '' }))).flat().map(e => e.id)).size, label: s.dhShowDupes, to: `${prefix}/events?filter=dupes` },
      { n: new Set(venueDupes(venues).flat().map(v => v.id)).size, label: s.dhVenueDupes, to: `${prefix}/venues?filter=dupes` },
    ].filter(l => l.n > 0);
  }, [songs, albums, tracklists, events, setlists, venues, lyrics, links, unsorted, prefix, s]);

  if (!songs.length || !events.length) return null;
  return (
    <section className="lu-list-group lu-health">
      <h2>{s.dhTitle}</h2>
      {lines.length === 0 && !checking ? <p className="lu-empty">{s.dhAllGood}</p> : (
        <ul className="lu-list">
          {lines.map(l => (
            <li key={l.to}>
              <Link to={l.to} className="lu-list-row">
                <strong className="lu-health-n">{l.n}</strong>
                <span className="lu-list-main"><strong>{l.label}</strong></span>
                <span className="lu-row-cta-arrow" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
          {checking && (
            <li className="lu-health-checking" role="status">
              <span className="lu-spinner" aria-hidden="true" />
              <span>{s.dhChecking}</span>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
