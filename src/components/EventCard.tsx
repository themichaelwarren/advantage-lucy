import { Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import type { Event } from '../types';
import { formatDate } from '../utils/format';

export const SetlistIcon = (
  <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 0h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2zm0 1a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H5z"/>
    <path d="M5.5 4h5M5.5 6.5h5M5.5 9h3" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round"/>
    <path d="M2 3v11a1 1 0 0 0 1 1h9" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round"/>
  </svg>
);

interface Props {
  event: Event;
  locale: Locale;
  featured?: boolean;
  hasSetlist?: boolean;
}

export default function EventCard({ event, locale, featured, hasSetlist }: Props) {
  const prefix = `/${locale}`;
  const venue = locale === 'ja' ? event.venue_ja : event.venue_en;
  const area = locale === 'ja' ? event.city_ja : event.city_en;
  const tooltip = locale === 'ja' ? 'セットリストあり' : 'Setlist available';

  const dateStr = formatDate(event.date, locale);

  return (
    <Link to={`${prefix}/events/${event.id}`} className={`event-card${featured ? ' featured' : ''}`}>
      <div className="event-card-date">{dateStr}</div>
      <h3 className="event-card-venue-title">
        {venue}
        {hasSetlist && <span className="setlist-badge" data-tooltip={tooltip}>{SetlistIcon}</span>}
      </h3>
      <div className="event-card-area">{area}</div>
    </Link>
  );
}
