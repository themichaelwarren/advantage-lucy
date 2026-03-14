import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAlbums } from '../../hooks/useSheetData';

export default function AdminMusic() {
  const { locale = 'en' } = useParams<{ locale: string }>();
  const prefix = `/${locale}/admin`;
  const { albums, loading } = useAlbums();
  const [search, setSearch] = useState('');

  const filtered = albums
    .sort((a, b) => (b.date || b.year).localeCompare(a.date || a.year))
    .filter(album => {
      if (!search) return true;
      const hay = `${album.title} ${album.id} ${album.type} ${album.label || ''} ${album.year}`.toLowerCase();
      return hay.includes(search.toLowerCase());
    });

  if (loading) return <p>Loading...</p>;

  return (
    <>
      <div className="admin-page-header">
        <h1>Releases ({albums.length})</h1>
        <Link to={`${prefix}/releases/new`} className="admin-btn admin-btn-primary">
          + New Release
        </Link>
      </div>

      <input
        type="search"
        className="admin-search"
        placeholder="Search releases..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Desktop table */}
      <table className="admin-table admin-desktop-only">
        <thead>
          <tr>
            <th></th>
            <th>Title</th>
            <th>Year</th>
            <th>Type</th>
            <th>Label</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(album => (
            <tr key={album.id}>
              <td className="admin-td-thumb">
                {album.coverUrl
                  ? <img src={album.coverUrl} alt="" className="admin-thumb" />
                  : <span className="admin-thumb-placeholder">{album.title.slice(0, 2)}</span>
                }
              </td>
              <td>
                <Link to={`${prefix}/releases/${album.id}`}>{album.title}</Link>
              </td>
              <td>{album.year}</td>
              <td><span className="format-label">{album.type}</span></td>
              <td>{album.label || '—'}</td>
              <td className="admin-td-actions">
                <Link to={`${prefix}/releases/${album.id}`} className="admin-btn admin-btn-sm">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="admin-card-list admin-mobile-only">
        {filtered.map(album => (
          <Link
            key={album.id}
            to={`${prefix}/releases/${album.id}`}
            className="admin-event-card"
          >
            <div className="admin-event-card-header">
              <span className="admin-event-card-date">{album.year}</span>
              <span className="format-label">{album.type}</span>
            </div>
            <div className="admin-event-card-title">{album.title}</div>
            <div className="admin-event-card-meta">
              {album.label && <span>{album.label}</span>}
              {album.number && <span>{album.number}</span>}
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && <p className="admin-empty">No releases match your search.</p>}
    </>
  );
}
