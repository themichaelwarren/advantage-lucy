import { useEffect } from 'react';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';

interface Props {
  locale: Locale;
}

export default function Contact({ locale }: Props) {
  const s = t(locale);

  useEffect(() => {
    const TALLY_SRC = 'https://tally.so/widgets/embed.js';
    if ((window as any).Tally) {
      (window as any).Tally.loadEmbeds();
      return;
    }
    if (!document.querySelector(`script[src="${TALLY_SRC}"]`)) {
      const script = document.createElement('script');
      script.src = TALLY_SRC;
      script.onload = () => (window as any).Tally?.loadEmbeds();
      document.body.appendChild(script);
    }
  }, []);

  return (
    <>
      <header className="album-detail-header">
        <h1 className="album-detail-title">{s.contact.title}</h1>
        <p className="album-detail-subtitle">{s.contact.subtitle}</p>
      </header>

      <div className="contact-embed">
        <iframe
          data-tally-src="https://tally.so/embed/XxBLjd?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1"
          loading="lazy"
          width="100%"
          height={557}
          frameBorder={0}
          title={s.contact.title}
        />
      </div>
    </>
  );
}
