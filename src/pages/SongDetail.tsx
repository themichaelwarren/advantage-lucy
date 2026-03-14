import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useSongs, useTracklists, useSetlists, useEvents, useAlbums } from '../hooks/useSheetData';
import { formatDate, getEventTitle } from '../utils/format';

interface Props {
  locale: Locale;
}

export default function SongDetail({ locale }: Props) {
  const s = t(locale);
  const prefix = `/${locale}`;
  const { id } = useParams<{ id: string }>();
  const { songs, loading: songsLoading } = useSongs();
  const { tracklists, loading: tracklistsLoading } = useTracklists();
  const { setlists, loading: setlistsLoading } = useSetlists();
  const { events } = useEvents();
  const { albums } = useAlbums();

  const song = songs.find(s => s.id === id);

  // Fetch lyrics from Google Doc if available
  const [lyrics, setLyrics] = useState<string | null>(null);
  useEffect(() => {
    if (!song?.lyrics_doc_id) return;
    fetch(`/api/docs/${song.lyrics_doc_id}`)
      .then(r => r.json())
      .then(data => setLyrics(data.text || null))
      .catch(() => setLyrics(null));
  }, [song?.lyrics_doc_id]);

  if (songsLoading) return null;

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
        .filter(t => t.title === song.title)
        .map(t => {
          const album = albums.find(a => a.title === t.release);
          return album ? { album, track: t.track } : null;
        })
        .filter(Boolean) as { album: typeof albums[0]; track: number }[]
    : [];

  // Events where this song was performed (via Setlists)
  const eventAppearances = !setlistsLoading
    ? setlists
        .filter(sl => sl.song === song.title)
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
      <div className="page-title">
        <h1><span>{song.title}</span></h1>
      </div>

      {(song.music_by || song.lyrics_by) && (
        <dl className="event-meta">
          {song.music_by && (
            <>
              <dt>{s.songs.musicBy}</dt>
              <dd>{song.music_by}</dd>
            </>
          )}
          {song.lyrics_by && (
            <>
              <dt>{s.songs.lyricsBy}</dt>
              <dd>{song.lyrics_by}</dd>
            </>
          )}
        </dl>
      )}

      {lyrics && (
        <section className="mb-2">
          <h2 className="section-label">{s.songs.lyrics}</h2>
          <div className="lyrics-block">
            {lyrics.split('\n').map((line, i) => (
              <span key={i}>{line}<br /></span>
            ))}
          </div>
        </section>
      )}

      {albumAppearances.length > 0 && (
        <section className="mb-2">
          <h2 className="section-label">{s.songs.appearsOn}</h2>
          {albumAppearances.map(({ album, track }) => (
            <div className="disco-item" key={album.id}>
              <div className="disco-cover">
                {album.coverUrl
                  ? <img src={album.coverUrl} alt={album.title} />
                  : <span>{album.title.slice(0, 2)}</span>
                }
              </div>
              <div>
                <h3><Link to={`${prefix}/releases/${album.id}`}>{album.title}</Link></h3>
                <span className="year-label">{album.year}</span>
                {' '}
                <span className="format-label">Track {track}</span>
              </div>
            </div>
          ))}
        </section>
      )}

      {eventAppearances.length > 0 && (
        <section className="mb-2">
          <h2 className="section-label">{s.songs.performedAt}</h2>
          {eventAppearances.map(({ event }) => {
            const title = getEventTitle(event, locale);
            const venue = locale === 'ja' ? event.venue_ja : event.venue_en;
            const dateStr = formatDate(event.date, locale);
            return (
              <div className="event-card" key={event.id}>
                <div className="event-card-date">{dateStr}</div>
                <h3 className="event-card-title">
                  <Link to={`${prefix}/events/${event.id}`}>{title}</Link>
                </h3>
                <div className="event-card-venue">{venue}</div>
              </div>
            );
          })}
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
