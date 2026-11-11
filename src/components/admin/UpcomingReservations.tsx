import Icon from './Icon';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getReservations, type Reservation } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import { todayInJapan } from '../../utils/showDates';
import type { Event } from '../../types';

/** Admin home: upcoming shows that take reservations, with how many tickets are booked. */
export default function UpcomingReservations({ events }: { events: Event[] }) {
  const { s, locale, prefix } = useAdminT();
  const [list, setList] = useState<Reservation[] | null>(null);
  const today = todayInJapan();
  const shows = events.filter(e => e.reserve && (e.end_date || e.date) >= today).sort((a, b) => a.date.localeCompare(b.date));

  useEffect(() => {
    if (shows.length) getReservations().then(setList).catch(() => setList([]));
  }, [shows.length]);

  if (!shows.length) return null;
  return (
    <section className="lu-list-group lu-home-reservations">
      <h2>
        <Icon name="ticket" /> {s.reservations}
        <Link to={`${prefix}/reservations`} className="lu-section-link">{s.allReservationsLink} →</Link>
      </h2>
      <ul className="lu-list">
        {shows.map(e => {
          const rs = (list || []).filter(r => r.event === e.id && r.status !== 'cancelled');
          const taken = rs.reduce((n, r) => n + (parseInt(r.tickets, 10) || 0), 0);
          const cap = parseInt(e.reserve_cap || '', 10);
          const name = (locale === 'ja' ? e.title_ja || e.title_en || e.venue_ja : e.title_en || e.title_ja || e.venue_en) || e.id;
          return (
            <li key={e.id}>
              <Link to={`${prefix}/reservations/${e.id}`} className="lu-list-row">
                <time>{e.date}</time>
                <span className="lu-list-main"><strong>{name}</strong></span>
                <span className="lu-list-tags">
                  {list && <span className="lu-tag is-new">{cap > 0 ? s.resvTicketsOf.replace('{n}', String(taken)).replace('{cap}', String(cap)) : s.resvTickets.replace('{n}', String(taken))}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
