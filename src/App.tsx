import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Music from './pages/Music';
import About from './pages/About';
import AlbumDetail from './pages/AlbumDetail';
import SongDetail from './pages/SongDetail';
import VenueDetail from './pages/VenueDetail';
import Contact from './pages/Contact';
import Privacy from './pages/Privacy';
import News from './pages/News';
import NewsDetail from './pages/NewsDetail';
import NotFound from './components/NotFound';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminEvents from './pages/admin/AdminEvents';
import AdminEventForm from './pages/admin/AdminEventForm';
import AdminVenues from './pages/admin/AdminVenues';
import AdminVenueForm from './pages/admin/AdminVenueForm';
import AdminPeople from './pages/admin/AdminPeople';
import AdminPersonForm from './pages/admin/AdminPersonForm';
import AdminAreas from './pages/admin/AdminAreas';
import AdminAreaForm from './pages/admin/AdminAreaForm';
import { AdminPrefectures, AdminPrefectureForm, AdminCountries, AdminCountryForm } from './pages/admin/AdminPlaces';
import AdminMusic from './pages/admin/AdminMusic';
import AdminAlbumForm from './pages/admin/AdminAlbumForm';
import AdminSongs from './pages/admin/AdminSongs';
import AdminVideos from './pages/admin/AdminVideos';
import AdminSongForm from './pages/admin/AdminSongForm';
import AdminNews from './pages/admin/AdminNews';
import AdminNewsForm from './pages/admin/AdminNewsForm';
import AdminBlog from './pages/admin/AdminBlog';
import AdminBlogForm from './pages/admin/AdminBlogForm';
import Blog from './pages/Blog';
import BlogDetail from './pages/BlogDetail';
import AdminPhotos from './pages/admin/AdminPhotos';
import AdminPhotoForm from './pages/admin/AdminPhotoForm';
import AdminMessages from './pages/admin/AdminMessages';
import AdminMessage from './pages/admin/AdminMessage';
import AdminReservations, { AdminShowReservations } from './pages/admin/AdminReservations';
import AdminHelp from './pages/admin/AdminHelp';
import AdminActivity from './pages/admin/AdminActivity';
import RequireAuth from './components/RequireAuth';

import { ACCENTS, pickAccent } from './utils/palette';

function setFavicon(color: string) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/png';
  link.href = canvas.toDataURL('image/png');
}

function shuffleDotColors(exclude: string) {
  const pool = ACCENTS.filter(c => c !== exclude);
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  for (let i = 0; i < 8; i++) {
    document.documentElement.style.setProperty(`--dot-${i + 1}`, pool[i % pool.length]);
  }
}

// The page background is now a fixed warm white (see redesign.css);
// each page view picks a bold accent as `--pop` instead.
function applyBg(current?: string) {
  const color = pickAccent(current);
  document.documentElement.style.setProperty('--pop', color);
  setFavicon(color);
  shuffleDotColors(color);
  return color;
}

// Set initial color before first paint
applyBg();

function WithLanguage() {
  const { pathname, search } = useLocation();
  const lang = navigator.language.startsWith('ja') ? 'ja' : 'en';
  return <Navigate to={`/${lang}${pathname}${search}`} replace />;
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.includes('/admin') || location.pathname === '/') return;
    const current = getComputedStyle(document.documentElement).getPropertyValue('--pop').trim();
    applyBg(current);
  }, [location.pathname]);

  return (
    <Routes>
      {/* Root: straight into the site in the browser's language */}
      <Route path="/" element={<Navigate to={navigator.language.startsWith('ja') ? '/ja' : '/en'} replace />} />
      <Route path="/admin/*" element={<Navigate to={navigator.language.startsWith('ja') ? '/ja/admin' : '/en/admin'} replace />} />

      {/* English routes */}
      <Route path="/en" element={<Layout locale="en" />}>
        <Route index element={<Home locale="en" />} />
        <Route path="events" element={<Events locale="en" />} />
        <Route path="events/:id" element={<EventDetail locale="en" />} />
        <Route path="releases" element={<Music locale="en" />} />
        <Route path="releases/:id" element={<AlbumDetail locale="en" />} />
        <Route path="songs/:id" element={<SongDetail locale="en" />} />
        <Route path="venues/:id" element={<VenueDetail locale="en" />} />
        <Route path="news" element={<News locale="en" />} />
        <Route path="news/:id" element={<NewsDetail locale="en" />} />
        <Route path="blog" element={<Blog locale="en" />} />
        <Route path="blog/:id" element={<BlogDetail locale="en" />} />
        <Route path="about" element={<About locale="en" />} />
        <Route path="contact" element={<Contact locale="en" />} />
        <Route path="privacy" element={<Privacy locale="en" />} />
        <Route path="*" element={<NotFound locale="en" />} />
      </Route>

      {/* Japanese routes */}
      <Route path="/ja" element={<Layout locale="ja" />}>
        <Route index element={<Home locale="ja" />} />
        <Route path="events" element={<Events locale="ja" />} />
        <Route path="events/:id" element={<EventDetail locale="ja" />} />
        <Route path="releases" element={<Music locale="ja" />} />
        <Route path="releases/:id" element={<AlbumDetail locale="ja" />} />
        <Route path="songs/:id" element={<SongDetail locale="ja" />} />
        <Route path="venues/:id" element={<VenueDetail locale="ja" />} />
        <Route path="news" element={<News locale="ja" />} />
        <Route path="news/:id" element={<NewsDetail locale="ja" />} />
        <Route path="blog" element={<Blog locale="ja" />} />
        <Route path="blog/:id" element={<BlogDetail locale="ja" />} />
        <Route path="about" element={<About locale="ja" />} />
        <Route path="contact" element={<Contact locale="ja" />} />
        <Route path="privacy" element={<Privacy locale="ja" />} />
        <Route path="*" element={<NotFound locale="ja" />} />
      </Route>

      {/* Admin routes (under locale, auth-protected) */}
      <Route path="/:locale/admin" element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="events" element={<AdminEvents />} />
          <Route path="events/:id" element={<AdminEventForm />} />
          <Route path="venues" element={<AdminVenues />} />
          <Route path="venues/:id" element={<AdminVenueForm />} />
          <Route path="areas" element={<AdminAreas />} />
          <Route path="areas/:id" element={<AdminAreaForm />} />
          <Route path="prefectures" element={<AdminPrefectures />} />
          <Route path="prefectures/:id" element={<AdminPrefectureForm />} />
          <Route path="countries" element={<AdminCountries />} />
          <Route path="countries/:id" element={<AdminCountryForm />} />
          <Route path="people" element={<AdminPeople />} />
          <Route path="people/:id" element={<AdminPersonForm />} />
          <Route path="releases" element={<AdminMusic />} />
          <Route path="releases/:id" element={<AdminAlbumForm />} />
          <Route path="songs" element={<AdminSongs />} />
          <Route path="videos" element={<AdminVideos />} />
          <Route path="songs/:id" element={<AdminSongForm />} />
          <Route path="news" element={<AdminNews />} />
          <Route path="news/:id" element={<AdminNewsForm />} />
          <Route path="blog" element={<AdminBlog />} />
          <Route path="blog/:id" element={<AdminBlogForm />} />
          <Route path="photos" element={<AdminPhotos />} />
          <Route path="photos/:id" element={<AdminPhotoForm />} />
          <Route path="messages" element={<AdminMessages />} />
          <Route path="messages/:id" element={<AdminMessage />} />
          <Route path="reservations" element={<AdminReservations />} />
          <Route path="reservations/:id" element={<AdminShowReservations />} />
          <Route path="activity" element={<AdminActivity />} />
          <Route path="help" element={<AdminHelp />} />
        </Route>
      </Route>

      {/* Fallback */}
      {/* No language in the address: the same address in the browser's language (a 404 there if it doesn't exist) */}
      <Route path="*" element={<WithLanguage />} />
    </Routes>
  );
}
