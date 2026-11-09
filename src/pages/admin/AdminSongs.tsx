import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSongs, usePeople } from '../../hooks/useSheetData';
import { useAdminT } from '../../i18n/admin';
import { personName } from '../../components/admin/PeoplePicker';
import ListToolbar, { useListPrefs } from '../../components/admin/ListToolbar';

type Filter = 'all' | 'has' | 'none';
type Sort = 'az' | 'za';

export default function AdminSongs() {
  const { s, locale, prefix } = useAdminT();
  const { songs, loading } = useSongs();
  const { people } = usePeople();
  const ui = useListPrefs<Filter, Sort>('songs', { filter: 'all', sort: 'az' });

  const names = useMemo(() => {
    const m = new Map(people.map(p => [p.id, personName(p, locale)]));
    return (ids?: string) => (ids || '').split(',').map(x => m.get(x.trim()) || x.trim()).filter(Boolean).join(', ');
  }, [people, locale]);

  const list = useMemo(() => {
    const q = ui.query.trim().toLowerCase();
    return songs
      .filter(x => ui.filter === 'all' ? true : ui.filter === 'has' ? !!x.lyrics_doc_id : !x.lyrics_doc_id)
      .filter(x => !q || [x.title, x.original_artist || '', names(x.music_by), names(x.lyrics_by)].some(t => t.toLowerCase().includes(q)))
      .sort((a, b) => (ui.sort === 'za' ? -1 : 1) * a.title.localeCompare(b.title, locale));
  }, [songs, ui.query, ui.filter, ui.sort, locale, names]);

  if (loading) return <p className="lu-loading">{s.loading}</p>;

  return (
    <>
      <div className="lu-page-head">
        <h1>{s.songsTitle} <span className="lu-count">{songs.length}</span></h1>
        <Link to={`${prefix}/songs/new`} className="lu-btn lu-btn-primary lu-btn-lg">+ {s.addSongItem}</Link>
      </div>
      <ListToolbar
        s={s}
        query={ui.query} onQuery={ui.setQuery}
        filters={[{ value: 'all', label: s.filterAll }, { value: 'has', label: s.filterHasLyrics }, { value: 'none', label: s.filterNoLyrics }]}
        filter={ui.filter} onFilter={v => ui.setFilter(v as Filter)}
        sorts={[{ value: 'az', label: s.sortAZ }, { value: 'za', label: s.sortZA }]}
        sort={ui.sort} onSort={v => ui.setSort(v as Sort)}
        shown={list.length} total={songs.length}
      />
      <ul className="lu-list">
        {list.map(x => {
          const credits = [names(x.music_by), names(x.lyrics_by)].filter(Boolean);
          return (
            <li key={x.id || `title:${x.title}`}>
              <Link to={x.id ? `${prefix}/songs/${x.id}` : prefix} className="lu-list-row">
                <span className="lu-list-main">
                  <strong>{x.title}</strong>
                  {(x.original_artist || credits.length > 0) && (
                    <span>{[x.original_artist && s.coverOf.replace('{artist}', x.original_artist), ...new Set(credits)].filter(Boolean).join(' · ')}</span>
                  )}
                </span>
                <span className="lu-list-tags">
                  {!x.id && <span className="lu-tag is-todo">⚠ {s.songNoId}</span>}
                  {x.lyrics_doc_id
                    ? <span className="lu-tag is-ok">✎ {s.lyricsLinked}</span>
                    : <span className="lu-tag is-todo">{s.lyricsMissing}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="lu-empty">{s.noResults}</p>}
    </>
  );
}
