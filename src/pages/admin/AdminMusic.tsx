import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAlbums, useTracklists, useAllSetlists } from '../../hooks/useSheetData';
import { useAdminT } from '../../i18n/admin';
import type { Album } from '../../types';
import ListToolbar, { useListPrefs } from '../../components/admin/ListToolbar';
import { normalize } from '../../components/admin/SuggestInput';
import { localTitle, altTitle, songSortKey, songSearchText, songQuery } from '../../utils/songTitles';

/**
 * Releases: a cover list, or a table to sort and check what's missing.
 * In the table, click a heading to sort by it, again to reverse; the sort
 * is shared with the list's sort menu, and both are remembered.
 */
type Col = 'date' | 'title' | 'type' | 'label' | 'tracks' | 'live';
type Sort = Col | `${Col}-desc`;
type View = 'list' | 'table';
type Missing = 'cover' | 'tracks' | 'link' | 'notes';
const MISSING: Missing[] = ['cover', 'tracks', 'notes', 'link'];
const COLS: Col[] = ['date', 'title', 'type', 'label', 'tracks', 'live'];
// Formats in the order a discography usually reads
const TYPE_ORDER = ['album', 'lp', 'ep', 'single', 'compilation'];
// The sheet sometimes says "comp"
const typeOf = (a: Album) => { const t = (a.type || '').toLowerCase(); return t === 'comp' ? 'compilation' : t; };

interface Row {
  a: Album;
  when: string;
  type: string;
  tracks: number;
  live: number;          // tracks played at least once at a show
  missing: Missing[];
}

export default function AdminMusic() {
  const { s, locale, prefix } = useAdminT();
  const navigate = useNavigate();
  const { albums, loading } = useAlbums();
  const { tracklists } = useTracklists();
  const { setlists } = useAllSetlists();
  const ui = useListPrefs<string, Sort, View>('releases-v2', { filter: 'all', sort: 'date-desc', view: 'list' });
  const sort: Sort = COLS.some(c => ui.sort === c || ui.sort === `${c}-desc`) ? ui.sort : 'date-desc';
  const col = sort.replace(/-desc$/, '') as Col;
  const desc = sort.endsWith('-desc');

  const typeLabel: Record<string, string> = {
    album: s.typeAlbum, lp: s.typeLp, ep: s.typeEp, single: s.typeSingle, compilation: s.typeCompilation,
  };
  const missingLabel: Record<Missing, string> = {
    cover: s.relNoCover, tracks: s.relNoTracks, link: s.relNoLink, notes: s.relNoNotes,
  };
  const markLabel: Record<Missing, string> = {
    cover: s.relMarkCover, tracks: s.relMarkTracks, link: s.relMarkLink, notes: s.relMarkNotes,
  };
  const hasLabel: Record<Missing, string> = {
    cover: s.artwork, tracks: s.secTracklist, link: s.listenUrl, notes: s.relHasNotes,
  };
  // Only offer the types this discography actually has
  const types = useMemo(
    () => [...new Set(albums.map(typeOf).filter(Boolean))]
      .sort((x, y) => (TYPE_ORDER.indexOf(x) + 1 || 99) - (TYPE_ORDER.indexOf(y) + 1 || 99)),
    [albums],
  );

  const rows = useMemo<Row[]>(() => {
    const played = new Set(setlists.map(r => normalize(r.song || '')));
    return albums.map(a => {
      const tl = tracklists.filter(t => t.release === a.title);
      const missing: Missing[] = [];
      if (!a.coverUrl) missing.push('cover');
      if (tl.length === 0) missing.push('tracks');
      if (!a.listenUrl && !a.listen) missing.push('link');
      if (!a.description_en && !a.description_ja) missing.push('notes');
      return {
        a, when: a.date || a.year || '', type: typeOf(a),
        tracks: tl.length,
        live: new Set(tl.filter(t => played.has(normalize(t.title))).map(t => normalize(t.title))).size,
        missing,
      };
    });
  }, [albums, tracklists, setlists]);

  const list = useMemo(() => {
    const q = ui.query.trim().toLowerCase();
    const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
    const typePos = (t: string) => TYPE_ORDER.indexOf(t) + 1 || 99;
    const dir = desc ? -1 : 1;
    const byDate = (x: Row, y: Row) => x.when.localeCompare(y.when);
    return rows
      .filter(r => !q || songSearchText(r.a).includes(songQuery(ui.query)) || [r.a.label, r.a.number, r.a.format, r.when, typeLabel[r.type]].some(t => t?.toLowerCase().includes(q)))
      .filter(r => ui.filter === 'all' || (ui.filter === 'todo' ? r.missing.length > 0 : r.type === ui.filter))
      .sort((x, y) => {
        switch (col) {
          case 'title': return dir * collator.compare(songSortKey(x.a, locale), songSortKey(y.a, locale));
          case 'type': return dir * (typePos(x.type) - typePos(y.type)) || byDate(x, y);
          // Empty labels last, whichever way
          case 'label': return (!x.a.label ? 1 : 0) - (!y.a.label ? 1 : 0) || dir * collator.compare(x.a.label || '', y.a.label || '') || byDate(x, y);
          case 'tracks': return dir * (x.tracks - y.tracks) || byDate(x, y);
          case 'live': return dir * (x.live - y.live) || byDate(x, y);
          default: return dir * byDate(x, y);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, ui.query, ui.filter, col, desc, locale]);

  if (loading) return <p className="lu-loading">{s.loading}</p>;

  // Dates, counts: biggest/newest first on the first click; words: A–Z
  const sortBy = (c: Col) => ui.setSort(
    col === c ? (desc ? c : `${c}-desc`) : (['date', 'tracks', 'live'].includes(c) ? `${c}-desc` : c),
  );
  const head = (c: Col, label: string, className = '') => (
    <th className={className} aria-sort={col === c ? (desc ? 'descending' : 'ascending') : undefined}>
      <button type="button" className={`lu-sort${col === c ? ' is-on' : ''}`} onClick={() => sortBy(c)}>
        {label}<span aria-hidden="true">{col === c ? (desc ? ' ↓' : ' ↑') : ''}</span>
      </button>
    </th>
  );
  const sorts = [
    { value: 'date-desc', label: s.sortNewest },
    { value: 'date', label: s.sortOldest },
    { value: 'title', label: s.sortTitle },
    { value: 'type', label: s.relSortType },
    { value: 'label', label: s.relSortLabel },
    { value: 'tracks-desc', label: s.relSortTracks },
  ];
  // A heading click can pick a sort the menu doesn't list (Z–A, fewest tracks…): show it too
  if (!sorts.some(o => o.value === sort)) {
    const name: Record<Col, string> = { date: s.releaseDate, title: s.colTitle, type: s.releaseType, label: s.label, tracks: s.relColTracks, live: s.relColLive };
    sorts.push({ value: sort, label: `${name[col]} ${desc ? '↓' : '↑'}` });
  }
  const todoCount = rows.filter(r => r.missing.length > 0).length;
  const sub = (a: Album) => [a.number, a.format].filter(Boolean).join(' · ');

  return (
    <>
      <div className="lu-page-head">
        <h1>{s.releasesTitle} <span className="lu-count">{albums.length}</span></h1>
        <Link to={`${prefix}/releases/new`} className="lu-btn lu-btn-primary lu-btn-lg">+ {s.addRelease}</Link>
      </div>
      <ListToolbar
        s={s}
        query={ui.query} onQuery={ui.setQuery}
        filters={[
          { value: 'all', label: s.filterAll },
          ...types.map(t => ({ value: t, label: typeLabel[t] || t })),
          ...(todoCount ? [{ value: 'todo', label: `${s.relFilterTodo} ${todoCount}` }] : []),
        ]}
        filter={ui.filter} onFilter={ui.setFilter}
        sorts={sorts}
        sort={sort} onSort={v => ui.setSort(v as Sort)}
        views={[{ value: 'list', label: `☰ ${s.viewList}` }, { value: 'table', label: `▦ ${s.viewTable}` }]}
        view={ui.view} onView={v => ui.setView(v as View)}
        shown={list.length} total={albums.length}
      />
      {list.length === 0 ? <p className="lu-empty">{s.noResults}</p> : ui.view === 'table' ? (
        <div className="lu-table-wrap">
          <table className="lu-table lu-rel-grid">
            <thead>
              <tr>
                {head('title', s.colTitle)}
                {head('type', s.releaseType)}
                {head('date', s.releaseDate)}
                {head('label', s.label)}
                {head('tracks', s.relColTracks, 'lu-td-num')}
                {head('live', s.relColLive, 'lu-td-num')}
                <th>{s.relColCheck}</th>
              </tr>
            </thead>
            <tbody>
              {list.map(r => {
                const href = `${prefix}/releases/${r.a.id}`;
                return (
                  <tr key={r.a.id} onClick={e => { if (!(e.target as HTMLElement).closest('a')) navigate(href); }}>
                    <td>
                      <div className="lu-rel-title">
                        {r.a.coverUrl ? <img className="lu-rel-cover" src={r.a.coverUrl} alt="" loading="lazy" /> : <span className="lu-rel-cover" aria-hidden="true" />}
                        <span className="lu-rel-name">
                          <Link to={href}>{localTitle(r.a, locale)}</Link>
                          {altTitle(r.a, locale) && <span className="lu-sg-alt">{altTitle(r.a, locale)}</span>}
                          <span className="lu-rel-sub">
                            <span className="lu-rel-mdate">{r.when}</span>
                            {sub(r.a)}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td><span className={`lu-rel-type is-${r.type || 'none'}`}>{typeLabel[r.type] || r.a.type || '—'}</span></td>
                    <td className="lu-sg-date">{r.when || <span className="lu-sg-none">—</span>}</td>
                    <td className="lu-rel-label">{r.a.label || <span className="lu-sg-none">—</span>}</td>
                    <td className="lu-td-num">{r.tracks || <span className="lu-sg-none">0</span>}</td>
                    <td className="lu-td-num" title={r.tracks ? s.relLiveHint.replace('{n}', String(r.live)).replace('{total}', String(r.tracks)) : undefined}>
                      {r.tracks ? <span className="lu-rel-live"><span className="lu-rel-bar" style={{ ['--p' as string]: `${(r.live / r.tracks) * 100}%` }} />{r.live}/{r.tracks}</span> : <span className="lu-sg-none">—</span>}
                    </td>
                    <td className="lu-rel-check">
                      {/* Same four marks in the same places on every row, so gaps read down the column */}
                      <span className="lu-rel-marks" aria-label={r.missing.length ? r.missing.map(m => missingLabel[m]).join('、') : s.relComplete}>
                        {MISSING.map(m => {
                          const has = !r.missing.includes(m);
                          const tip = has ? hasLabel[m] : missingLabel[m];
                          return m === 'link' && has
                            ? <a key={m} className="lu-rel-mark is-on" href={r.a.listenUrl || Object.values(r.a.listen || {})[0]} target="_blank" rel="noopener noreferrer" title={`${s.listenUrl} ↗`} aria-label={s.listenUrl}>{markLabel[m]}</a>
                            : <span key={m} className={`lu-rel-mark${has ? ' is-on' : ''}`} title={tip} aria-hidden="true">{markLabel[m]}</span>;
                        })}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="lu-list">
          {list.map(({ a, when, type }) => (
            <li key={a.id}>
              <Link to={`${prefix}/releases/${a.id}`} className="lu-list-row">
                {a.coverUrl ? <img className="lu-thumb" src={a.coverUrl} alt="" loading="lazy" /> : <span className="lu-thumb" />}
                <span className="lu-list-main">
                  <strong>{localTitle(a, locale)}{altTitle(a, locale) && <span className="lu-list-alt"> {altTitle(a, locale)}</span>}</strong>
                  <span>{[when, typeLabel[type] || a.type, a.label].filter(Boolean).join(' · ')}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
