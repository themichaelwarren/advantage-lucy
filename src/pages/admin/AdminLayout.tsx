import { useEffect, useRef, useState } from 'react';
import { Outlet, Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminT } from '../../i18n/admin';
import ThemeToggle from '../../components/ThemeToggle';
import CommandPalette from '../../components/admin/CommandPalette';
import { getMessages } from '../../services/adminService';

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
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [newMessages, setNewMessages] = useState(0);
  const lastCount = useRef(0);

  // Count of new messages for the sidebar. Rechecked when you move between
  // pages, at most once a minute (each check reads the sheet).
  useEffect(() => {
    const onMessages = location.pathname.includes('/admin/messages');
    if (!onMessages && Date.now() - lastCount.current < 60_000) return;
    lastCount.current = Date.now();
    getMessages().then(list => setNewMessages(list.filter(m => !m.status).length)).catch(() => {});
  }, [location.pathname]);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => { setNavOpen(false); setPaletteOpen(false); }, [location.pathname]);
  // ⌘K / Ctrl+K: search everything. Text boxes that use ⌘K themselves
  // (the link button in notes) handle it first and stop it here.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'k') return;
      e.preventDefault();
      setPaletteOpen(o => !o);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  // Phone/tablet menu: Esc closes it; the page behind doesn't scroll while open
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setNavOpen(false); menuButton.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [navOpen]);

  const otherLocale = locale === 'en' ? 'ja' : 'en';
  const otherPath = location.pathname.replace(`/${locale}/admin`, `/${otherLocale}/admin`) + location.search;

  // Sidebar: everything, grouped
  // Ordered by how often the band uses them: home and the inbox first, then
  // what gets published, the music archive, and where shows happen
  const groups: { title?: string; links: { to: string; label: string; icon: string; end?: boolean; badge?: number }[] }[] = [
    { links: [
      { to: prefix, label: s.home, icon: '⌂', end: true },
      { to: `${prefix}/messages`, label: s.messages, icon: '✉', badge: newMessages },
      { to: `${prefix}/reservations`, label: s.reservations, icon: '🎫' },
    ] },
    { title: s.groupContent, links: [
      { to: `${prefix}/events`, label: s.shows, icon: '♪' },
      { to: `${prefix}/news`, label: s.news, icon: '✎' },
      { to: `${prefix}/blog`, label: s.blog, icon: '◎' },
      { to: `${prefix}/photos`, label: s.photos, icon: '▣' },
    ] },
    { title: s.groupMusic, links: [
      { to: `${prefix}/releases`, label: s.releases, icon: '◉' },
      { to: `${prefix}/songs`, label: s.songs, icon: '♫' },
      { to: `${prefix}/people`, label: s.people, icon: '☺' },
    ] },
    { title: s.groupPlaces, links: [
      { to: `${prefix}/venues`, label: s.venues, icon: '⌖' },
      { to: `${prefix}/areas`, label: s.areas, icon: '◫' },
    ] },
  ];

  return (
    <div className="admin-shell lu-shell">
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {navOpen && <div className="lu-nav-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <aside id="lu-menu" className={`lu-sidebar${navOpen ? ' is-open' : ''}`} aria-label="Admin">
        <Link to={prefix} className="lu-brand band-name">{s.brand}</Link>
        <button type="button" className="lu-side-search" onClick={() => { setNavOpen(false); setPaletteOpen(true); }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg> {s.searchEverythingShort}
          <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <nav className="lu-side-nav">
          {groups.map((g, i) => (
            <div key={i} className="lu-side-group">
              {g.title && <p className="lu-side-title">{g.title}</p>}
              {g.links.map(l => (
                <NavLink
                  key={l.to} to={l.to} end={l.end}
                  className={({ isActive }) => `lu-side-link${isActive || (l.to.endsWith('/areas') && /\/(prefectures|countries)(\/|$)/.test(location.pathname)) ? ' active' : ''}`}
                >
                  <span className="lu-side-icon" aria-hidden="true">{l.icon}</span>
                  {l.label}
                  {!!l.badge && <span className="lu-side-badge" aria-label={`${l.badge} ${s.msgNew}`}>{l.badge}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="lu-side-foot">
          <div className="lu-side-row">
            <Link to={otherPath} className="lu-pill" lang={otherLocale}>{otherLocale === 'ja' ? '日本語' : 'English'}</Link>
            <ThemeToggle locale={locale} />
            <NavLink to={`${prefix}/help`} className="lu-help-btn" aria-label={s.help} title={s.help}>?</NavLink>
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

      {/* Phones and tablets: logo, search and a menu button; the sidebar slides in as the menu */}
      <header className="lu-topbar">
        <Link to={prefix} className="lu-brand band-name">{s.brand}</Link>
        <div className="lu-topbar-right">
          <button type="button" className="lu-pill lu-topbar-search" onClick={() => setPaletteOpen(true)} aria-label={s.searchEverything}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg></button>
          <button
            ref={menuButton}
            type="button"
            className="lu-menu-btn"
            aria-label={s.menu}
            aria-expanded={navOpen}
            aria-controls="lu-menu"
            onClick={() => setNavOpen(o => !o)}
          >
            <span aria-hidden="true" />
          </button>
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
