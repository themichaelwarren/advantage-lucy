import { Outlet, Link, useLocation, useParams } from 'react-router-dom';

export default function AdminLayout() {
  const location = useLocation();
  const { locale = 'en' } = useParams<{ locale: string }>();
  const prefix = `/${locale}/admin`;

  const navLinks = [
    { to: prefix, label: 'Dashboard', end: true },
    { to: `${prefix}/events`, label: 'Events' },
    { to: `${prefix}/venues`, label: 'Venues' },
    { to: `${prefix}/music`, label: 'Music' },
  ];

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link to={prefix} className="admin-logo">
          aL Admin
        </Link>
        <nav className="admin-nav">
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
        </nav>
        <Link to={`/${locale}`} className="admin-back">
          ← Site
        </Link>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
