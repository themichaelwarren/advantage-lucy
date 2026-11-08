import { useEffect, useState } from 'react';
import type { Locale } from '../i18n/translations';

/**
 * Phones: once the song title scrolls off screen, a little "now playing"
 * pill with the title slides up at the bottom. Tap it to go back to the top.
 * (Wide screens don't need it: the title sits in a sticky side panel.)
 */
export default function NowPlaying({ title, locale, watch }: { title: string; locale: Locale; watch: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = document.querySelector(watch);
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      // Show only after the title has scrolled up and out, not while it's still below
      setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [watch]);

  return (
    <button
      type="button"
      className={`now-playing${visible ? ' is-visible' : ''}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      aria-label={locale === 'ja' ? `${title}（ページの先頭へ）` : `${title} (back to top)`}
    >
      <span className="now-playing-note" aria-hidden="true">♪</span>
      <span className="now-playing-title">{title}</span>
      <span aria-hidden="true">↑</span>
    </button>
  );
}
