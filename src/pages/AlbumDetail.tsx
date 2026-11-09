import { useParams, Link } from 'react-router-dom';
import { normalize } from '../utils/text';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useAlbums, useTracklists, useSongs } from '../hooks/useSheetData';
import PageLoader from '../components/PageLoader';
import { useFitsViewport } from '../hooks/useFitsViewport';
import { linkify } from '../utils/linkify';

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
  // Side panel only sticks when it fits on screen (otherwise its bottom would be unreachable)
  const panel = useFitsViewport<HTMLElement>();

  if (albumsLoading) return <PageLoader locale={locale} />;

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

  // Fall back to the other language when a translation is missing
  const description = (locale === 'ja' ? album.description_ja || album.description_en : album.description_en || album.description_ja) || '';
  const descriptionLang = (locale === 'ja' ? album.description_ja : album.description_en) ? locale : (locale === 'ja' ? 'en' : 'ja');
  const typeLabel = album.type ? s.music.types[album.type.toLowerCase()] || album.type : '';

  return (
    <article className="album-detail">
      {/* Wide screens: title, cover and details in a sticky panel on the left,
          tracklist (and notes) on the right. Phones: stacked in that order. */}
      <div className="album-layout">
        <aside ref={panel.ref} className="album-aside is-sticky" style={{ top: panel.top }}>
          <header className="album-detail-header">
            <h1 className="album-detail-title">{album.title}</h1>
            <p className="album-detail-subtitle">
              {[album.date || album.year, typeLabel, album.label].filter(Boolean).join(' · ')}
            </p>
          </header>
          <div className="album-info">
            {album.coverUrl && (
              <div className="album-artwork">
                <img src={album.coverUrl} alt={album.title} />
              </div>
            )}

            <div className="album-meta-col">
              <dl className="event-meta">
                <dt>{s.music.released}</dt>
                <dd className="is-number">{album.date || album.year}</dd>

                {album.type && (
                  <>
                    <dt>{s.music.type}</dt>
                    <dd>{typeLabel}</dd>
                  </>
                )}

                {album.number && (
                  <>
                    <dt>{s.music.catalogNumber}</dt>
                    <dd className="is-number">{album.number}</dd>
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
        </aside>

        <div className="album-main">
          {!tracklistsLoading && tracks.length > 0 && (
            <section className="mb-2">
              <h2 className="section-label">{s.music.tracklist}</h2>
              <ol className="tracklist">
                {tracks.map(tr => {
                  const song = songs.find(x => x.id && normalize(x.title || '') === normalize(tr.title || ''));
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
            <section className="event-notes-section">
              <h2 className="section-label">{s.music.notes}</h2>
              <div className="event-notes" lang={descriptionLang}>
                {description.split(/\n\s*\n/).map((para, i) => <p key={i}>{linkify(para.trim())}</p>)}
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="mt-2">
        <Link to={`${prefix}/releases`} className="tag">
          <span>← {s.music.subtitle}</span>
        </Link>
      </div>
    </article>
  );
}
