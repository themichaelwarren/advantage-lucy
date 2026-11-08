import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAllEvents, useAllSetlists } from '../../hooks/useSheetData';
import { useAdminT } from '../../i18n/admin';
import type { Event } from '../../types';
import { setlistIsPublic, todayInJapan } from '../../utils/showDates';
import { eventToRow } from '../../utils/adminRows';
import ListToolbar, { useListPrefs, SwitchCell, SaveStateCell } from '../../components/admin/ListToolbar';
import { useQuickEdit } from '../../components/admin/useQuickEdit';

type Filter = 'all' | 'upcoming' | 'past' | 'nosetlist' | 'hidden';
type Sort = 'newest' | 'oldest';
type View = 'list' | 'table';

export default function AdminEvents() {
  const { s, locale, prefix } = useAdminT();
  const { events: loaded, loading } = useAllEvents();
  const { setlists } = useAllSetlists();
  const { items: events, save, rowState } = useQuickEdit<Event>(loaded, 'Events', eventToRow);
  const ui = useListPrefs<Filter, Sort, View>('shows', { filter: 'all', sort: 'newest', view: 'list' });

  const withSetlist = useMemo(() => new Set(setlists.map(x => x.event)), [setlists]);
  const today = todayInJapan();
  const isUpcoming = (e: Event) => (e.end_date || e.date) >= today;

  const list = useMemo(() => {
    const q = ui.query.trim().toLowerCase();
    return events
      .filter(e => !q || [e.date, e.title_en, e.title_ja, e.venue_en, e.venue_ja, e.city_en, e.city_ja, e.performers]
        .some(t => t?.toLowerCase().includes(q)))
      .filter(e => ui.filter === 'all' ? true
        : ui.filter === 'upcoming' ? isUpcoming(e)
        : ui.filter === 'past' ? !isUpcoming(e)
        : ui.filter === 'nosetlist' ? !isUpcoming(e) && !withSetlist.has(e.id)
        : e.status === 'private')
      .sort((a, b) => ui.sort === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, ui.query, ui.filter, ui.sort, withSetlist, today]);

  if (loading) return <p className="ad-loading">{s.loading}</p>;

  const name = (e: Event) => ({
    title: locale === 'ja' ? e.title_ja || e.title_en : e.title_en || e.title_ja,
    venue: locale === 'ja' ? e.venue_ja || e.venue_en : e.venue_en || e.venue_ja,
    city: locale === 'ja' ? e.city_ja || e.city_en : e.city_en || e.city_ja,
  });
  const setlistTag = (e: Event) => withSetlist.has(e.id)
    ? <span className={`ad-tag ${setlistIsPublic(e) ? 'is-ok' : 'is-muted'}`}>{setlistIsPublic(e) ? '♪' : '🔒'} {s.hasSetlist}</span>
    : <span className="ad-tag is-todo">{s.noSetlist}</span>;

  const row = (e: Event) => {
    const n = name(e);
    return (
      <li key={e.id}>
        <Link to={`${prefix}/events/${e.id}`} className="ad-list-row">
          <time>{e.date}</time>
          <span className="ad-list-main">
            <strong>{n.title || n.venue}</strong>
            <span>{n.title ? `${n.venue} · ${n.city}` : n.city}</span>
          </span>
          <span className="ad-list-tags">
            {e.status === 'private' && <span className="ad-tag is-muted">{s.hidden}</span>}
            {setlistTag(e)}
          </span>
        </Link>
      </li>
    );
  };

  // List view: grouped by year (or "Upcoming" first when newest-first)
  const groups = new Map<string, Event[]>();
  list.forEach(e => {
    const key = ui.sort === 'newest' && isUpcoming(e) ? s.upcoming : e.date.slice(0, 4);
    groups.set(key, [...(groups.get(key) || []), e]);
  });

  return (
    <>
      <div className="ad-page-head">
        <h1>{s.showsTitle} <span className="ad-count">{events.length}</span></h1>
        <Link to={`${prefix}/events/new`} className="ad-btn ad-btn-primary ad-btn-lg">+ {s.addShow}</Link>
      </div>

      <ListToolbar
        s={s}
        query={ui.query} onQuery={ui.setQuery}
        filters={[
          { value: 'all', label: s.filterAll },
          { value: 'upcoming', label: s.filterUpcoming },
          { value: 'past', label: s.filterPast },
          { value: 'nosetlist', label: s.filterNoSetlist },
          { value: 'hidden', label: s.filterHidden },
        ]}
        filter={ui.filter} onFilter={v => ui.setFilter(v as Filter)}
        sorts={[{ value: 'newest', label: s.sortNewest }, { value: 'oldest', label: s.sortOldest }]}
        sort={ui.sort} onSort={v => ui.setSort(v as Sort)}
        views={[{ value: 'list', label: `☰ ${s.viewList}` }, { value: 'table', label: `▦ ${s.viewTable}` }]}
        view={ui.view} onView={v => ui.setView(v as View)}
        shown={list.length} total={events.length}
      />

      {list.length === 0 ? <p className="ad-empty">{s.noResults}</p> : ui.view === 'table' ? (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>{s.colDate}</th>
                <th>{s.colTitle}</th>
                <th>{s.colSetlist}</th>
                <th className="ad-td-center">{s.colOnSite}</th>
                <th className="ad-td-center">{s.colHighlight}</th>
                <th aria-label={s.edit} />
              </tr>
            </thead>
            <tbody>
              {list.map(e => {
                const n = name(e);
                return (
                  <tr key={e.id} className={e.status === 'private' ? 'is-hidden' : ''}>
                    <td className="ad-td-date">{e.date}</td>
                    <td className="ad-td-title">
                      <Link to={`${prefix}/events/${e.id}`}>{n.title || n.venue}</Link>
                      <span>{n.title ? `${n.venue} · ${n.city}` : n.city}</span>
                    </td>
                    <td>{setlistTag(e)}</td>
                    <td className="ad-td-center">
                      <SwitchCell checked={e.status !== 'private'} label={s.colOnSite} onChange={() => save(e.id, { status: e.status === 'private' ? 'published' : 'private' })} />
                    </td>
                    <td className="ad-td-center">
                      <SwitchCell checked={!!e.featured} label={s.colHighlight} onChange={() => save(e.id, { featured: !e.featured })} />
                    </td>
                    <SaveStateCell s={s} state={rowState[e.id]} editHref={`${prefix}/events/${e.id}`} renderLink={(href, label) => <Link to={href} className="ad-btn ad-btn-quiet">{label}</Link>} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        [...groups.entries()].map(([key, rows]) => (
          <section key={key} className="ad-list-group">
            <h2>{key} <span className="ad-count">{rows.length}</span></h2>
            <ul className="ad-list">{rows.map(row)}</ul>
          </section>
        ))
      )}
    </>
  );
}
