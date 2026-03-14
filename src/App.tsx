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
import Contact from './pages/Contact';
import News from './pages/News';
import NewsDetail from './pages/NewsDetail';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminEvents from './pages/admin/AdminEvents';
import AdminEventForm from './pages/admin/AdminEventForm';
import AdminVenues from './pages/admin/AdminVenues';
import AdminVenueForm from './pages/admin/AdminVenueForm';
import AdminMusic from './pages/admin/AdminMusic';
import AdminAlbumForm from './pages/admin/AdminAlbumForm';
import AdminSongs from './pages/admin/AdminSongs';
import AdminSongForm from './pages/admin/AdminSongForm';
import AdminNews from './pages/admin/AdminNews';
import AdminNewsForm from './pages/admin/AdminNewsForm';
import RequireAuth from './components/RequireAuth';

// Soft indie pop palette
const BG_COLORS = [
  '#ffe8a3', // warm buttercream
  '#fcc8b2', // peach blush
  '#b8e0d2', // seafoam
  '#c7ceea', // periwinkle
  '#f6d5e3', // rose quartz
  '#d4e4bc', // pistachio
  '#eddcd2', // linen
  '#bcd4e6', // powder blue
];

function pickRandomBg(current?: string) {
  // Avoid repeating the same color twice in a row
  const choices = current ? BG_COLORS.filter(c => c !== current) : BG_COLORS;
  return choices[Math.floor(Math.random() * choices.length)];
}

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

function applyBg(current?: string) {
  const color = pickRandomBg(current);
  document.documentElement.style.setProperty('--bg', color);
  setFavicon(color);
  return color;
}

// Set initial color before first paint
applyBg();

export default function App() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.includes('/admin')) return;
    const current = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    applyBg(current);
  }, [location.pathname]);

  return (
    <Routes>
      {/* Redirect root to browser language */}
      <Route path="/" element={<Navigate to={navigator.language.startsWith('ja') ? '/ja/' : '/en/'} replace />} />

      {/* English routes */}
      <Route path="/en" element={<Layout locale="en" />}>
        <Route index element={<Home locale="en" />} />
        <Route path="events" element={<Events locale="en" />} />
        <Route path="events/:id" element={<EventDetail locale="en" />} />
        <Route path="releases" element={<Music locale="en" />} />
        <Route path="releases/:id" element={<AlbumDetail locale="en" />} />
        <Route path="songs/:id" element={<SongDetail locale="en" />} />
        <Route path="news" element={<News locale="en" />} />
        <Route path="news/:id" element={<NewsDetail locale="en" />} />
        <Route path="about" element={<About locale="en" />} />
        <Route path="contact" element={<Contact locale="en" />} />
      </Route>

      {/* Japanese routes */}
      <Route path="/ja" element={<Layout locale="ja" />}>
        <Route index element={<Home locale="ja" />} />
        <Route path="events" element={<Events locale="ja" />} />
        <Route path="events/:id" element={<EventDetail locale="ja" />} />
        <Route path="releases" element={<Music locale="ja" />} />
        <Route path="releases/:id" element={<AlbumDetail locale="ja" />} />
        <Route path="songs/:id" element={<SongDetail locale="ja" />} />
        <Route path="news" element={<News locale="ja" />} />
        <Route path="news/:id" element={<NewsDetail locale="ja" />} />
        <Route path="about" element={<About locale="ja" />} />
        <Route path="contact" element={<Contact locale="ja" />} />
      </Route>

      {/* Admin routes (under locale, auth-protected) */}
      <Route path="/:locale/admin" element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="events" element={<AdminEvents />} />
          <Route path="events/:id" element={<AdminEventForm />} />
          <Route path="venues" element={<AdminVenues />} />
          <Route path="venues/:id" element={<AdminVenueForm />} />
          <Route path="releases" element={<AdminMusic />} />
          <Route path="releases/:id" element={<AdminAlbumForm />} />
          <Route path="songs" element={<AdminSongs />} />
          <Route path="songs/:id" element={<AdminSongForm />} />
          <Route path="news" element={<AdminNews />} />
          <Route path="news/:id" element={<AdminNewsForm />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/en/" replace />} />
    </Routes>
  );
}
