import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePeople, useAllSongs } from '../../hooks/useSheetData';
import { useAdminT } from '../../i18n/admin';
import { personName } from '../../components/admin/PeoplePicker';
import ListToolbar, { useListPrefs } from '../../components/admin/ListToolbar';

type Filter = 'all' | 'unused';
type Sort = 'songs' | 'az';

/** Song credits: count how many songs each person is credited on. */
export function creditCounts(songs: { music_by?: string; lyrics_by?: string }[]) {
  const m = new Map<string, number>();
  for (const x of songs) {
    const ids = new Set(`${x.music_by || ''},${x.lyrics_by || ''}`.split(',').map(t => t.trim()).filter(Boolean));
    ids.forEach(id => m.set(id, (m.get(id) || 0) + 1));
  }
  return m;
}

export default function AdminPeople() {
  const { s, locale, prefix } = useAdminT();
  const { people, loading } = usePeople();
  const { songs } = useAllSongs();
  const ui = useListPrefs<Filter, Sort>('people', { filter: 'all', sort: 'songs' });
  const counts = useMemo(() => creditCounts(songs), [songs]);

  const list = useMemo(() => {
    const q = ui.query.trim().toLowerCase();
    return people
      .map(p => ({ p, name: personName(p, locale), other: personName(p, locale === 'ja' ? 'en' : 'ja') }))
      .filter(({ p, name, other }) => !q || [name, other, p.id].some(t => t.toLowerCase().includes(q)))
      .filter(({ p }) => ui.filter === 'all' || !counts.get(p.id))
      .sort((a, b) => ui.sort === 'az'
        ? a.name.localeCompare(b.name, locale)
        : (counts.get(b.p.id) || 0) - (counts.get(a.p.id) || 0) || a.name.localeCompare(b.name, locale));
  }, [people, ui.query, ui.filter, ui.sort, locale, counts]);

  if (loading) return <p className="lu-loading">{s.loading}</p>;

  return (
    <>
      <div className="lu-page-head">
        <div>
          <h1>{s.people} <span className="lu-count">{people.length}</span></h1>
          <p className="lu-hint">{s.peopleHint}</p>
        </div>
        <Link to={`${prefix}/people/new`} className="lu-btn lu-btn-primary lu-btn-lg">+ {s.addPerson}</Link>
      </div>
      <ListToolbar
        s={s}
        query={ui.query} onQuery={ui.setQuery}
        filters={[{ value: 'all', label: s.filterAll }, { value: 'unused', label: s.filterUnused }]}
        filter={ui.filter} onFilter={v => ui.setFilter(v as Filter)}
        sorts={[{ value: 'songs', label: s.songsTitle }, { value: 'az', label: s.sortAZ }]}
        sort={ui.sort} onSort={v => ui.setSort(v as Sort)}
        shown={list.length} total={people.length}
      />
      <ul className="lu-list">
        {list.map(({ p, name, other }) => (
          <li key={p.id}>
            <Link to={`${prefix}/people/${p.id}`} className="lu-list-row">
              <span className="lu-list-main">
                <strong>{name}</strong>
                {other && other !== name && <span>{other}</span>}
              </span>
              <span className="lu-list-tags">
                <span className="lu-tag">{s.songsCountN.replace('{n}', String(counts.get(p.id) || 0))}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="lu-empty">{s.noResults}</p>}
    </>
  );
}
