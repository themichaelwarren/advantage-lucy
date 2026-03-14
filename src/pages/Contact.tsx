import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';

interface Props {
  locale: Locale;
}

export default function Contact({ locale }: Props) {
  const s = t(locale);

  return (
    <>
      <div className="page-title">
        <h1><span>{s.contact.title}</span></h1>
        <p className="show-count">
          <span style={{ background: 'var(--surface)', padding: '0.1em 0.4em' }}>
            {s.contact.subtitle}
          </span>
        </p>
      </div>

      <div className="contact-embed">
        <iframe
          src="https://docs.google.com/forms/d/e/1FAIpQLSfZdN0VTZnmdITUKr9gJBhz6FNEDgyUeM52PrHeG55H-baCiA/viewform?embedded=true"
          title={s.contact.title}
          loading="lazy"
        >
          Loading...
        </iframe>
      </div>
    </>
  );
}
