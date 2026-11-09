import { linkify } from '../utils/linkify';
import { useParams, Link } from 'react-router-dom';
import { normalize } from '../utils/text';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useEvents, useSetlists, useSongs } from '../hooks/useSheetData';
import { formatDateWithDay, formatPrice } from '../utils/format';
import PageLoader from '../components/PageLoader';
import { setlistIsPublic } from '../utils/showDates';
import { useFitsViewport } from '../hooks/useFitsViewport';
import SetlistTip from '../components/SetlistTip';

const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

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

  const dateStr = formatDateWithDay(event.date, locale);
  const d = new Date(event.date + 'T00:00:00');
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

  return (
    <article className="event-detail">
      {/* Wide screens: date, title and flyer in a sticky panel on the left;
          details, tickets, setlist and notes on the right. Phones: stacked. */}
      <div className="evd-layout">
        <aside ref={panel.ref} className={`evd-aside${panel.fits ? ' is-sticky' : ''}`}>
          <div className="evd-head">
            {locale === 'ja' ? (
              <div className="next-show-date next-show-date-ja">
                <span className="next-show-year">{d.getFullYear()}</span>
                <span className="next-show-monthday">{d.getMonth() + 1}.{d.getDate()}</span>
              </div>
            ) : (
              <div className="next-show-date">
                <span className="next-show-month">{MONTHS_EN[d.getMonth()]}</span>
                <span className="next-show-day">{d.getDate()}</span>
                <span className="next-show-year">{d.getFullYear()}</span>
              </div>
            )}
            <time className="evd-weekday" dateTime={event.date}>{dateStr}</time>
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
                {event.venue_url
                  ? <a className="evd-venue-link" href={event.venue_url} target="_blank" rel="noopener noreferrer">{venue}</a>
                  : venue}
                {area && <span className="evd-area">{area}</span>}
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
        </div>
        </aside>

        <div className="evd-main">
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
                            {entry.notes && <span className="setlist-note">({entry.notes})</span>}
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
