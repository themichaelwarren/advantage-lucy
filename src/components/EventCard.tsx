import { Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import type { Event } from '../types';
import { formatDate, getEventTitle } from '../utils/format';

interface Props {
  event: Event;
  locale: Locale;
  featured?: boolean;
}

export default function EventCard({ event, locale, featured }: Props) {
  const s = t(locale);
  const prefix = `/${locale}`;
  const title = getEventTitle(event, locale);
  const venue = locale === 'ja' ? event.venue_ja : event.venue_en;
  const city = locale === 'ja' ? event.city_ja : event.city_en;

  const dateStr = formatDate(event.date, locale);

  return (
    <div className={`event-card${featured ? ' featured' : ''}`}>
      <div className="event-card-date">{dateStr}</div>
      <h3 className="event-card-title">
        <Link to={`${prefix}/events/${event.id}`}>{title}</Link>
      </h3>
      <div className="event-card-venue">{venue}, {city}</div>
      {event.performers && (
        <div className="event-card-performers">{event.performers}</div>
      )}
      <Link to={`${prefix}/events/${event.id}`} className="event-card-link">
        {s.events.details} →
      </Link>
    </div>
  );
}
