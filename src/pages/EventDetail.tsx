import { linkify } from '../utils/linkify';
import { useParams, Link } from 'react-router-dom';
import { normalize } from '../utils/text';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useEvents, useSetlists, useSongs } from '../hooks/useSheetData';
import { formatPrice } from '../utils/format';
import PageLoader from '../components/PageLoader';
import { setlistIsPublic, todayInJapan } from '../utils/showDates';
import { useFitsViewport } from '../hooks/useFitsViewport';
import SetlistTip from '../components/SetlistTip';
import ReserveForm from '../components/ReserveForm';
import { useState } from 'react';


interface Props {
  locale: Locale;
}

export default function EventDetail({ locale }: Props) {
  const s = t(locale);
  const prefix = `/${locale}`;
  const { id } = useParams<{ id: string }>();
  const { events, loading } = useEvents();
  const { setlists, loading: setlistsLoading } = useSetlists();
  const { songs } = useSongs();
  const event = events.find(e => e.id === id);
  // The left panel only sticks when it fits on screen (otherwise its bottom would be unreachable)
  const panel = useFitsViewport<HTMLElement>();
  // Reservations: the form says whether the show is still taking them
  const [reserveOpen, setReserveOpen] = useState(false);      // still taking reservations
  const [reserveWindow, setReserveWindow] = useState(false);  // the booking window is open

  if (loading) return <PageLoader locale={locale} />;

  if (!event) {
    return (
      <div className="text-center mt-2">
        <p style={{ background: 'var(--surface)', padding: '2rem', fontSize: '1.2rem' }}>
          {locale === 'en' ? 'Event not found.' : 'イベントが見つかりません。'}
        </p>
        <div className="mt-1">
          <Link to={`${prefix}/events`} className="tag">
            <span>← {s.events.title}</span>
          </Link>
        </div>
      </div>
    );
  }

  // Fall back to the other language when a translation is missing
  // (the admin tells editors one language is enough).
  const pick = (en?: string, ja?: string) => (locale === 'ja' ? ja || en : en || ja) || '';
  const title = pick(event.title_en, event.title_ja);
  const venue = pick(event.venue_en, event.venue_ja);
  const city = pick(event.city_en, event.city_ja);
  const body = pick(event.body_en, event.body_ja);
  const bodyLang = (locale === 'ja' ? event.body_ja : event.body_en) ? locale : (locale === 'ja' ? 'en' : 'ja');

  const longDay = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-GB', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
  const shortDay = (iso: string) => {
    const e = new Date(`${iso}T00:00:00Z`);
    const wd = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-GB', { weekday: 'short', timeZone: 'UTC' }).format(e);
    return locale === 'ja'
      ? `${e.getUTCMonth() + 1}.${e.getUTCDate()}（${wd}）`
      : new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(e);
  };
  const area = [
    city,
    event.prefecture_en && (locale === 'ja' ? event.prefecture_ja : event.prefecture_en),
    event.country_en && (locale === 'ja' ? event.country_ja : event.country_en),
  ].filter(Boolean).join(', ');

  // Group setlist entries by set
  const eventSetlist = !setlistsLoading
    ? setlists
        .filter(sl => sl.event === event.id)
        .sort((a, b) => a.order - b.order)
    : [];

  const setGroups = new Map<string, typeof eventSetlist>();
  for (const entry of eventSetlist) {
    const key = entry.set;
    if (!setGroups.has(key)) setGroups.set(key, []);
    setGroups.get(key)!.push(entry);
  }

  function setLabel(key: string): string {
    if (key === 'e') return s.setlist.encore;
    if (key.startsWith('e')) return `${s.setlist.encore} ${key.slice(1)}`;
    return `${s.setlist.set} ${key}`;
  }

  const hasPrice = (v?: string) => v != null && v !== '';
  // Local dev only: ?preview-reserve shows the form on any upcoming show without saving anything
  const previewReserve = import.meta.env.DEV && new URLSearchParams(window.location.search).has('preview-reserve');
  const isPast = (event.end_date || event.date) < todayInJapan();

  const shortWeekday = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-GB', { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(`${event.date}T00:00:00Z`));
  // Upcoming shows: "今日！" / "明日" / "あと20日" ("Today!" / "Tomorrow" / "In 20 days")
  const countdown = (() => {
    const days = Math.round((Date.parse(`${event.end_date || event.date}T00:00:00Z`) - Date.parse(`${todayInJapan()}T00:00:00Z`)) / 86400000);
    const toStart = Math.round((Date.parse(`${event.date}T00:00:00Z`) - Date.parse(`${todayInJapan()}T00:00:00Z`)) / 86400000);
    if (days < 0) return '';                       // over
    const ja = locale === 'ja';
    if (toStart <= 0) return ja ? '今日！' : 'Today!';   // today, or during a multi-day show
    if (toStart === 1) return ja ? '明日' : 'Tomorrow';
    return ja ? `あと${toStart}日` : `In ${toStart} days`;
  })();

  return (
    <article className="event-detail">
      {/* Wide screens: date, title and flyer in a sticky panel on the left;
          details, tickets, setlist and notes on the right. Phones: stacked. */}
      <div className="evd-layout">
        <aside ref={panel.ref} className="evd-aside is-sticky" style={{ top: panel.top }}>
          <div className="evd-head">
            {/* One line: the date, its weekday, and for upcoming shows how far away it is */}
            <div className="evd-date-type">
              <span className="evd-date-line">
                <time dateTime={event.date} className="evd-date-big">{event.date.replace(/-/g, '.')}</time>
                <span className="evd-day-pill">{locale === 'ja' ? longDay(event.date) : shortWeekday.toUpperCase()}</span>
              </span>
              {event.end_date && event.end_date !== event.date && <span className="evd-date-until">〜 {shortDay(event.end_date)}</span>}
              {countdown && <span className="evd-countdown">{countdown}</span>}
            </div>
          </div>

          <header className="evd-title-block">
            <h1 className="news-detail-title evd-title">{title || venue}</h1>
          </header>

          {event.posterUrl && (
            <a className="event-poster" href={event.posterUrl} target="_blank" rel="noopener noreferrer">
              <img src={event.posterUrl} alt={title || venue} />
              <span className="event-poster-zoom" aria-hidden="true">⤢</span>
            </a>
          )}

        <div className="evd-section evd-details">
          <dl className="event-meta evd-facts">
                <dt>{s.events.venue}</dt>
              <dd>
                {event.venue_id
                  ? <Link className="evd-venue-link" to={`${prefix}/venues/${event.venue_id}`}>{venue}</Link>
                  : venue}
                {event.venue_url && (
                  <a className="evd-venue-site" href={event.venue_url} target="_blank" rel="noopener noreferrer" aria-label={s.venues.website}>↗</a>
                )}
                {area && (
                  <span className="evd-area">
                    {city ? <Link to={`${prefix}/events?q=${encodeURIComponent(city)}`}>{city}</Link> : null}
                    {area.slice(city.length)}
                  </span>
                )}
              </dd>
              {event.doors && (<><dt>{s.events.doors}</dt><dd className="is-number">{event.doors}</dd></>)}
              {event.start && (<><dt>{s.events.start}</dt><dd className="is-number">{event.start}</dd></>)}
              {event.end_time && (<><dt>{s.events.endTime}</dt><dd className="is-number">{event.end_time}</dd></>)}
              {hasPrice(event.adv_price) && (<><dt>{s.events.advPrice}</dt><dd className="is-number">{formatPrice(event.adv_price!, locale, event.country_en)}</dd></>)}
              {hasPrice(event.door_price) && (<><dt>{s.events.doorPrice}</dt><dd className="is-number">{formatPrice(event.door_price!, locale, event.country_en)}</dd></>)}
              {event.performers && (<><dt>{s.events.performers}</dt><dd>{event.performers}</dd></>)}
            </dl>

          {event.ticketUrl && (
            <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer" className="ticket-btn evd-tickets">
              {s.events.tickets} →
            </a>
          )}
          {reserveOpen && (
            <button type="button" className="ticket-btn evd-tickets evd-reserve-btn" onClick={() => setReserveWindow(true)}>
              🎫 {s.reserve.title} →
            </button>
          )}
        </div>
        </aside>

        <div className="evd-main">
            {(event.reserve || previewReserve) && !isPast && (
              <ReserveForm
                locale={locale} eventId={event.id} preview={previewReserve}
                show={{
                  title: title || venue,
                  date: `${event.date.replace(/-/g, '.')}（${locale === 'ja' ? longDay(event.date) : shortWeekday}）`,
                  times: [event.doors && `${s.events.doors} ${event.doors}`, event.start && `${s.events.start} ${event.start}`].filter(Boolean).join(' / '),
                  venue: area ? `${venue}（${area}）` : venue,
                  price: [
                    hasPrice(event.adv_price) && `${s.events.advPrice} ${formatPrice(event.adv_price!, locale, event.country_en)}`,
                    hasPrice(event.door_price) && `${s.events.doorPrice} ${formatPrice(event.door_price!, locale, event.country_en)}`,
                  ].filter(Boolean).join(' / '),
                }}
                open={reserveWindow} onOpenChange={setReserveWindow}
                onState={st => setReserveOpen(st === 'open')}
              />
            )}
            {setGroups.size === 0 && (
              <section className="evd-section">
                <h2 className="section-label">{s.setlist.title}</h2>
                <div className="evd-empty">
                  <p>
                    <span aria-hidden="true">♪</span>
                    {setlistIsPublic(event) ? s.setlist.none : s.setlist.afterShow}
                  </p>
                  {/* Past shows: ask fans who were there */}
                  {setlistIsPublic(event) && (
                    <SetlistTip locale={locale} eventId={event.id} eventTitle={title || venue} variant="empty" />
                  )}
                </div>
              </section>
            )}

            {setGroups.size > 0 && (
              <section className="evd-section">
                <h2 className="section-label">{s.setlist.title}</h2>
                {Array.from(setGroups.entries()).map(([setKey, entries]) => (
                  <div key={setKey} className="setlist-group">
                    {setGroups.size > 1 && <h3 className="setlist-set-label">{setLabel(setKey)}</h3>}
                    <ol className="tracklist">
                      {entries.map((entry, i) => {
                        const song = songs.find(x => x.id && normalize(x.title || '') === normalize(entry.song || ''));
                        return (
                          <li key={`${setKey}-${i}`} value={entry.order}>
                            {song ? <Link to={`${prefix}/songs/${song.id}`}>{entry.song}</Link> : entry.song}
                            {/* Covers say so automatically (from Songs); a note that only says "… cover" would repeat it */}
                            {song?.original_artist && (
                              <span className="setlist-note setlist-cover">({s.songs.coverOf.replace('{artist}', song.original_artist)})</span>
                            )}
                            {entry.notes && !(song?.original_artist && /cover|カバー|カヴァー/i.test(entry.notes)) && (
                              <span className="setlist-note">({entry.notes})</span>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ))}
                <SetlistTip locale={locale} eventId={event.id} eventTitle={title || venue} variant="fix" />
              </section>
            )}

            {body && (
              <section className="evd-section">
                <h2 className="section-label">{s.events.info}</h2>
                {/* Blank lines start a new paragraph; single line breaks are kept */}
                <div className="event-notes" lang={bodyLang}>
                  {body.split(/\n\s*\n/).map((para, i) => <p key={i}>{linkify(para.trim())}</p>)}
                </div>
              </section>
            )}
        </div>
      </div>

      <div className="mt-2">
        <Link to={`${prefix}/events`} className="tag">
          <span>← {s.events.title}</span>
        </Link>
      </div>
    </article>
  );
}
