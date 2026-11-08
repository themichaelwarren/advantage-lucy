import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAlbums } from '../../hooks/useSheetData';
import { useAdminT } from '../../i18n/admin';
import ListToolbar, { useListPrefs } from '../../components/admin/ListToolbar';

type Sort = 'newest' | 'oldest' | 'title';

export default function AdminMusic() {
  const { s, prefix } = useAdminT();
  const { albums, loading } = useAlbums();
  const ui = useListPrefs<string, Sort>('releases', { filter: 'all', sort: 'newest' });

  const typeLabel: Record<string, string> = {
    album: s.typeAlbum, lp: s.typeLp, ep: s.typeEp, single: s.typeSingle, compilation: s.typeCompilation,
  };
  // Only offer the types this discography actually has
  const types = useMemo(() => [...new Set(albums.map(a => (a.type || '').toLowerCase()).filter(Boolean))], [albums]);
  const when = (a: typeof albums[number]) => a.date || a.year || '';

  const list = useMemo(() => {
    const q = ui.query.trim().toLowerCase();
    return albums
      .filter(a => !q || [a.title, a.label, a.number, a.year].some(t => t?.toLowerCase().includes(q)))
      .filter(a => ui.filter === 'all' || (a.type || '').toLowerCase() === ui.filter)
      .sort((a, b) => ui.sort === 'title' ? a.title.localeCompare(b.title)
        : ui.sort === 'oldest' ? when(a).localeCompare(when(b)) : when(b).localeCompare(when(a)));
  }, [albums, ui.query, ui.filter, ui.sort]);

  if (loading) return <p className="lu-loading">{s.loading}</p>;

  return (
    <>
      <div className="lu-page-head">
        <h1>{s.releasesTitle} <span className="lu-count">{albums.length}</span></h1>
        <Link to={`${prefix}/releases/new`} className="lu-btn lu-btn-primary lu-btn-lg">+ {s.addRelease}</Link>
      </div>
      <ListToolbar
        s={s}
        query={ui.query} onQuery={ui.setQuery}
        filters={[{ value: 'all', label: s.filterAll }, ...types.map(t => ({ value: t, label: typeLabel[t] || t }))]}
        filter={ui.filter} onFilter={ui.setFilter}
        sorts={[{ value: 'newest', label: s.sortNewest }, { value: 'oldest', label: s.sortOldest }, { value: 'title', label: s.sortTitle }]}
        sort={ui.sort} onSort={v => ui.setSort(v as Sort)}
        shown={list.length} total={albums.length}
      />
      {list.length === 0 ? <p className="lu-empty">{s.noResults}</p> : (
        <ul className="lu-list">
          {list.map(a => (
            <li key={a.id}>
              <Link to={`${prefix}/releases/${a.id}`} className="lu-list-row">
                {a.coverUrl ? <img className="lu-thumb" src={a.coverUrl} alt="" loading="lazy" /> : <span className="lu-thumb" />}
                <span className="lu-list-main">
                  <strong>{a.title}</strong>
                  <span>{[when(a), typeLabel[a.type?.toLowerCase()] || a.type, a.label].filter(Boolean).join(' · ')}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
