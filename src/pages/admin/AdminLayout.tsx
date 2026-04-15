import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { t, type Locale } from '../../i18n/translations';

export default function AdminLayout() {
  const location = useLocation();
  const { locale: rawLocale = 'en' } = useParams<{ locale: string }>();
  const locale = (rawLocale === 'ja' ? 'ja' : 'en') as Locale;
  const s = t(locale).admin;
  const prefix = `/${locale}/admin`;
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on navigation
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { to: prefix, label: s.dashboard, end: true },
    { to: `${prefix}/events`, label: s.events },
    { to: `${prefix}/venues`, label: s.venues },
    { to: `${prefix}/releases`, label: s.releases },
    { to: `${prefix}/songs`, label: s.songs },
    { to: `${prefix}/news`, label: s.news },
    { to: `${prefix}/blog`, label: s.blog },
    { to: `${prefix}/photos`, label: s.photos },
  ];

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link to={prefix} className="admin-logo">
          aL Admin
        </Link>
        <nav className={`admin-nav${menuOpen ? ' open' : ''}`}>
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={
                link.end
                  ? location.pathname === link.to ? 'active' : ''
                  : location.pathname.startsWith(link.to) ? 'active' : ''
              }
            >
              {link.label}
            </Link>
          ))}
          <Link to={`/${locale}`} className="admin-nav-site">
            {s.backToSite}
          </Link>
        </nav>
        <div className="admin-header-right">
          {user && (
            <span className="admin-user">
              {user.picture && <img src={user.picture} alt="" className="admin-avatar" />}
              <span className="admin-user-email">{user.email}</span>
              <button className="admin-btn admin-btn-sm" onClick={logout}>{s.signOut}</button>
            </span>
          )}
          <Link to={`/${locale}`} className="admin-back">
            {s.backToSite}
          </Link>
        </div>
        <button
          className="admin-menu-toggle"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor">
            {menuOpen ? (
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            ) : (
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            )}
          </svg>
        </button>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
