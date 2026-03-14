import { Link, useParams } from 'react-router-dom';
import { useAllEvents, useAlbums } from '../../hooks/useSheetData';

export default function AdminDashboard() {
  const { locale = 'en' } = useParams<{ locale: string }>();
  const prefix = `/${locale}/admin`;
  const { events } = useAllEvents();
  const { albums } = useAlbums();
  const now = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter(e => e.date >= now).length;

  return (
    <>
      <h1>Dashboard</h1>
      <div className="admin-cards">
        <Link to={`${prefix}/events`} className="admin-stat-card">
          <span className="admin-stat-number">{events.length}</span>
          <span className="admin-stat-label">Events</span>
          <span className="admin-stat-sub">{upcoming} upcoming</span>
        </Link>
        <Link to={`${prefix}/music`} className="admin-stat-card">
          <span className="admin-stat-number">{albums.length}</span>
          <span className="admin-stat-label">Releases</span>
        </Link>
        <Link to={`${prefix}/venues`} className="admin-stat-card">
          <span className="admin-stat-number">—</span>
          <span className="admin-stat-label">Venues</span>
        </Link>
      </div>
    </>
  );
}
