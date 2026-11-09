import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { normalize } from '../utils/text';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useSongs, useTracklists, useSetlists, useEvents, useAlbums, usePeople } from '../hooks/useSheetData';
import { formatDateWithDay } from '../utils/format';
import PageLoader from '../components/PageLoader';
import { useFitsViewport } from '../hooks/useFitsViewport';
import NowPlaying from '../components/NowPlaying';

interface Props {
  locale: Locale;
}

export default function SongDetail({ locale }: Props) {
  const s = t(locale);
  const prefix = `/${locale}`;
  const { id } = useParams<{ id: string }>();
  const { songs, loading: songsLoading } = useSongs();
  // Side panel only sticks when it fits on screen (otherwise its bottom would be unreachable)
  const panel = useFitsViewport<HTMLElement>();
  const { tracklists, loading: tracklistsLoading } = useTracklists();
  const { setlists, loading: setlistsLoading } = useSetlists();
  const { events } = useEvents();
  const { albums } = useAlbums();
  const { people } = usePeople();

  const song = songs.find(s => s.id === id);

  // Resolve comma-separated People IDs to display names
  const resolveNames = (ids: string | undefined) => {
    if (!ids) return undefined;
    return ids.split(',').filter(Boolean).map(pid => {
      const p = people.find(p => p.id === pid.trim());
      if (!p) return pid;
      if (locale === 'ja') {
        return [p.name_family_ja, p.name_given_ja].filter(Boolean).join(' ') ||
               [p.name_family_en, p.name_given_en].filter(Boolean).join(' ');
      }
      return [p.name_given_en, p.name_family_en].filter(Boolean).join(' ') ||
             [p.name_given_ja, p.name_family_ja].filter(Boolean).join(' ');
    }).join(', ');
  };
  const eventsWithSetlist = useMemo(
    () => new Set(setlists.map(s => s.event)),
    [setlists]
  );

  // Fetch lyrics from Google Doc if available
  const [lyrics, setLyrics] = useState<string | null>(null);
  useEffect(() => {
    if (!song?.lyrics_doc_id) return;
    fetch(`/api/docs/${song.lyrics_doc_id}`)
      .then(r => r.json())
      .then(data => setLyrics(data.text || null))
      .catch(() => setLyrics(null));
  }, [song?.lyrics_doc_id]);

  if (songsLoading) return <PageLoader locale={locale} />;

  if (!song) {
    return (
      <div className="text-center mt-2">
        <p style={{ background: 'var(--surface)', padding: '2rem', fontSize: '1.2rem' }}>
          {s.songs.noSong}
        </p>
        <div className="mt-1">
          <Link to={`${prefix}/releases`} className="tag">
            <span>← {s.music.subtitle}</span>
          </Link>
        </div>
      </div>
    );
  }

  // Albums this song appears on (via Tracklists)
  const albumAppearances = !tracklistsLoading
    ? tracklists
        .filter(t => normalize(t.title || '') === normalize(song.title))
        .map(t => {
          const album = albums.find(a => a.title === t.release);
          return album ? { album, track: t.track } : null;
        })
        .filter(Boolean) as { album: typeof albums[0]; track: number }[]
    : [];

  // Events where this song was performed (via Setlists)
  const eventAppearances = !setlistsLoading
    ? setlists
        .filter(sl => normalize(sl.song || '') === normalize(song.title))
        .map(sl => {
          const event = events.find(e => e.id === sl.event);
          return event ? { event, set: sl.set, order: sl.order } : null;
        })
        .filter(Boolean) as { event: typeof events[0]; set: string; order: number }[]
    : [];

  // Sort events by date descending
  eventAppearances.sort((a, b) => b.event.date.localeCompare(a.event.date));

  return (
    <article className="song-detail">
      <NowPlaying title={song.title} locale={locale} watch=".song-head .song-detail-title" />
      {/* Wide screens: title, credits and releases in a sticky panel on the
          left, lyrics on the right. Phones: title, credits, lyrics, releases. */}
      <div className="song-layout">
        <aside ref={panel.ref} className="song-aside is-sticky" style={{ top: panel.top }}>
          <div className="song-head">
            <header className="song-detail-header">
              <h1 className="song-detail-title">{song.title}</h1>
              {song.original_artist && (
                <p className="song-cover-of">{s.songs.coverOf.replace('{artist}', song.original_artist)}</p>
              )}
            </header>
            {(song.music_by || song.lyrics_by) && (
              <dl className="event-meta">
                {song.lyrics_by && (
                  <>
                    <dt>{s.songs.lyricsBy}</dt>
                    <dd>{resolveNames(song.lyrics_by)}</dd>
                  </>
                )}
                {song.music_by && (
                  <>
                    <dt>{s.songs.musicBy}</dt>
                    <dd>{resolveNames(song.music_by)}</dd>
                  </>
                )}
              </dl>
            )}

          </div>
          <div className="song-appears">
            {albumAppearances.length > 0 && (
              <section className="mb-2">
                <h2 className="section-label">{s.songs.appearsOn}</h2>
                <div className="song-album-list">
                  {albumAppearances.map(({ album, track }) => (
                    <Link to={`${prefix}/releases/${album.id}`} className="song-album-item" key={album.id}>
                      <div className="song-album-cover">
                        {album.coverUrl
                          ? <img src={album.coverUrl} alt={album.title} />
                          : <span>{album.title.slice(0, 2)}</span>
                        }
                      </div>
                      <div className="song-album-body">
                        <span className="song-album-title">{album.title}</span>
                        <span className="song-album-meta">
                          <span>{album.year}</span>
                          <span className="event-detail-sep">·</span>
                          <span>{locale === 'ja' ? `${track}曲目` : `Track ${track}`}</span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

          </div>
        </aside>

        <section className="song-lyrics">
          <h2 className="section-label">{s.songs.lyrics}</h2>
            {lyrics ? (
              <div className="lyrics-block">
                {lyrics.split('\n\n').map((verse, vi) => (
                  <p key={vi} className="lyrics-verse">
                    {verse.split('\n').map((line, li) => (
                      <span key={li}>{line}<br /></span>
                    ))}
                  </p>
                ))}
              </div>
            ) : (
              <p className="lyrics-placeholder">{s.songs.noLyrics}</p>
            )}
        </section>
      </div>

      {eventAppearances.length > 0 && (
        <section className="mb-2">
          <div className="section-header">
            <h2 className="section-label">{s.songs.performedAt}</h2>
            <span className="section-count">{eventAppearances.length}{locale === 'ja' ? '件' : ''}</span>
          </div>
          <ul className="show-list">
            {eventAppearances.map(({ event }) => {
              const title = locale === 'ja' ? event.title_ja || event.title_en : event.title_en || event.title_ja;
              const venue = locale === 'ja' ? event.venue_ja || event.venue_en : event.venue_en || event.venue_ja;
              const area = locale === 'ja' ? event.city_ja || event.city_en : event.city_en || event.city_ja;
              return (
                <li key={event.id}>
                  <Link to={`${prefix}/events/${event.id}`} className="show-row">
                    <time dateTime={event.date}>{formatDateWithDay(event.date, locale)}</time>
                    <span className="show-row-main">
                      <strong>{title || venue}</strong>
                      <span>{[title ? venue : '', area].filter(Boolean).join(' · ')}</span>
                    </span>
                    {eventsWithSetlist.has(event.id) && <span className="show-tag">♪ {locale === 'ja' ? 'セトリ' : 'Setlist'}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-2">
        <Link to={`${prefix}/releases`} className="tag">
          <span>← {s.music.subtitle}</span>
        </Link>
      </div>
    </article>
  );
}
