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
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminEvents from './pages/admin/AdminEvents';
import AdminEventForm from './pages/admin/AdminEventForm';

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

// Set initial color before first paint
document.documentElement.style.setProperty('--bg', pickRandomBg());

export default function App() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.includes('/admin')) return;
    const current = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    document.documentElement.style.setProperty('--bg', pickRandomBg(current));
  }, [location.pathname]);

  return (
    <Routes>
      {/* Redirect root to /en/ */}
      <Route path="/" element={<Navigate to="/en/" replace />} />

      {/* English routes */}
      <Route path="/en" element={<Layout locale="en" />}>
        <Route index element={<Home locale="en" />} />
        <Route path="events" element={<Events locale="en" />} />
        <Route path="events/:id" element={<EventDetail locale="en" />} />
        <Route path="releases" element={<Music locale="en" />} />
        <Route path="releases/:id" element={<AlbumDetail locale="en" />} />
        <Route path="songs/:id" element={<SongDetail locale="en" />} />
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
        <Route path="about" element={<About locale="ja" />} />
        <Route path="contact" element={<Contact locale="ja" />} />
      </Route>

      {/* Admin routes (under locale) */}
      <Route path="/:locale/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="events" element={<AdminEvents />} />
        <Route path="events/:id" element={<AdminEventForm />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/en/" replace />} />
    </Routes>
  );
}
