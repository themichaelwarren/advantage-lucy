import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAreas, useVenues, usePrefectures } from '../../hooks/useSheetData';
import { useAdminT } from '../../i18n/admin';
import ListToolbar, { useListPrefs } from '../../components/admin/ListToolbar';

type Filter = 'all' | 'unused';
type Sort = 'venues' | 'az';

export default function AdminAreas() {
  const { s, locale, prefix } = useAdminT();
  const { areas, loading } = useAreas();
  const { venues } = useVenues();
  const { prefectures } = usePrefectures();
  const ui = useListPrefs<Filter, Sort>('areas', { filter: 'all', sort: 'venues' });

  const venueCount = useMemo(() => {
    const m = new Map<string, number>();
    venues.forEach(v => v.area && m.set(v.area, (m.get(v.area) || 0) + 1));
    return m;
  }, [venues]);
  const prefName = useMemo(() => {
    const m = new Map(prefectures.map(p => [p.id, locale === 'ja' ? p.name_ja || p.name_en : p.name_en || p.name_ja]));
    return (id: string) => (id ? m.get(id) || id : '');
  }, [prefectures, locale]);

  const list = useMemo(() => {
    const q = ui.query.trim().toLowerCase();
    const nameOf = (a: typeof areas[number]) => (locale === 'ja' ? a.name_ja || a.name_en : a.name_en || a.name_ja) || a.id;
    return areas
      .filter(a => !q || [a.name_en, a.name_ja, a.id, prefName(a.prefecture)].some(t => t?.toLowerCase().includes(q)))
      .filter(a => ui.filter === 'all' || !venueCount.get(a.id))
      .map(a => ({ a, name: nameOf(a), other: locale === 'ja' ? a.name_en : a.name_ja }))
      .sort((x, y) => ui.sort === 'az'
        ? x.name.localeCompare(y.name, locale)
        : (venueCount.get(y.a.id) || 0) - (venueCount.get(x.a.id) || 0) || x.name.localeCompare(y.name, locale));
  }, [areas, ui.query, ui.filter, ui.sort, locale, venueCount, prefName]);

  if (loading) return <p className="lu-loading">{s.loading}</p>;

  return (
    <>
      <div className="lu-page-head">
        <div>
          <h1>{s.areas} <span className="lu-count">{areas.length}</span></h1>
          <p className="lu-hint">{s.areasHint}</p>
        </div>
        <Link to={`${prefix}/areas/new`} className="lu-btn lu-btn-primary lu-btn-lg">+ {s.addArea}</Link>
      </div>
      <ListToolbar
        s={s}
        query={ui.query} onQuery={ui.setQuery}
        filters={[{ value: 'all', label: s.filterAll }, { value: 'unused', label: s.filterUnused }]}
        filter={ui.filter} onFilter={v => ui.setFilter(v as Filter)}
        sorts={[{ value: 'venues', label: s.venuesTitle }, { value: 'az', label: s.sortAZ }]}
        sort={ui.sort} onSort={v => ui.setSort(v as Sort)}
        shown={list.length} total={areas.length}
      />
      <ul className="lu-list">
        {list.map(({ a, name, other }) => (
          <li key={a.id}>
            <Link to={`${prefix}/areas/${a.id}`} className="lu-list-row">
              <span className="lu-list-main">
                <strong>{name}</strong>
                <span>{[other && other !== name ? other : '', prefName(a.prefecture)].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="lu-list-tags">
                <span className="lu-tag">{s.venuesCountN.replace('{n}', String(venueCount.get(a.id) || 0))}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="lu-empty">{s.noResults}</p>}
    </>
  );
}
