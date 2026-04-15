import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useEvents, useSetlists } from '../hooks/useSheetData';
import EventCard, { SetlistIcon } from '../components/EventCard';

interface Props {
  locale: Locale;
}

export default function Events({ locale }: Props) {
  const s = t(locale);
  const prefix = `/${locale}`;
  const { events, loading } = useEvents();
  const { setlists } = useSetlists();
  const [yearFilter, setYearFilter] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'card'>('list');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const now = new Date().toISOString().slice(0, 10);

  const sorted = useMemo(() => {
    const copy = [...events];
    return sortOrder === 'desc'
      ? copy.sort((a, b) => b.date.localeCompare(a.date))
      : copy.sort((a, b) => a.date.localeCompare(b.date));
  }, [events, sortOrder]);

  const years = useMemo(() =>
    [...new Set(sorted.map(e => e.date.slice(0, 4)))].sort().reverse(),
    [sorted]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return sorted.filter(e => {
      if (yearFilter && e.date.slice(0, 4) !== yearFilter) return false;
      if (q) {
        const haystack = [e.title_en, e.title_ja, e.venue_en, e.venue_ja, e.city_en, e.city_ja, e.performers || ''].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [sorted, yearFilter, search]);

  const upcoming = filtered.filter(e => e.date >= now);
  const past = filtered.filter(e => e.date < now);

  // For display: upcoming always shows soonest-first regardless of sort
  const upcomingDisplay = sortOrder === 'desc' ? [...upcoming].reverse() : upcoming;

  const hasActiveFilters = !!yearFilter || !!search;

  const eventsWithSetlist = useMemo(
    () => new Set(setlists.map(s => s.event)),
    [setlists]
  );

  if (loading) return null;

  return (
    <>
      <div className="page-title">
        <h1>
          <span>{s.events.title}</span>
        </h1>
      </div>

      <div className="filters-bar">
        <button
          className={`filters-toggle${hasActiveFilters ? ' has-filters' : ''}`}
          onClick={() => setFiltersOpen(o => !o)}
          aria-expanded={filtersOpen}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .39.812L9.5 7.606V13.5a.5.5 0 0 1-.724.447l-2.5-1.25A.5.5 0 0 1 6 12.25V7.606L1.11 1.812A.5.5 0 0 1 1.5 1.5z"/></svg>
          {hasActiveFilters && <span className="filters-dot" />}
        </button>
        <div className="view-toggle">
          <button
            className={view === 'card' ? 'active' : ''}
            onClick={() => setView('card')}
            aria-pressed={view === 'card'}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/></svg>
          </button>
          <button
            className={view === 'list' ? 'active' : ''}
            onClick={() => setView('list')}
            aria-pressed={view === 'list'}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/></svg>
          </button>
        </div>
      </div>

      {filtersOpen && (
        <div className="filters">
          <select
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
            aria-label={s.events.allYears}
          >
            <option value="">{s.events.allYears}</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value as 'desc' | 'asc')}
            aria-label="Sort order"
          >
            <option value="desc">{s.events.newestFirst}</option>
            <option value="asc">{s.events.oldestFirst}</option>
          </select>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={s.events.search}
            aria-label={s.events.search}
          />
        </div>
      )}

      {/* Upcoming */}
      {upcomingDisplay.length > 0 && (
        <section className="mb-2">
          <div className="section-header">
            <h2 className="section-label">{s.events.upcoming}</h2>
            <span className="section-count">{upcomingDisplay.length}{locale === 'ja' ? '件' : ''}</span>
          </div>
          {view === 'card' ? (
            upcomingDisplay.map(event => (
              <EventCard key={event.id} event={event} locale={locale} featured hasSetlist={eventsWithSetlist.has(event.id)} />
            ))
          ) : (
            <div className="home-event-list">
              {upcomingDisplay.map(event => {
                const venue = locale === 'ja' ? event.venue_ja : event.venue_en;
                const area = locale === 'ja' ? event.city_ja : event.city_en;
                return (
                  <Link to={`${prefix}/events/${event.id}`} className="home-event-item" key={event.id}>
                    <time>{event.date}</time>
                    <div className="home-event-body">
                      <span className="home-event-venue">
                        {venue}
                        {eventsWithSetlist.has(event.id) && (
                          <span className="setlist-badge" data-tooltip={locale === 'ja' ? 'セットリストあり' : 'Setlist available'}>{SetlistIcon}</span>
                        )}
                      </span>
                      {area && <span className="home-event-area">{area}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}
      {upcomingDisplay.length === 0 && !yearFilter && !search && (
        <p className="events-empty-note">
          {s.events.noUpcoming}
        </p>
      )}

      {/* Past */}
      <section>
        <div className="section-header">
          <h2 className="section-label">{s.events.past}</h2>
          <span className="section-count">{past.length}{locale === 'ja' ? '件' : ''}</span>
        </div>
        {past.length === 0 && (
          <p className="events-empty-note">
            {search || yearFilter ? s.events.noResults : s.events.noPast}
          </p>
        )}
        {view === 'card' ? (
          past.map(event => (
            <EventCard key={event.id} event={event} locale={locale} hasSetlist={eventsWithSetlist.has(event.id)} />
          ))
        ) : (
          <div className="home-event-list">
            {past.map(event => {
              const venue = locale === 'ja' ? event.venue_ja : event.venue_en;
              const area = locale === 'ja' ? event.city_ja : event.city_en;
              return (
                <Link to={`${prefix}/events/${event.id}`} className="home-event-item" key={event.id}>
                  <time>{event.date}</time>
                  <div className="home-event-body">
                    <span className="home-event-venue">
                      {venue}
                      {eventsWithSetlist.has(event.id) && (
                        <span className="setlist-badge" data-tooltip={locale === 'ja' ? 'セットリストあり' : 'Setlist available'}>{SetlistIcon}</span>
                      )}
                    </span>
                    {area && <span className="home-event-area">{area}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
