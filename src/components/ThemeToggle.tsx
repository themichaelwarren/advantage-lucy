import { useCallback, useEffect, useState } from 'react';
import type { Locale } from '../i18n/translations';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'theme';

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Sun/moon switch. The initial theme is applied before first paint by the
 * inline script in index.html (saved choice, else the system setting).
 */
export default function ThemeToggle({ locale, onMouseEnter, onMouseLeave }: {
  locale: Locale;
  onMouseEnter?: React.MouseEventHandler<HTMLElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLElement>;
}) {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  // Follow the system setting live, until the visitor picks one themselves
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      if (storedTheme()) return;
      const next: Theme = e.matches ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode: still works for this visit */ }
    setTheme(next);
  }, []);

  const label = locale === 'ja'
    ? (theme === 'dark' ? 'ライトモードにする' : 'ダークモードにする')
    : (theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-label={label}
      title={label}
    >
      <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" fill="currentColor" />
        <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
      </svg>
      <svg className="icon-moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.2 14.6A8.5 8.5 0 0 1 9.4 3.8a8.5 8.5 0 1 0 10.8 10.8Z" />
        <circle cx="17.5" cy="5.5" r="1" />
        <circle cx="20.5" cy="9" r="0.7" />
      </svg>
    </button>
  );
}
