import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useVenues, useAreas } from '../../hooks/useSheetData';
import { t, type Locale } from '../../i18n/translations';

export default function AdminVenues() {
  const { locale: rawLocale = 'en' } = useParams<{ locale: string }>();
  const locale = (rawLocale === 'ja' ? 'ja' : 'en') as Locale;
  const s = t(locale).admin;
  const prefix = `/${locale}/admin`;
  const { venues, loading } = useVenues();
  const { areas } = useAreas();
  const [search, setSearch] = useState('');

  const areaMap = new Map(areas.map(a => [a.id, a]));

  const filtered = venues
    .sort((a, b) => a.name_en.localeCompare(b.name_en))
    .filter(v => {
      if (!search) return true;
      const area = areaMap.get(v.area);
      const hay = `${v.name_en} ${v.name_ja} ${v.id} ${area?.name_en || ''} ${area?.name_ja || ''}`.toLowerCase();
      return hay.includes(search.toLowerCase());
    });

  if (loading) return <p>{s.loading}</p>;

  return (
    <>
      <div className="admin-page-header">
        <h1>{s.venues} ({venues.length})</h1>
        <Link to={`${prefix}/venues/new`} className="admin-btn admin-btn-primary">
          {s.newVenue}
        </Link>
      </div>

      <input
        type="search"
        className="admin-search"
        placeholder="Search venues..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Desktop table */}
      <table className="admin-table admin-desktop-only">
        <thead>
          <tr>
            <th>Name (EN)</th>
            <th>Name (JA)</th>
            <th>Area</th>
            <th>ID</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(venue => {
            const area = areaMap.get(venue.area);
            return (
              <tr key={venue.id}>
                <td>
                  <Link to={`${prefix}/venues/${venue.id}`}>{venue.name_en}</Link>
                </td>
                <td>{venue.name_ja}</td>
                <td>{area?.name_en || venue.area}</td>
                <td className="admin-td-id">{venue.id}</td>
                <td className="admin-td-actions">
                  <Link to={`${prefix}/venues/${venue.id}`} className="admin-btn admin-btn-sm">
                    Edit
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="admin-card-list admin-mobile-only">
        {filtered.map(venue => {
          const area = areaMap.get(venue.area);
          return (
            <Link
              key={venue.id}
              to={`${prefix}/venues/${venue.id}`}
              className="admin-event-card"
            >
              <div className="admin-event-card-title">{venue.name_en}</div>
              <div className="admin-event-card-meta">
                {venue.name_ja && <span>{venue.name_ja}</span>}
                {area && <span>{area.name_en}</span>}
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && <p className="admin-empty">No venues match your search.</p>}
    </>
  );
}
