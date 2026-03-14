import { Outlet, Link, useLocation } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';

interface Props {
  locale: Locale;
}

const SOCIAL_LINKS = [
  {
    label: 'Instagram',
    href: 'https://instagram.com/lucy_aiko',
    icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10m0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6"/></svg>,
  },
  {
    label: 'X',
    href: 'https://twitter.com/the_wind_blows',
    icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  },
  {
    label: 'Facebook',
    href: 'https://facebook.com/advantagelucyofficial',
    icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12"/></svg>,
  },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/channel/UCwSGxRwsow7G8a2Ol_HsHJg',
    icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
  },
  {
    label: 'SoundCloud',
    href: 'https://soundcloud.com/advantagelucy',
    icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.057-.05-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.282c.013.06.045.094.104.094.057 0 .09-.035.104-.094l.2-1.282-.2-1.332c-.014-.057-.047-.094-.104-.094m1.8-1.16c-.063 0-.11.048-.116.109l-.216 2.563.216 2.465c.007.06.053.1.116.1.065 0 .11-.04.12-.1l.243-2.465-.244-2.563c-.01-.06-.054-.109-.12-.109m.862-.291c-.073 0-.127.055-.133.12l-.217 2.854.206 2.727c.006.075.06.13.133.13.07 0 .127-.055.135-.13l.233-2.727-.233-2.854c-.008-.065-.064-.12-.135-.12m.87-.418c-.082 0-.142.06-.15.135l-.2 3.272.2 2.896c.008.075.068.13.15.13.08 0 .14-.055.15-.13l.227-2.896-.226-3.272c-.012-.075-.072-.135-.152-.135m.935-.267c-.09 0-.158.068-.163.148l-.177 3.54.177 3.024c.005.084.073.148.163.148.09 0 .155-.064.163-.148l.2-3.024-.2-3.54c-.008-.08-.073-.148-.163-.148m.92-.093c-.1 0-.17.074-.177.163l-.164 3.633.164 3.096c.007.09.078.156.177.156s.168-.066.177-.156l.184-3.096-.184-3.633c-.009-.09-.078-.163-.177-.163m.967.186c-.108 0-.186.08-.19.176l-.145 3.447.145 3.12c.004.1.082.176.19.176.106 0 .184-.076.19-.176l.164-3.12-.164-3.447c-.006-.096-.084-.176-.19-.176m.965-.238c-.117 0-.2.088-.204.19L7.19 14.48l.13 3.14c.004.1.087.186.203.186.115 0 .198-.085.204-.186l.148-3.14-.148-3.676c-.006-.103-.09-.19-.205-.19m1.032.238c-.126 0-.214.093-.218.2l-.118 3.438.118 3.14c.004.108.092.196.218.196.124 0 .212-.088.218-.196l.13-3.14-.13-3.438c-.006-.107-.094-.2-.218-.2m2.06-.36c-.136 0-.233.1-.236.213l-.1 3.6.1 3.14c.003.115.1.21.235.21s.232-.095.237-.21l.11-3.14-.11-3.6c-.005-.114-.102-.213-.237-.213m-1.03.164c-.127 0-.22.097-.224.21l-.112 3.584.112 3.14c.004.114.097.206.224.206.125 0 .22-.092.224-.206l.124-3.14-.124-3.584c-.004-.113-.1-.21-.224-.21m2.068-.31c-.146 0-.248.106-.25.22l-.083 3.72.083 3.14c.002.12.104.213.25.213.143 0 .246-.094.25-.213l.094-3.14-.094-3.72c-.004-.114-.107-.22-.25-.22m1.016.164c-.153 0-.26.11-.262.227l-.07 3.556.07 3.14c.003.12.109.22.262.22.15 0 .258-.1.262-.22l.077-3.14-.077-3.556c-.004-.117-.112-.227-.262-.227m1.078-.382c-.054-.018-.113-.028-.175-.028-.637 0-1.152.477-1.217 1.1-.25-.137-.532-.21-.832-.21-1.002 0-1.81.815-1.81 1.822v5.097c0 .136.107.24.24.24h6.06c1.227 0 2.22-1 2.22-2.235s-.993-2.236-2.22-2.236c-.303 0-.59.06-.853.17-.088-2.106-1.826-3.785-3.96-3.785-.21 0-.42.018-.623.052"/></svg>,
  },
];

export default function Layout({ locale }: Props) {
  const s = t(locale);
  const location = useLocation();
  const otherLocale = locale === 'en' ? 'ja' : 'en';
  // Build the equivalent path in the other language
  const otherPath = location.pathname.replace(`/${locale}`, `/${otherLocale}`);

  const prefix = `/${locale}`;

  const navLinks = [
    { to: `${prefix}/events`, label: s.nav.events },
    { to: `${prefix}/releases`, label: s.nav.music },
    { to: `${prefix}/about`, label: s.nav.about },
    { to: `${prefix}/contact`, label: s.nav.contact },
  ];

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>

      <header className="site-header">
        <Link to={prefix} className="site-logo band-name">
          advantage Lucy
        </Link>

        <nav className="nav-main" aria-label="Main navigation">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={
                location.pathname.startsWith(link.to) ? 'page' : undefined
              }
            >
              {link.label}
            </Link>
          ))}
          <Link to={otherPath} className="lang-toggle" aria-label={`Switch to ${otherLocale === 'en' ? 'English' : '日本語'}`}>
            {s.language}
          </Link>
        </nav>
      </header>

      <main id="main" className="container">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container">
          <p>{s.footer.copyright}</p>
          <div className="social-links">
            {SOCIAL_LINKS.map(link => (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label}>
                {link.icon}
                <span>{link.label}</span>
              </a>
            ))}
          </div>
        </div>
      </footer>
    </>
  );
}
