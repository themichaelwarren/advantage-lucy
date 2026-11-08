import { useEffect, useState } from 'react';
import type { Locale } from '../i18n/translations';

/**
 * Shown while a page's data loads. Waits a moment before appearing so quick
 * loads don't flash it; then a little record spins.
 */
export default function PageLoader({ locale }: { locale: Locale }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShow(true), 300);
    return () => window.clearTimeout(t);
  }, []);
  if (!show) return <div className="page-loader" aria-hidden="true" />;
  return (
    <div className="page-loader is-visible" role="status">
      <span className="page-loader-record" aria-hidden="true" />
      <span className="page-loader-text">{locale === 'ja' ? '読み込み中…' : 'Loading…'}</span>
    </div>
  );
}
