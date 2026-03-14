import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSongs, usePeople } from '../../hooks/useSheetData';
import type { Person } from '../../types';

function personLabel(ids: string | undefined, peopleMap: Map<string, Person>): string {
  if (!ids) return '—';
  return ids.split(',').filter(Boolean).map(pid => {
    const p = peopleMap.get(pid.trim());
    if (!p) return pid;
    return [p.name_given_en, p.name_family_en].filter(Boolean).join(' ') || pid;
  }).join(', ');
}

export default function AdminSongs() {
  const { locale = 'en' } = useParams<{ locale: string }>();
  const prefix = `/${locale}/admin`;
  const { songs, loading } = useSongs();
  const { people } = usePeople();
  const [search, setSearch] = useState('');

  const peopleMap = useMemo(
    () => new Map(people.map(p => [p.id, p])),
    [people]
  );

  const filtered = songs
    .sort((a, b) => a.title.localeCompare(b.title))
    .filter(song => {
      if (!search) return true;
      const hay = `${song.title} ${song.id} ${song.music_by || ''} ${song.lyrics_by || ''}`.toLowerCase();
      return hay.includes(search.toLowerCase());
    });

  if (loading) return <p>Loading...</p>;

  return (
    <>
      <div className="admin-page-header">
        <h1>Songs ({songs.length})</h1>
        <Link to={`${prefix}/songs/new`} className="admin-btn admin-btn-primary">
          + New Song
        </Link>
      </div>

      <input
        type="search"
        className="admin-search"
        placeholder="Search songs..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Desktop table */}
      <table className="admin-table admin-desktop-only">
        <thead>
          <tr>
            <th>Title</th>
            <th>Music by</th>
            <th>Lyrics by</th>
            <th>Lyrics</th>
            <th>ID</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(song => (
            <tr key={song.id}>
              <td>
                <Link to={`${prefix}/songs/${song.id}`}>{song.title}</Link>
              </td>
              <td>{personLabel(song.music_by, peopleMap)}</td>
              <td>{personLabel(song.lyrics_by, peopleMap)}</td>
              <td>
                {song.lyrics_doc_id ? (
                  <a
                    href={`https://docs.google.com/document/d/${song.lyrics_doc_id}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-lyrics-icon has-doc"
                    title="Open lyrics doc"
                    onClick={e => e.stopPropagation()}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM7 13h10v2H7v-2zm0 4h7v2H7v-2zm0-8h3v2H7V9z"/>
                    </svg>
                  </a>
                ) : (
                  <span className="admin-lyrics-icon" title="No lyrics doc">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM7 13h10v2H7v-2zm0 4h7v2H7v-2zm0-8h3v2H7V9z"/>
                    </svg>
                  </span>
                )}
              </td>
              <td className="admin-td-id">{song.id}</td>
              <td className="admin-td-actions">
                <Link to={`${prefix}/songs/${song.id}`} className="admin-btn admin-btn-sm">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="admin-card-list admin-mobile-only">
        {filtered.map(song => (
          <Link
            key={song.id}
            to={`${prefix}/songs/${song.id}`}
            className="admin-event-card"
          >
            <div className="admin-event-card-title">
              {song.title}
              {song.lyrics_doc_id && (
                <span className="admin-lyrics-icon has-doc" style={{ marginLeft: 6, verticalAlign: 'middle' }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM7 13h10v2H7v-2zm0 4h7v2H7v-2zm0-8h3v2H7V9z"/>
                  </svg>
                </span>
              )}
            </div>
            <div className="admin-event-card-meta">
              {song.music_by && <span>♪ {personLabel(song.music_by, peopleMap)}</span>}
              {song.lyrics_by && <span>✎ {personLabel(song.lyrics_by, peopleMap)}</span>}
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && <p className="admin-empty">No songs match your search.</p>}
    </>
  );
}
