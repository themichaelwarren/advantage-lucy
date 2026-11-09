import { useEffect, useRef, useState } from 'react';
import { Outlet, Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminT } from '../../i18n/admin';
import ThemeToggle from '../../components/ThemeToggle';

/**
 * Admin shell.
 *  - Computers (≥ 980px): a left sidebar with every section, grouped, plus
 *    language, theme, "View site" and the signed-in account at the bottom.
 *  - Narrower screens: a compact top bar; on phones the four everyday
 *    sections (Home, Shows, News, Blog) become a bottom tab bar and the rest
 *    live under "More".
 */
export default function AdminLayout() {
  const location = useLocation();
  const { s, locale, prefix } = useAdminT();
  const { user, logout, sessionExpired, login } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMoreOpen(false); setAccountOpen(false); }, [location.pathname]);
  // Close either menu on a click outside it, or on Escape
  useEffect(() => {
    if (!moreOpen && !accountOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMoreOpen(false); setAccountOpen(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [moreOpen, accountOpen]);

  const otherLocale = locale === 'en' ? 'ja' : 'en';
  const otherPath = location.pathname.replace(`/${locale}/admin`, `/${otherLocale}/admin`) + location.search;

  const main = [
    { to: prefix, label: s.home, end: true, icon: '⌂' },
    { to: `${prefix}/events`, label: s.shows, icon: '♪' },
    { to: `${prefix}/news`, label: s.news, icon: '✎' },
    { to: `${prefix}/blog`, label: s.blog, icon: '◎' },
  ];
  const more = [
    { to: `${prefix}/releases`, label: s.releases },
    { to: `${prefix}/songs`, label: s.songs },
    { to: `${prefix}/people`, label: s.people },
    { to: `${prefix}/venues`, label: s.venues },
    { to: `${prefix}/areas`, label: s.areas },
    { to: `${prefix}/photos`, label: s.photos },
    { to: `${prefix}/messages`, label: s.messages },
  ];
  const inMore = more.some(m => location.pathname.startsWith(m.to));

  // Sidebar: everything, grouped
  const groups: { title?: string; links: { to: string; label: string; icon: string; end?: boolean }[] }[] = [
    { links: [{ to: prefix, label: s.home, icon: '⌂', end: true }] },
    { title: s.groupContent, links: [
      { to: `${prefix}/events`, label: s.shows, icon: '♪' },
      { to: `${prefix}/news`, label: s.news, icon: '✎' },
      { to: `${prefix}/blog`, label: s.blog, icon: '◎' },
    ] },
    { title: s.groupMusic, links: [
      { to: `${prefix}/releases`, label: s.releases, icon: '◉' },
      { to: `${prefix}/songs`, label: s.songs, icon: '♫' },
      { to: `${prefix}/people`, label: s.people, icon: '☺' },
    ] },
    { title: s.groupSite, links: [
      { to: `${prefix}/venues`, label: s.venues, icon: '⌖' },
      { to: `${prefix}/areas`, label: s.areas, icon: '◫' },
      { to: `${prefix}/photos`, label: s.photos, icon: '▣' },
      { to: `${prefix}/messages`, label: s.messages, icon: '✉' },
    ] },
  ];

  return (
    <div className="admin-shell lu-shell">
      <aside className="lu-sidebar" aria-label="Admin">
        <Link to={prefix} className="lu-brand band-name">{s.brand}</Link>
        <nav className="lu-side-nav">
          {groups.map((g, i) => (
            <div key={i} className="lu-side-group">
              {g.title && <p className="lu-side-title">{g.title}</p>}
              {g.links.map(l => (
                <NavLink key={l.to} to={l.to} end={l.end} className="lu-side-link">
                  <span className="lu-side-icon" aria-hidden="true">{l.icon}</span>
                  {l.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="lu-side-foot">
          <div className="lu-side-row">
            <Link to={otherPath} className="lu-pill" lang={otherLocale}>{otherLocale === 'ja' ? '日本語' : 'English'}</Link>
            <ThemeToggle locale={locale} />
          </div>
          <Link to={`/${locale}`} className="lu-side-link">
            <span className="lu-side-icon" aria-hidden="true">↗</span>
            {s.viewSite}
          </Link>
          {user && (
            <div className="lu-side-user">
              <span className="lu-avatar-btn" aria-hidden="true">
                {user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : <span>{user.name.slice(0, 1)}</span>}
              </span>
              <span className="lu-side-user-text">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </span>
              <button type="button" className="lu-btn lu-btn-quiet lu-side-signout" onClick={logout}>{s.signOut}</button>
            </div>
          )}
        </div>
      </aside>

      <header className="lu-topbar">
        <Link to={prefix} className="lu-brand band-name">{s.brand}</Link>

        <nav className="lu-nav" aria-label="Admin">
          {main.map(l => (
            <NavLink key={l.to} to={l.to} end={l.end} className="lu-nav-link">
              <span className="lu-nav-icon" aria-hidden="true">{l.icon}</span>
              <span>{l.label}</span>
            </NavLink>
          ))}
          <div className="lu-more" ref={moreRef}>
            <button
              type="button"
              className={`lu-nav-link${inMore ? ' active' : ''}`}
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(o => !o)}
            >
              <span className="lu-nav-icon" aria-hidden="true">⋯</span>
              <span>{s.more}</span>
            </button>
            {moreOpen && (
              <div className="lu-more-menu">
                {more.map(l => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
              </div>
            )}
          </div>
        </nav>

        <div className="lu-topbar-right">
          <Link to={otherPath} className="lu-pill" lang={otherLocale}>
            {otherLocale === 'ja' ? '日本語' : 'English'}
          </Link>
          <ThemeToggle locale={locale} />
          <Link to={`/${locale}`} className="lu-pill lu-hide-phone">{s.viewSite} ↗</Link>
          {user && (
            <div className="lu-account" ref={accountRef}>
              <button
                type="button"
                className="lu-avatar-btn"
                aria-label={s.accountMenu}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                onClick={() => setAccountOpen(o => !o)}
              >
                {user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : <span>{user.name.slice(0, 1)}</span>}
              </button>
              {accountOpen && (
                <div className="lu-account-menu" role="menu">
                  <div className="lu-account-who">
                    <span className="lu-eyebrow">{s.signedInAs}</span>
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <hr />
                  {/* Room for Help / documentation links later */}
                  <Link role="menuitem" to={`/${locale}`}>{s.viewSite} ↗</Link>
                  <hr />
                  <button role="menuitem" type="button" className="is-danger" onClick={logout}>{s.signOut}</button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="lu-content">
      {sessionExpired && (
        <div className="lu-banner" role="alert">
          <span>{s.sessionExpired}</span>
          <button type="button" className="lu-btn lu-btn-primary" onClick={login}>{s.signInAgain}</button>
        </div>
      )}

      <main className="admin-main lu-main">
        <Outlet />
      </main>
      </div>
    </div>
  );
}
