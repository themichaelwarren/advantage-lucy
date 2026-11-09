import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSongs, usePeople } from '../../hooks/useSheetData';
import { useAdminT } from '../../i18n/admin';
import { personName } from '../../components/admin/PeoplePicker';
import ListToolbar, { useListPrefs, SaveStateCell } from '../../components/admin/ListToolbar';
import PeoplePicker from '../../components/admin/PeoplePicker';
import { useQuickEdit } from '../../components/admin/useQuickEdit';
import { songToRow } from '../../utils/adminRows';
import type { Song } from '../../types';

type Filter = 'all' | 'has' | 'none' | 'nocredits' | 'covers';
type Sort = 'az' | 'za';
type View = 'list' | 'table';

export default function AdminSongs() {
  const { s, locale, prefix } = useAdminT();
  const { songs: loaded, loading } = useSongs();
  // Table view edits credits and original artist in place (full rows saved)
  const { items: songs, save: quickSave, rowState } = useQuickEdit<Song>(loaded, 'Songs', songToRow);
  // Songs edited here stay on screen until the filter changes, so filling in
  // "No credits" songs doesn't make a row vanish halfway through
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const save = (id: string, patch: Partial<Song>) => { setTouched(t => new Set(t).add(id)); return quickSave(id, patch); };
  const { people } = usePeople();
  const ui = useListPrefs<Filter, Sort, View>('songs', { filter: 'all', sort: 'az', view: 'list' });

  const names = useMemo(() => {
    const m = new Map(people.map(p => [p.id, personName(p, locale)]));
    return (ids?: string) => (ids || '').split(',').map(x => m.get(x.trim()) || x.trim()).filter(Boolean).join(', ');
  }, [people, locale]);

  const list = useMemo(() => {
    const q = ui.query.trim().toLowerCase();
    return songs
      .filter(x => touched.has(x.id) || ui.filter === 'all' ? true
        : ui.filter === 'has' ? !!x.lyrics_doc_id
        : ui.filter === 'none' ? !x.lyrics_doc_id
        : ui.filter === 'nocredits' ? !x.music_by && !x.lyrics_by
        : !!x.original_artist)
      .filter(x => !q || [x.title, x.original_artist || '', names(x.music_by), names(x.lyrics_by)].some(t => t.toLowerCase().includes(q)))
      .sort((a, b) => (ui.sort === 'za' ? -1 : 1) * a.title.localeCompare(b.title, locale));
  }, [songs, ui.query, ui.filter, ui.sort, locale, names, touched]);

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
        filters={[
          { value: 'all', label: s.filterAll },
          { value: 'has', label: s.filterHasLyrics },
          { value: 'none', label: s.filterNoLyrics },
          { value: 'nocredits', label: s.filterNoCredits },
          { value: 'covers', label: s.coverTag },
        ]}
        filter={ui.filter} onFilter={v => { setTouched(new Set()); ui.setFilter(v as Filter); }}
        sorts={[{ value: 'az', label: s.sortAZ }, { value: 'za', label: s.sortZA }]}
        sort={ui.sort} onSort={v => ui.setSort(v as Sort)}
        views={[{ value: 'list', label: `☰ ${s.viewList}` }, { value: 'table', label: `▦ ${s.viewTable}` }]}
        view={ui.view} onView={v => ui.setView(v as View)}
        shown={list.length} total={songs.length}
      />
      {ui.view === 'table' && list.length > 0 && (
        <div className="lu-table-wrap">
          <table className="lu-table lu-songs-table">
            <thead>
              <tr>
                <th>{s.colTitle}</th>
                <th>{s.musicBy}</th>
                <th>{s.lyricsBy}</th>
                <th>{s.originalArtist}</th>
                <th className="lu-td-center">{s.lyricsLinked}</th>
                <th aria-label={s.edit} />
              </tr>
            </thead>
            <tbody>
              {list.map(x => (
                <tr key={x.id || `title:${x.title}`}>
                  <td className="lu-td-title">{x.id ? <Link to={`${prefix}/songs/${x.id}`}>{x.title}</Link> : x.title}</td>
                  {(['music_by', 'lyrics_by'] as const).map(field => (
                    <td key={field} className="lu-td-people">
                      <PeoplePicker
                        s={s} locale={locale} id={`${x.id}-${field}`}
                        value={x[field] || ''}
                        onChange={v => x.id && save(x.id, { [field]: v })}
                        people={people}
                        personHref={pid => `${prefix}/people/${pid}`}
                      />
                    </td>
                  ))}
                  <td>
                    <input
                      className="lu-cell-input"
                      defaultValue={x.original_artist || ''}
                      placeholder="—"
                      aria-label={`${s.originalArtist}: ${x.title}`}
                      disabled={!x.id}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur(); }}
                      onBlur={e => { const v = e.target.value.trim(); if (x.id && v !== (x.original_artist || '')) save(x.id, { original_artist: v }); }}
                    />
                  </td>
                  <td className="lu-td-center">{x.lyrics_doc_id ? '✎' : <span className="lu-hint">—</span>}</td>
                  <SaveStateCell s={s} state={rowState[x.id]} editHref={`${prefix}/songs/${x.id}`} renderLink={(href, label) => <Link to={href} className="lu-btn lu-btn-quiet">{label}</Link>} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ui.view !== 'table' && <ul className="lu-list">
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
      </ul>}
      {list.length === 0 && <p className="lu-empty">{s.noResults}</p>}
    </>
  );
}
