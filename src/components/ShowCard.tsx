import { Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import type { Event } from '../types';

const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Big-date card for a single show (home page "Next show", top of the Shows page). */
export default function ShowCard({ event, locale, prefix }: { event: Event; locale: Locale; prefix: string }) {
  const d = new Date(event.date + 'T00:00:00');
  const title = locale === 'ja' ? event.title_ja || event.title_en : event.title_en || event.title_ja;
  const venue = locale === 'ja' ? event.venue_ja || event.venue_en : event.venue_en || event.venue_ja;
  const area = locale === 'ja' ? event.city_ja || event.city_en : event.city_en || event.city_ja;
  return (
    <Link to={`${prefix}/events/${event.id}`} className="next-show-hero">
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
      <div className="next-show-body">
        {title ? (
          <>
            <h3 className="next-show-title">{title}</h3>
            <div className="next-show-venue">{venue}</div>
          </>
        ) : (
          <h3 className="next-show-venue">{venue}</h3>
        )}
        {area && <div className="next-show-area">{area}</div>}
      </div>
      <span className="next-show-arrow" aria-hidden="true">→</span>
    </Link>
  );
}
