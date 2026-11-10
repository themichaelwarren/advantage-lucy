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
const COLLAPSE_KEY = 'admin-sidebar-collapsed';

const Svg = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

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

  // Computers: the sidebar can fold down to icons (remembered on this device)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const toggleCollapsed = () => setCollapsed(c => {
    try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* private mode: just for this visit */ }
    return !c;
  });
  // ⌘\ / Ctrl+\ folds and unfolds it, as in Notion and VS Code
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== '\\') return;
      e.preventDefault();
      // Computers fold the sidebar; narrower screens open/close the menu
      if (window.matchMedia('(min-width: 980px)').matches) toggleCollapsed();
      else setNavOpen(o => !o);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  // Folded: each icon's name shows beside it on hover or keyboard focus
  // Unfolded, the round tool buttons (data-tip-always) still get one, above
  // them, so it doesn't cover the next button. Shortcuts show as keys.
  const [tip, setTip] = useState<{ text: string; keys?: string; top: number; left: number; above: boolean } | null>(null);
  const showTip = (e: React.SyntheticEvent) => {
    if (!window.matchMedia('(hover: hover)').matches && e.type !== 'focus') return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    const folded = collapsed && window.matchMedia('(min-width: 980px)').matches;
    if (!el || !(folded || el.hasAttribute('data-tip-always'))) { setTip(null); return; }
    const r = el.getBoundingClientRect();
    const above = !folded && el.dataset.tipAt !== 'right';
    setTip({
      text: el.dataset.tip || '', keys: el.dataset.tipKeys,
      top: above ? r.top - 8 : r.top + r.height / 2,
      left: above ? r.left + r.width / 2 : r.right + 10,
      above,
    });
  };
  useEffect(() => { setTip(null); }, [collapsed, location.pathname]);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const keys = {
    search: isMac ? '⌘ K' : 'Ctrl K',
    fold: isMac ? '⌘ \\' : 'Ctrl \\',
    theme: isMac ? '⌘ ⇧ D' : 'Ctrl ⇧ D',
  };

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
      <aside
        id="lu-menu"
        className={`lu-sidebar${navOpen ? ' is-open' : ''}${collapsed ? ' is-collapsed' : ''}`}
        aria-label="Admin"
        onMouseOver={showTip}
        onFocus={showTip}
        onMouseLeave={() => setTip(null)}
        onBlur={() => setTip(null)}
      >
        <div className="lu-side-head">
          <Link to={prefix} className="lu-brand band-name" data-tip={s.home}>
            <span className="lu-brand-full">{s.brand}</span>
            <span className="lu-brand-short" aria-hidden="true">L</span>
          </Link>
          <button
            type="button"
            className="lu-side-tool lu-side-collapse"
            onClick={toggleCollapsed}
            aria-label={collapsed ? s.expandMenu : s.collapseMenu}
            aria-pressed={collapsed}
            data-tip={collapsed ? s.expandMenu : s.collapseMenu}
            data-tip-keys={keys.fold}
            data-tip-always
            data-tip-at="right"
          >
            <Svg d={collapsed ? 'm13 6 6 6-6 6M5 6l6 6-6 6' : 'm11 18-6-6 6-6M19 18l-6-6 6-6'} size={17} />
          </button>
        </div>
        <button type="button" className="lu-side-search" data-tip={s.searchEverythingShort} data-tip-keys={keys.search} aria-label={s.searchEverything} onClick={() => { setNavOpen(false); setPaletteOpen(true); }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
          <span className="lu-side-label">{s.searchEverythingShort}</span>
          <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <nav className="lu-side-nav">
          {groups.map((g, i) => (
            <div key={i} className="lu-side-group">
              {g.title && <p className="lu-side-title">{g.title}</p>}
              {g.links.map(l => (
                <NavLink
                  key={l.to} to={l.to} end={l.end}
                  data-tip={l.badge ? `${l.label} · ${l.badge} ${s.msgNew}` : l.label}
                  className={({ isActive }) => `lu-side-link${isActive || (l.to.endsWith('/areas') && /\/(prefectures|countries)(\/|$)/.test(location.pathname)) ? ' active' : ''}`}
                >
                  <span className="lu-side-icon" aria-hidden="true">{l.icon}</span>
                  <span className="lu-side-label">{l.label}</span>
                  {!!l.badge && <span className="lu-side-badge" aria-label={`${l.badge} ${s.msgNew}`}>{l.badge}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="lu-side-foot">
          <div className="lu-side-tools">
            <Link to={otherPath} className="lu-side-tool lu-side-lang" lang={otherLocale} data-tip={otherLocale === 'ja' ? '日本語に切り替え' : 'Switch to English'} data-tip-always>
              {otherLocale === 'ja' ? <><span className="lu-side-label">日本語</span><span className="lu-side-short" aria-hidden="true">日</span></> : <><span className="lu-side-label">English</span><span className="lu-side-short" aria-hidden="true">EN</span></>}
            </Link>
            <span data-tip={locale === 'ja' ? 'ライト／ダーク' : 'Light / dark'} data-tip-keys={keys.theme} data-tip-always><ThemeToggle locale={locale} noTitle /></span>
            <NavLink to={`${prefix}/help`} className="lu-side-tool" aria-label={s.help} data-tip={s.help} data-tip-always>?</NavLink>
            <Link to={`/${locale}`} className="lu-side-tool" aria-label={s.viewSite} data-tip={s.viewSite} data-tip-always>
              <Svg d="M7 17 17 7M8 7h9v9" size={17} />
            </Link>
          </div>
          {user && (
            <div className="lu-side-user">
              <span className="lu-avatar-btn" aria-hidden="true" data-tip={`${user.name} · ${user.email}`}>
                {user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : <span>{user.name.slice(0, 1)}</span>}
              </span>
              <span className="lu-side-user-text">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </span>
              <button type="button" className="lu-side-tool lu-side-signout" onClick={logout} aria-label={s.signOut} data-tip={s.signOut} data-tip-always>
                <Svg d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" size={17} />
              </button>
            </div>
          )}
        </div>
      </aside>
      {tip && (
        <div className={`lu-side-tip${tip.above ? ' is-above' : ''}`} role="tooltip" style={{ top: tip.top, left: tip.left }}>
          {tip.text}
          {tip.keys && <span className="lu-side-tip-keys">{tip.keys.split(' ').map((k, i) => <kbd key={i}>{k}</kbd>)}</span>}
        </div>
      )}

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
