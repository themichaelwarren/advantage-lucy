import { useParams, Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useEvents, useSetlists, useSongs } from '../hooks/useSheetData';
import { formatDate, formatPrice, getEventTitle } from '../utils/format';

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

  if (loading) return null;

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

  const title = getEventTitle(event, locale);
  const venue = locale === 'ja' ? event.venue_ja : event.venue_en;
  const city = locale === 'ja' ? event.city_ja : event.city_en;
  const body = locale === 'ja' ? event.body_ja : event.body_en;

  const dateStr = formatDate(event.date, locale, 'long');

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

  return (
    <article className="event-detail">
      <div className="page-title">
        <h1><span>{title}</span></h1>
      </div>

      {event.posterUrl && (
        <div className="event-poster">
          <img src={event.posterUrl} alt={title} />
        </div>
      )}

      <dl className="event-meta">
        <dt>{s.events.date}</dt>
        <dd>{dateStr}</dd>

        <dt>{s.events.venue}</dt>
        <dd>
          {event.venue_url
            ? <a href={event.venue_url} target="_blank" rel="noopener noreferrer">{venue}</a>
            : venue
          }
        </dd>

        <dt>{s.events.location}</dt>
        <dd>
          {city}
          {event.prefecture_en && `, ${locale === 'ja' ? event.prefecture_ja : event.prefecture_en}`}
          {event.country_en && `, ${locale === 'ja' ? event.country_ja : event.country_en}`}
        </dd>

        {(event.doors || event.start) && (
          <>
            {event.doors && (
              <>
                <dt>{s.events.doors}</dt>
                <dd>{event.doors}</dd>
              </>
            )}
            {event.start && (
              <>
                <dt>{s.events.start}</dt>
                <dd>{event.start}</dd>
              </>
            )}
            {event.end_time && (
              <>
                <dt>{s.events.endTime}</dt>
                <dd>{event.end_time}</dd>
              </>
            )}
          </>
        )}

        {(event.adv_price != null && event.adv_price !== '' || event.door_price != null && event.door_price !== '') && (
          <>
            {event.adv_price != null && event.adv_price !== '' && (
              <>
                <dt>{s.events.advPrice}</dt>
                <dd>{formatPrice(event.adv_price, locale, event.country_en)}</dd>
              </>
            )}
            {event.door_price != null && event.door_price !== '' && (
              <>
                <dt>{s.events.doorPrice}</dt>
                <dd>{formatPrice(event.door_price, locale, event.country_en)}</dd>
              </>
            )}
          </>
        )}

        {event.performers && (
          <>
            <dt>{s.events.performers}</dt>
            <dd style={{ textTransform: 'none' }}>{event.performers}</dd>
          </>
        )}
      </dl>

      {event.ticketUrl && (
        <div className="mb-2">
          <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer" className="ticket-btn">
            {s.events.tickets} →
          </a>
        </div>
      )}

      {body && (
        <div className="prose">
          <p>{body}</p>
        </div>
      )}

      {setGroups.size > 0 && (
        <section className="mb-2">
          <h2 className="section-label">{s.setlist.title}</h2>
          {Array.from(setGroups.entries()).map(([setKey, entries]) => (
            <div key={setKey} className="setlist-group">
              {setGroups.size > 1 && (
                <h3 className="setlist-set-label">{setLabel(setKey)}</h3>
              )}
              <ol className="tracklist">
                {entries.map((entry, i) => {
                  const song = songs.find(s => s.title === entry.song);
                  return (
                    <li key={`${setKey}-${i}`} value={entry.order}>
                      {song
                        ? <Link to={`${prefix}/songs/${song.id}`}>{entry.song}</Link>
                        : entry.song
                      }
                      {entry.notes && <span className="setlist-note">({entry.notes})</span>}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </section>
      )}

      <div className="mt-2">
        <Link to={`${prefix}/events`} className="tag">
          <span>← {s.events.title}</span>
        </Link>
      </div>
    </article>
  );
}
