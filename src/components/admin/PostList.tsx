import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { AdminStrings } from '../../i18n/admin';
import ListToolbar, { useListPrefs, SwitchCell, SaveStateCell } from './ListToolbar';
import { useQuickEdit } from './useQuickEdit';

type Filter = 'all' | 'onsite' | 'hidden';
type Sort = 'newest' | 'oldest' | 'title';
type View = 'list' | 'table';

/**
 * News and Blog lists: search, filter, sort, and a table view with an
 * "On site" switch that saves straight away (full rows via `toRow`).
 */
export default function PostList<T extends { id: string; date: string; status?: string }>({
  s, page, title, addLabel, base, items: loaded, loading, tab, toRow, titleOf,
}: {
  s: AdminStrings;
  page: string;            // remembers this list's settings
  title: string;
  addLabel: string;
  base: string;            // e.g. /en/admin/news
  items: T[];
  loading: boolean;
  tab: string;             // sheet tab, e.g. "News"
  toRow: (item: T) => Record<string, string>;
  titleOf: (item: T) => string;
}) {
  const { items, save, rowState } = useQuickEdit<T>(loaded, tab, toRow);
  const ui = useListPrefs<Filter, Sort, View>(page, { filter: 'all', sort: 'newest', view: 'list' });

  const list = useMemo(() => {
    const q = ui.query.trim().toLowerCase();
    return items
      .filter(r => !q || `${r.date} ${titleOf(r)}`.toLowerCase().includes(q))
      .filter(r => ui.filter === 'all' ? true : ui.filter === 'hidden' ? r.status === 'private' : r.status !== 'private')
      .sort((a, b) => ui.sort === 'title' ? titleOf(a).localeCompare(titleOf(b))
        : ui.sort === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, ui.query, ui.filter, ui.sort]);

  if (loading) return <p className="ad-loading">{s.loading}</p>;

  return (
    <>
      <div className="ad-page-head">
        <h1>{title} <span className="ad-count">{items.length}</span></h1>
        <Link to={`${base}/new`} className="ad-btn ad-btn-primary ad-btn-lg">+ {addLabel}</Link>
      </div>
      <ListToolbar
        s={s}
        query={ui.query} onQuery={ui.setQuery}
        filters={[{ value: 'all', label: s.filterAll }, { value: 'onsite', label: s.filterOnSite }, { value: 'hidden', label: s.filterHidden }]}
        filter={ui.filter} onFilter={v => ui.setFilter(v as Filter)}
        sorts={[{ value: 'newest', label: s.sortNewest }, { value: 'oldest', label: s.sortOldest }, { value: 'title', label: s.sortTitle }]}
        sort={ui.sort} onSort={v => ui.setSort(v as Sort)}
        views={[{ value: 'list', label: `☰ ${s.viewList}` }, { value: 'table', label: `▦ ${s.viewTable}` }]}
        view={ui.view} onView={v => ui.setView(v as View)}
        shown={list.length} total={items.length}
      />
      {list.length === 0 ? <p className="ad-empty">{s.noResults}</p> : ui.view === 'table' ? (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>{s.colDate}</th>
                <th>{s.colTitle}</th>
                <th className="ad-td-center">{s.colOnSite}</th>
                <th aria-label={s.edit} />
              </tr>
            </thead>
            <tbody>
              {list.map(r => (
                <tr key={r.id} className={r.status === 'private' ? 'is-hidden' : ''}>
                  <td className="ad-td-date">{r.date}</td>
                  <td className="ad-td-title"><Link to={`${base}/${r.id}`}>{titleOf(r)}</Link></td>
                  <td className="ad-td-center">
                    <SwitchCell
                      checked={r.status !== 'private'}
                      label={s.colOnSite}
                      onChange={() => save(r.id, { status: r.status === 'private' ? 'published' : 'private' } as Partial<T>)}
                    />
                  </td>
                  <SaveStateCell s={s} state={rowState[r.id]} editHref={`${base}/${r.id}`} renderLink={(href, label) => <Link to={href} className="ad-btn ad-btn-quiet">{label}</Link>} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="ad-list">
          {list.map(r => (
            <li key={r.id}>
              <Link to={`${base}/${r.id}`} className="ad-list-row">
                <time>{r.date}</time>
                <span className="ad-list-main"><strong>{titleOf(r)}</strong></span>
                {r.status === 'private' && <span className="ad-list-tags"><span className="ad-tag is-muted">{s.hidden}</span></span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
