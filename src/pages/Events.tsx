import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQueryParam } from '../hooks/useQueryParam';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useEvents, useSetlists } from '../hooks/useSheetData';
import type { Event } from '../types';
import PageLoader from '../components/PageLoader';
import ShowCard from '../components/ShowCard';
import { todayInJapan } from '../utils/showDates';

interface Props {
  locale: Locale;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

/** "Nov 30 Sun" / "11/30（日）": the year is already in the heading. */
function shortDate(date: string, locale: Locale) {
  const d = new Date(date + 'T00:00:00');
  return locale === 'ja'
    ? { day: `${d.getMonth() + 1}/${d.getDate()}`, weekday: `（${DAYS_JA[d.getDay()]}）` }
    : { day: `${MONTHS[d.getMonth()]} ${d.getDate()}`, weekday: DAYS_EN[d.getDay()] };
}

export default function Events({ locale }: Props) {
  const s = t(locale);
  const prefix = `/${locale}`;
  const { events, loading } = useEvents();
  const { setlists } = useSetlists();
  // The search is also kept in the address, so links like /events?q=Shimokitazawa work
  const [search, setSearch] = useQueryParam('q');

  const today = todayInJapan();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return [...events]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter(e => !q || [e.title_en, e.title_ja, e.venue_en, e.venue_ja, e.city_en, e.city_ja, e.performers || '']
        .join(' ').toLowerCase().includes(q));
  }, [events, search]);

  // Upcoming soonest-first; past grouped by year, newest first
  const upcoming = useMemo(() => filtered.filter(e => (e.end_date || e.date) >= today).reverse(), [filtered, today]);
  const pastByYear = useMemo(() => {
    const m = new Map<string, Event[]>();
    filtered.filter(e => (e.end_date || e.date) < today).forEach(e => {
      const y = e.date.slice(0, 4);
      m.set(y, [...(m.get(y) || []), e]);
    });
    return [...m.entries()];
  }, [filtered, today]);

  const withSetlist = useMemo(() => new Set(setlists.map(x => x.event)), [setlists]);

  if (loading) return <PageLoader locale={locale} />;

  const setlistLabel = locale === 'ja' ? 'セットリストあり' : 'Has setlist';

  const row = (event: Event) => {
    const title = locale === 'ja' ? event.title_ja || event.title_en : event.title_en || event.title_ja;
    const venue = locale === 'ja' ? event.venue_ja || event.venue_en : event.venue_en || event.venue_ja;
    const area = locale === 'ja' ? event.city_ja || event.city_en : event.city_en || event.city_ja;
    const { day, weekday } = shortDate(event.date, locale);
    return (
      <li key={event.id}>
        <Link to={`${prefix}/events/${event.id}`} className={`tl-row${event.featured ? ' is-featured' : ''}`}>
          <time dateTime={event.date}>
            <span className="tl-day">{day}</span>
            <span className="tl-weekday">{weekday}</span>
          </time>
          <span className="tl-main">
            <strong>{title || venue}</strong>
            <span>{[title ? venue : '', area].filter(Boolean).join(' · ')}</span>
          </span>
          {withSetlist.has(event.id) && (
            <span className="tl-setlist" title={setlistLabel} aria-label={setlistLabel}>♪</span>
          )}
        </Link>
      </li>
    );
  };

  const jumpTo = (year: string) =>
    document.getElementById(`y${year}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <>
      <header className="news-detail-header">
        <h1 className="news-detail-title">{s.events.title}</h1>
      </header>

      <div className="tl-toolbar">
        <input
          type="search"
          className="show-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={s.events.search}
          aria-label={s.events.search}
        />
        {!search && pastByYear.length > 1 && (
          <select
            className="tl-jump"
            value=""
            onChange={e => { if (e.target.value) jumpTo(e.target.value); }}
            aria-label={s.events.allYears}
          >
            <option value="">{locale === 'ja' ? '年へ移動' : 'Jump to year'}</option>
            {pastByYear.map(([year, list]) => <option key={year} value={year}>{year} ({list.length})</option>)}
          </select>
        )}
      </div>

      {upcoming.length > 0 ? (
        <section className="tl-upcoming">
          <h2 className="section-label">{s.events.upcoming}</h2>
          <div className="tl-upcoming-cards">
            {upcoming.map(e => <ShowCard key={e.id} event={e} locale={locale} prefix={prefix} />)}
          </div>
        </section>
      ) : !search && (
        <p className="events-empty-note">{s.events.noUpcoming}</p>
      )}

      <div className="timeline">
        {pastByYear.map(([year, list]) => (
          <section key={year} id={`y${year}`} className="tl-year">
            <h2 className="tl-year-label">
              {year}
              <span>{list.length}{locale === 'ja' ? '公演' : list.length === 1 ? ' show' : ' shows'}</span>
            </h2>
            <ul className="tl-list">{list.map(row)}</ul>
          </section>
        ))}
      </div>

      {filtered.length === 0 && <p className="events-empty-note">{s.events.noResults}</p>}
    </>
  );
}
