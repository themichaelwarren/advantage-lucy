import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useVenues, useAreas, useAllEvents } from '../../hooks/useSheetData';
import { useAdminT } from '../../i18n/admin';
import ListToolbar, { useListPrefs } from '../../components/admin/ListToolbar';

type Filter = 'all' | 'unused';
type Sort = 'shows' | 'az';

export default function AdminVenues() {
  const { s, locale, prefix } = useAdminT();
  const { venues, loading } = useVenues();
  const { areas } = useAreas();
  const { events } = useAllEvents();
  const ui = useListPrefs<Filter, Sort>('venues', { filter: 'all', sort: 'shows' });

  const areaName = useMemo(() => {
    const m = new Map(areas.map(a => [a.id, locale === 'ja' ? a.name_ja || a.name_en : a.name_en || a.name_ja]));
    return (id: string) => m.get(id) || id;
  }, [areas, locale]);
  const showCount = useMemo(() => {
    const m = new Map<string, number>();
    events.forEach(e => e.venue_id && m.set(e.venue_id, (m.get(e.venue_id) || 0) + 1));
    return m;
  }, [events]);

  const list = useMemo(() => {
    const q = ui.query.trim().toLowerCase();
    const name = (v: typeof venues[number]) => (locale === 'ja' ? v.name_ja || v.name_en : v.name_en || v.name_ja);
    return venues
      .filter(v => !q || [v.name_en, v.name_ja, areaName(v.area)].some(t => t?.toLowerCase().includes(q)))
      .filter(v => ui.filter === 'all' || !showCount.get(v.id))
      .map(v => ({ v, name: name(v) }))
      .sort((a, b) => ui.sort === 'az'
        ? a.name.localeCompare(b.name)
        : (showCount.get(b.v.id) || 0) - (showCount.get(a.v.id) || 0) || a.name.localeCompare(b.name));
  }, [venues, ui.query, ui.filter, ui.sort, locale, areaName, showCount]);

  if (loading) return <p className="ad-loading">{s.loading}</p>;

  return (
    <>
      <div className="ad-page-head">
        <h1>{s.venuesTitle} <span className="ad-count">{venues.length}</span></h1>
        <Link to={`${prefix}/venues/new`} className="ad-btn ad-btn-primary ad-btn-lg">+ {s.addVenue}</Link>
      </div>
      <ListToolbar
        s={s}
        query={ui.query} onQuery={ui.setQuery}
        filters={[{ value: 'all', label: s.filterAll }, { value: 'unused', label: s.filterUnused }]}
        filter={ui.filter} onFilter={v => ui.setFilter(v as Filter)}
        sorts={[{ value: 'shows', label: s.sortMostShows }, { value: 'az', label: s.sortAZ }]}
        sort={ui.sort} onSort={v => ui.setSort(v as Sort)}
        shown={list.length} total={venues.length}
      />
      <ul className="ad-list">
        {list.map(({ v, name }) => (
          <li key={v.id}>
            <Link to={`${prefix}/venues/${v.id}`} className="ad-list-row">
              <span className="ad-list-main">
                <strong>{name || v.id}</strong>
                <span>{areaName(v.area)}</span>
              </span>
              <span className="ad-list-tags">
                <span className="ad-tag">{showCount.get(v.id) || 0} {s.showsHere}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="ad-empty">{s.noResults}</p>}
    </>
  );
}
