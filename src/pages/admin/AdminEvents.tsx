import Icon from '../../components/admin/Icon';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAllEvents, useAllSetlists } from '../../hooks/useSheetData';
import { useAdminT } from '../../i18n/admin';
import type { Event } from '../../types';
import { setlistIsPublic, todayInJapan } from '../../utils/showDates';
import { eventToRow } from '../../utils/adminRows';
import ListToolbar, { useListPrefs, SwitchCell, SaveStateCell } from '../../components/admin/ListToolbar';
import { useQuickEdit } from '../../components/admin/useQuickEdit';

type Filter = 'all' | 'upcoming' | 'past' | 'nosetlist' | 'hidden' | 'nosource';
type Sort = 'newest' | 'oldest' | 'added';
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
        : ui.filter === 'nosource' ? !!e.setlist_added && !e.setlist_source
        : e.status === 'private')
      // "Setlists, newest added": only shows whose setlist has a date, most recent first
      .filter(e => ui.sort !== 'added' || !!e.setlist_added)
      .sort((a, b) => ui.sort === 'added' ? (b.setlist_added || '').localeCompare(a.setlist_added || '') || b.date.localeCompare(a.date)
        : ui.sort === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, ui.query, ui.filter, ui.sort, withSetlist, today]);

  if (loading) return <p className="lu-loading">{s.loading}</p>;

  const name = (e: Event) => ({
    title: locale === 'ja' ? e.title_ja || e.title_en : e.title_en || e.title_ja,
    venue: locale === 'ja' ? e.venue_ja || e.venue_en : e.venue_en || e.venue_ja,
    city: locale === 'ja' ? e.city_ja || e.city_en : e.city_en || e.city_ja,
  });
  const setlistTag = (e: Event) => withSetlist.has(e.id)
    ? <span className={`lu-tag ${setlistIsPublic(e) ? 'is-ok' : 'is-muted'}`}><Icon name={setlistIsPublic(e) ? 'setlist' : 'lock'} /> {s.hasSetlist}</span>
    : <span className="lu-tag is-todo">{s.noSetlist}</span>;

  const row = (e: Event) => {
    const n = name(e);
    return (
      <li key={e.id}>
        <Link to={`${prefix}/events/${e.id}`} className="lu-list-row">
          <time>{e.date}</time>
          <span className="lu-list-main">
            <strong>{n.title || n.venue}</strong>
            <span>{n.title ? `${n.venue} · ${n.city}` : n.city}</span>
          </span>
          <span className="lu-list-tags">
            {ui.sort === 'added' && e.setlist_added && <span className="lu-tag is-ok">{s.setlistAddedOn.replace('{date}', e.setlist_added)}</span>}
            {e.status === 'private' && <span className="lu-tag is-muted">{s.hidden}</span>}
            {setlistTag(e)}
          </span>
        </Link>
      </li>
    );
  };

  // List view: grouped by year (or "Upcoming" first when newest-first)
  const groups = new Map<string, Event[]>();
  list.forEach(e => {
    const key = ui.sort === 'added' ? s.sortSetlistAdded : ui.sort === 'newest' && isUpcoming(e) ? s.upcoming : e.date.slice(0, 4);
    groups.set(key, [...(groups.get(key) || []), e]);
  });

  return (
    <>
      <div className="lu-page-head">
        <h1>{s.showsTitle} <span className="lu-count">{events.length}</span></h1>
        <Link to={`${prefix}/events/new`} className="lu-btn lu-btn-primary lu-btn-lg">+ {s.addShow}</Link>
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
          ...(ui.filter === 'nosource' ? [{ value: 'nosource', label: s.dhSetlistsNoSource }] : []),
        ]}
        filter={ui.filter} onFilter={v => ui.setFilter(v as Filter)}
        sorts={[{ value: 'newest', label: s.sortNewest }, { value: 'oldest', label: s.sortOldest }, { value: 'added', label: s.sortSetlistAdded }]}
        sort={ui.sort} onSort={v => ui.setSort(v as Sort)}
        views={[{ value: 'list', label: <><Icon name="list" /> {s.viewList}</> }, { value: 'table', label: <><Icon name="table" /> {s.viewTable}</> }]}
        view={ui.view} onView={v => ui.setView(v as View)}
        shown={list.length} total={events.length}
      />

      {list.length === 0 ? <p className="lu-empty">{s.noResults}</p> : ui.view === 'table' ? (
        <div className="lu-table-wrap">
          <table className="lu-table">
            <thead>
              <tr>
                <th>{s.colDate}</th>
                <th>{s.colTitle}</th>
                <th>{s.colSetlist}</th>
                <th className="lu-td-center">{s.colOnSite}</th>
                <th className="lu-td-center">{s.colHighlight}</th>
                <th aria-label={s.edit} />
              </tr>
            </thead>
            <tbody>
              {list.map(e => {
                const n = name(e);
                return (
                  <tr key={e.id} className={e.status === 'private' ? 'is-hidden' : ''}>
                    <td className="lu-td-date">{e.date}</td>
                    <td className="lu-td-title">
                      <Link to={`${prefix}/events/${e.id}`}>{n.title || n.venue}</Link>
                      <span>{n.title ? `${n.venue} · ${n.city}` : n.city}</span>
                    </td>
                    <td>{setlistTag(e)}</td>
                    <td className="lu-td-center">
                      <SwitchCell checked={e.status !== 'private'} label={s.colOnSite} onChange={() => save(e.id, { status: e.status === 'private' ? 'published' : 'private' })} />
                    </td>
                    <td className="lu-td-center">
                      <SwitchCell checked={!!e.featured} label={s.colHighlight} onChange={() => save(e.id, { featured: !e.featured })} />
                    </td>
                    <SaveStateCell s={s} state={rowState[e.id]} editHref={`${prefix}/events/${e.id}`} renderLink={(href, label) => <Link to={href} className="lu-btn lu-btn-quiet">{label}</Link>} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        [...groups.entries()].map(([key, rows]) => (
          <section key={key} className="lu-list-group">
            <h2>{key} <span className="lu-count">{rows.length}</span></h2>
            <ul className="lu-list">{rows.map(row)}</ul>
          </section>
        ))
      )}
    </>
  );
}
