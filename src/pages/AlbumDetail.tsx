import { useParams, Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useAlbums, useTracklists, useSongs } from '../hooks/useSheetData';

interface Props {
  locale: Locale;
}

export default function AlbumDetail({ locale }: Props) {
  const s = t(locale);
  const prefix = `/${locale}`;
  const { id } = useParams<{ id: string }>();
  const { albums, loading: albumsLoading } = useAlbums();
  const { tracklists, loading: tracklistsLoading } = useTracklists();
  const { songs } = useSongs();
  const album = albums.find(a => a.id === id);

  if (albumsLoading) return null;

  const tracks = album
    ? tracklists.filter(t => t.release === album.title).sort((a, b) => a.track - b.track)
    : [];

  if (!album) {
    return (
      <div className="text-center mt-2">
        <p style={{ background: 'var(--surface)', padding: '2rem', fontSize: '1.2rem' }}>
          {locale === 'en' ? 'Album not found.' : 'アルバムが見つかりません。'}
        </p>
        <div className="mt-1">
          <Link to={`${prefix}/releases`} className="tag">
            <span>← {s.music.subtitle}</span>
          </Link>
        </div>
      </div>
    );
  }

  const description = locale === 'ja' ? album.description_ja : album.description_en;

  return (
    <article className="album-detail">
      <div className="page-title">
        <h1><span>{album.title}</span></h1>
      </div>

      <div className="album-info">
        {album.coverUrl && (
          <div className="album-artwork">
            <img src={album.coverUrl} alt={album.title} />
          </div>
        )}

        <div className="album-meta-col">
          <dl className="event-meta">
            <dt>{s.music.released}</dt>
            <dd>{album.date || album.year}</dd>

            {album.type && (
              <>
                <dt>{s.music.type}</dt>
                <dd>{album.type}</dd>
              </>
            )}

            {album.number && (
              <>
                <dt>{s.music.catalogNumber}</dt>
                <dd>{album.number}</dd>
              </>
            )}

            {album.format && (
              <>
                <dt>{s.music.format}</dt>
                <dd>{album.format}</dd>
              </>
            )}

            {album.label && (
              <>
                <dt>{s.music.label}</dt>
                <dd>{album.label}</dd>
              </>
            )}
          </dl>

          {album.listenUrl && (
            <div className="mt-1">
              <a href={album.listenUrl} target="_blank" rel="noopener noreferrer" className="ticket-btn">
                {s.music.listen} →
              </a>
            </div>
          )}
        </div>
      </div>

      {!tracklistsLoading && tracks.length > 0 && (
        <section className="mb-2">
          <h2 className="section-label">{s.music.tracklist}</h2>
          <ol className="tracklist">
            {tracks.map(tr => {
              const song = songs.find(s => s.title === tr.title);
              return (
                <li key={tr.track} value={tr.track}>
                  {song
                    ? <Link to={`${prefix}/songs/${song.id}`}>{tr.title}</Link>
                    : tr.title
                  }
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {description && (
        <div className="prose">
          <p>{description}</p>
        </div>
      )}

      <div className="mt-2">
        <Link to={`${prefix}/releases`} className="tag">
          <span>← {s.music.subtitle}</span>
        </Link>
      </div>
    </article>
  );
}
