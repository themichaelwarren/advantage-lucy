import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAllEvents } from '../../hooks/useSheetData';

export default function AdminEvents() {
  const { locale = 'en' } = useParams<{ locale: string }>();
  const prefix = `/${locale}/admin`;
  const { events, loading } = useAllEvents();
  const [search, setSearch] = useState('');

  const filtered = events
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter(e => {
      if (!search) return true;
      const hay = `${e.title_en} ${e.title_ja} ${e.venue_en} ${e.venue_ja} ${e.date}`.toLowerCase();
      return hay.includes(search.toLowerCase());
    });

  if (loading) return <p>Loading...</p>;

  return (
    <>
      <div className="admin-page-header">
        <h1>Events ({events.length})</h1>
        <Link to={`${prefix}/events/new`} className="admin-btn admin-btn-primary">
          + New Event
        </Link>
      </div>

      <input
        type="search"
        className="admin-search"
        placeholder="Search events..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Desktop table */}
      <table className="admin-table admin-desktop-only">
        <thead>
          <tr>
            <th>Date</th>
            <th>Title / ID</th>
            <th>Venue</th>
            <th>City</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(event => (
            <tr key={event.id} className={event.status === 'private' ? 'admin-row-draft' : ''}>
              <td className="admin-td-date">{event.date}</td>
              <td>
                <Link to={`${prefix}/events/${event.id}`}>
                  {event.title_en || event.title_ja || event.id}
                </Link>
              </td>
              <td>{event.venue_en}</td>
              <td>{event.city_en}</td>
              <td>
                <span className={`admin-status ${event.status === 'private' ? 'admin-status-draft' : 'admin-status-live'}`}>
                  {event.status === 'private' ? 'Draft' : 'Live'}
                </span>
              </td>
              <td className="admin-td-actions">
                <Link to={`${prefix}/events/${event.id}`} className="admin-btn admin-btn-sm">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="admin-card-list admin-mobile-only">
        {filtered.map(event => (
          <Link
            key={event.id}
            to={`${prefix}/events/${event.id}`}
            className={`admin-event-card ${event.status === 'private' ? 'admin-event-card-draft' : ''}`}
          >
            <div className="admin-event-card-header">
              <span className="admin-event-card-date">{event.date}</span>
              <span className={`admin-status ${event.status === 'private' ? 'admin-status-draft' : 'admin-status-live'}`}>
                {event.status === 'private' ? 'Draft' : 'Live'}
              </span>
            </div>
            <div className="admin-event-card-title">
              {event.title_en || event.title_ja || event.id}
            </div>
            <div className="admin-event-card-meta">
              {event.venue_en && <span>{event.venue_en}</span>}
              {event.city_en && <span>{event.city_en}</span>}
            </div>
            {event.performers && (
              <div className="admin-event-card-performers">{event.performers}</div>
            )}
          </Link>
        ))}
      </div>

      {filtered.length === 0 && <p className="admin-empty">No events match your search.</p>}
    </>
  );
}
