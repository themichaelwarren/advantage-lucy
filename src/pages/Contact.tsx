import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import ContactForm from '../components/ContactForm';
import PageTitle from '../components/PageTitle';

interface Props {
  locale: Locale;
}

export default function Contact({ locale }: Props) {
  const s = t(locale);
  return (
    <>
      <PageTitle title={s.nav.contact} />
      <header className="album-detail-header">
        <h1 className="album-detail-title">{s.contact.title}</h1>
        <p className="album-detail-subtitle">{s.contact.subtitle}</p>
      </header>
      <ContactForm locale={locale} />
    </>
  );
}
