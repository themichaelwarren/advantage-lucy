import { useParams, Link, Navigate } from 'react-router-dom';
import { normalize } from '../utils/text';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useAlbums, useTracklists, useSongs } from '../hooks/useSheetData';
import PageLoader from '../components/PageLoader';
import NotFound from '../components/NotFound';
import { useFitsViewport } from '../hooks/useFitsViewport';
import { linkify } from '../utils/linkify';
import PageTitle from '../components/PageTitle';
import { songTitle, localTitle, altTitle } from '../utils/songTitles';
import { LISTEN_SERVICES } from '../../functions/lib/listen';
import BackLink from '../components/BackLink';
import RelatedLinks from '../components/RelatedLinks';
import { movedTo } from '../utils/formerIds';

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
    // An old address (the id was changed in the admin) forwards to the page's new one
    const moved = movedTo(albums, id);
    if (moved) return <Navigate to={`${prefix}/releases/${moved}`} replace />;
    return <NotFound locale={locale} what={locale === 'ja' ? 'このリリース' : 'This release'} back={{ to: `${prefix}/releases`, label: s.music.subtitle }} />;
  }

  // Fall back to the other language when a translation is missing
  const description = (locale === 'ja' ? album.description_ja || album.description_en : album.description_en || album.description_ja) || '';
  const descriptionLang = (locale === 'ja' ? album.description_ja : album.description_en) ? locale : (locale === 'ja' ? 'en' : 'ja');
  const typeLabel = album.type ? s.music.types[album.type.toLowerCase()] || album.type : '';

  return (
    <article className="album-detail">
      <BackLink to={`${prefix}/releases`} label={s.music.subtitle} />
      <PageTitle title={localTitle(album, locale)} />
      {/* Wide screens: title, cover and details in a sticky panel on the left,
          tracklist (and notes) on the right. Phones: stacked in that order. */}
      <div className="album-layout">
        <aside ref={panel.ref} className="album-aside is-sticky" style={{ top: panel.top }}>
          <header className="album-detail-header">
            <h1 className="album-detail-title">{localTitle(album, locale)}</h1>
            {altTitle(album, locale) && <p className="song-alt-subtitle album-detail-alt" lang={locale === 'en' ? 'ja' : 'en'}>{altTitle(album, locale)}</p>}
            <p className="album-detail-subtitle">
              {[album.date || album.year, typeLabel, album.label].filter(Boolean).join(' · ')}
            </p>
          </header>
          <div className="album-info">
            {album.coverUrl && (
              <div className="album-artwork">
                <img src={album.coverUrl} alt={localTitle(album, locale)} />
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

              {/* One button per streaming service; the "all services" page last
                  (or on its own, as the one Listen button, when it's all there is) */}
              {album.listen ? (
                <div className="album-listen">
                  <p className="section-label">{s.music.listen}</p>
                  <ul>
                    {LISTEN_SERVICES.filter(x => album.listen?.[x.key]).map(x => (
                      <li key={x.key}><a href={album.listen![x.key]} target="_blank" rel="noopener noreferrer" className="album-listen-btn">{x.name} ↗</a></li>
                    ))}
                    {album.listenUrl && <li><a href={album.listenUrl} target="_blank" rel="noopener noreferrer" className="album-listen-btn is-more">{s.music.listenMore} ↗</a></li>}
                  </ul>
                </div>
              ) : album.listenUrl && (
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
                        ? <Link to={`${prefix}/songs/${song.id}`}>{songTitle(song, locale)}</Link>
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
          <RelatedLinks owner={`album:${album.id}`} title={s.songs.links} className="event-notes-section" />
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
