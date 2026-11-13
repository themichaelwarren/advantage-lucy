import { useMemo } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useEvents, useSetlists, useVenues, useSongs } from '../hooks/useSheetData';
import { normalize } from '../utils/text';
import { songTitle, compareSongs } from '../utils/songTitles';
import { formatDateWithDay } from '../utils/format';
import { todayInJapan } from '../utils/showDates';
import PageLoader from '../components/PageLoader';
import NotFound from '../components/NotFound';
import PageTitle from '../components/PageTitle';
import BackLink from '../components/BackLink';
import { parseFormerNames, formerPeriods } from '../../functions/lib/venueNames';
import { movedTo } from '../utils/formerIds';

interface Props {
  locale: Locale;
}

/** A venue: where it is, its website, and every show the band played there. */
export default function VenueDetail({ locale }: Props) {
  const { id } = useParams<{ id: string }>();
  const s = t(locale);
  const prefix = `/${locale}`;
  const { venues, loading } = useVenues();
  const { events, loading: eventsLoading } = useEvents();
  const { setlists } = useSetlists();
  const pick = (en?: string, ja?: string) => (locale === 'ja' ? ja || en : en || ja) || '';

  const venue = venues.find(v => v.id === id);
  const former = parseFormerNames(venue?.former_names);
  const today = todayInJapan();
  const shows = useMemo(
    () => events.filter(e => e.venue_id === id).sort((a, b) => b.date.localeCompare(a.date)),
    [events, id],
  );
  const withSetlist = useMemo(() => new Set(setlists.map(x => x.event)), [setlists]);
  const { songs } = useSongs();
  // The songs played here most (from public setlists): once at least two shows here have one
  const topSongs = useMemo(() => {
    const here = new Set(shows.map(e => e.id));
    const count = new Map<string, { title: string; shows: Set<string> }>();
    for (const r of setlists) {
      if (!here.has(r.event) || !r.song?.trim()) continue;
      const k = normalize(r.song);
      const c = count.get(k) || { title: r.song, shows: new Set<string>() };
      c.shows.add(r.event);
      count.set(k, c);
    }
    const shownWithSetlist = new Set([...count.values()].flatMap(c => [...c.shows]));
    if (shownWithSetlist.size < 2) return [];
    const songBy = new Map(songs.map(x => [normalize(x.title), x]));
    const byTitle = compareSongs(locale);
    return [...count.entries()]
      .map(([k, c]) => ({ song: songBy.get(k), title: c.title, n: c.shows.size }))
      .filter(x => x.n > 1)
      .sort((a, b) => b.n - a.n || byTitle(a.song || { title: a.title }, b.song || { title: b.title }))
      .slice(0, 8);
  }, [shows, setlists, songs, locale]);

  if (loading || eventsLoading) return <PageLoader locale={locale} />;

  if (!venue) {
    // An old address (the id was changed in the admin) forwards to the page's new one
    const moved = movedTo(venues, id);
    if (moved) return <Navigate to={`${prefix}/venues/${moved}`} replace />;
    return <NotFound locale={locale} what={locale === 'ja' ? 'この会場' : 'This venue'} back={{ to: `${prefix}/events`, label: s.events.title }} />;
  }

  const name = pick(venue.name_en, venue.name_ja) || venue.id;
  const other = locale === 'ja' ? venue.name_en : venue.name_ja;
  // Where it is: from any of its shows (they carry the area, prefecture and country)
  const sample = shows[0];
  const city = sample ? pick(sample.city_en, sample.city_ja) : '';
  const place = sample ? [
    city,
    sample.prefecture_en && pick(sample.prefecture_en, sample.prefecture_ja),
    sample.country_en && pick(sample.country_en, sample.country_ja),
  ].filter(Boolean).join(', ') : '';
  const upcoming = shows.filter(e => (e.end_date || e.date) >= today).reverse();
  const past = shows.filter(e => (e.end_date || e.date) < today);
  const pastByYear: [string, typeof past][] = [];
  for (const e of past) {
    const y = e.date.slice(0, 4);
    const last = pastByYear[pastByYear.length - 1];
    if (last && last[0] === y) last[1].push(e); else pastByYear.push([y, [e]]);
  }
  const setlistLabel = locale === 'ja' ? 'セットリストあり' : 'Has setlist';

  const row = (e: typeof shows[number]) => {
    const title = pick(e.title_en, e.title_ja);
    return (
      <li key={e.id}>
        <Link to={`${prefix}/events/${e.id}`} className={`tl-row venue-show-row${e.featured ? ' is-featured' : ''}`}>
          <time dateTime={e.date}>{formatDateWithDay(e.date, locale)}</time>
          <span className="tl-main">
            {/* Untitled shows: who else played says more than the venue name
                again; with no lineup either, it was just the band */}
            <strong>{title || (e.performers ? `w/ ${e.performers}` : 'advantage Lucy')}</strong>
            {title && e.performers && <span>w/ {e.performers}</span>}
          </span>
          {withSetlist.has(e.id) && <span className="tl-setlist" title={setlistLabel} aria-label={setlistLabel}>♪</span>}
        </Link>
      </li>
    );
  };

  return (
    <article className="venue-detail">
      <BackLink to={`${prefix}/events`} label={s.events.title} />
      <PageTitle title={name} />
      <header className="news-detail-header venue-head">
        <p className="venue-kicker">{s.events.venue}</p>
        <h1 className="news-detail-title">{name}</h1>
        {other && other !== name && <p className="venue-other-name" lang={locale === 'ja' ? 'en' : 'ja'}>{other}</p>}
        {former.length > 0 && (
          <p className="venue-former">
            <span>{s.venues.formerly}</span>
            {formerPeriods(former, locale === 'ja' ? '〜' : '–').map((n, i) => (
              <span key={i}>{(locale === 'ja' ? n.name_ja || n.name_en : n.name_en || n.name_ja)} <small>{n.period}</small></span>
            ))}
          </p>
        )}
        <p className="venue-place">
          {city && <Link to={`${prefix}/events?q=${encodeURIComponent(city)}`}>{place}</Link>}
          {venue.url && (
            <a className="venue-site" href={venue.url} target="_blank" rel="noopener noreferrer">{s.venues.website} ↗</a>
          )}
        </p>
      </header>

      {upcoming.length > 0 && (
        <section className="venue-section">
          <h2 className="section-label">{s.events.upcoming}</h2>
          <ul className="tl-list">{upcoming.map(row)}</ul>
        </section>
      )}
      {topSongs.length > 0 && (
        <section className="venue-section">
          <h2 className="section-label">{s.venues.playedMost}</h2>
          <ol className="tag-list venue-top-songs">
            {topSongs.map(t => {
              const times = s.venues.timesPlayed.replace('{n}', String(t.n));
              const inner = <><span className="venue-top-title">{t.song ? songTitle(t.song, locale) : t.title}</span><span className="venue-top-count" aria-label={times} title={times}>{t.n}</span></>;
              return (
                <li key={t.title}>
                  {t.song?.id
                    ? <Link className="tag" to={`${prefix}/songs/${t.song.id}`}>{inner}</Link>
                    : <span className="tag">{inner}</span>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="venue-section">
        <h2 className="section-label">{s.venues.showsHere} <span className="music-count">{past.length}</span></h2>
        {past.length === 0 ? <p className="events-empty-note">{s.venues.noShows}</p> : (
          // By year, as on the Events page
          <div className="timeline">
            {pastByYear.map(([year, list]) => (
              <section key={year} className="tl-year">
                <h3 className="tl-year-label">
                  {year}
                  <span>{list.length}{locale === 'ja' ? '公演' : list.length === 1 ? ' show' : ' shows'}</span>
                </h3>
                <ul className="tl-list">{list.map(row)}</ul>
              </section>
            ))}
          </div>
        )}
      </section>

      <div className="mt-1">
        <Link to={`${prefix}/events`} className="tag"><span>← {s.events.title}</span></Link>
      </div>
    </article>
  );
}
