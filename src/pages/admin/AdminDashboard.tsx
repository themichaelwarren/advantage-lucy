import { Link, useParams } from 'react-router-dom';
import { useAllEvents, useAlbums, useVenues, useSongs, useAllNews, useAllBlog, useAllPhotos } from '../../hooks/useSheetData';
import { t, type Locale } from '../../i18n/translations';

export default function AdminDashboard() {
  const { locale: rawLocale = 'en' } = useParams<{ locale: string }>();
  const locale = (rawLocale === 'ja' ? 'ja' : 'en') as Locale;
  const s = t(locale).admin;
  const prefix = `/${locale}/admin`;
  const { events } = useAllEvents();
  const { albums } = useAlbums();
  const { venues } = useVenues();
  const { songs } = useSongs();
  const { news } = useAllNews();
  const { blog } = useAllBlog();
  const { photos } = useAllPhotos();
  const now = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter(e => e.date >= now).length;

  return (
    <>
      <h1>{s.dashboard}</h1>
      <div className="admin-cards">
        <Link to={`${prefix}/events`} className="admin-stat-card">
          <span className="admin-stat-number">{events.length}</span>
          <span className="admin-stat-label">{s.events}</span>
          <span className="admin-stat-sub">{upcoming} {s.upcoming}</span>
        </Link>
        <Link to={`${prefix}/releases`} className="admin-stat-card">
          <span className="admin-stat-number">{albums.length}</span>
          <span className="admin-stat-label">{s.releases}</span>
        </Link>
        <Link to={`${prefix}/venues`} className="admin-stat-card">
          <span className="admin-stat-number">{venues.length}</span>
          <span className="admin-stat-label">{s.venues}</span>
        </Link>
        <Link to={`${prefix}/songs`} className="admin-stat-card">
          <span className="admin-stat-number">{songs.length}</span>
          <span className="admin-stat-label">{s.songs}</span>
        </Link>
        <Link to={`${prefix}/news`} className="admin-stat-card">
          <span className="admin-stat-number">{news.length}</span>
          <span className="admin-stat-label">{s.news}</span>
        </Link>
        <Link to={`${prefix}/blog`} className="admin-stat-card">
          <span className="admin-stat-number">{blog.length}</span>
          <span className="admin-stat-label">{s.blog}</span>
        </Link>
        <Link to={`${prefix}/photos`} className="admin-stat-card">
          <span className="admin-stat-number">{photos.length}</span>
          <span className="admin-stat-label">{s.photos}</span>
        </Link>
      </div>
    </>
  );
}
