import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useAlbums } from '../hooks/useSheetData';

interface Props {
  locale: Locale;
}

export default function Music({ locale }: Props) {
  const s = t(locale);
  const prefix = `/${locale}`;
  const { albums, loading } = useAlbums();
  const [view, setView] = useState<'list' | 'card'>('list');

  if (loading) return null;

  return (
    <>
      <header className="news-detail-header">
        <h1 className="news-detail-title">{s.music.subtitle}</h1>
      </header>

      <div className="filters-bar">
        <div className="view-toggle">
          <button
            className={view === 'card' ? 'active' : ''}
            onClick={() => setView('card')}
            aria-pressed={view === 'card'}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/></svg>
          </button>
          <button
            className={view === 'list' ? 'active' : ''}
            onClick={() => setView('list')}
            aria-pressed={view === 'list'}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/></svg>
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <>
          {albums.map(album => (
            <Link to={`${prefix}/releases/${album.id}`} className="disco-item" key={album.id}>
              <div className="disco-cover">
                {album.coverUrl
                  ? <img src={album.coverUrl} alt={album.title} />
                  : <span>{album.title.slice(0, 2)}</span>
                }
              </div>
              <div>
                <h3>{album.title}</h3>
                <span className="year-label">{album.year}</span>
                {' · '}
                <span className="format-label">{album.type}</span>
                {album.label && <span className="year-label"> · {album.label}</span>}
              </div>
            </Link>
          ))}
        </>
      ) : (
        <div className="disco-grid">
          {albums.map((album, i) => (
            <Link
              to={`${prefix}/releases/${album.id}`}
              className="disco-card"
              key={album.id}
              style={{ transform: `rotate(${[-1.5, 1, -0.5, 1.5, -1, 0.8][i % 6]}deg)` }}
            >
              <div className="disco-card-cover">
                {album.coverUrl
                  ? <img src={album.coverUrl} alt={album.title} />
                  : <span>{album.title.slice(0, 2)}</span>
                }
              </div>
              <div className="disco-card-info">
                <h3>{album.title}</h3>
                <span>{album.year} · {album.type}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
