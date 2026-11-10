import { Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import PageTitle from './PageTitle';

/**
 * The 404 page: the whole band, looking a bit lost. Used for addresses
 * that don't exist and for a show, post, release, song or venue that
 * isn't there (pass `what` and where to go back to).
 */
export default function NotFound({ locale, what, back }: {
  locale: Locale;
  /** e.g. "このライブ" / "This show". Blank: the page itself. */
  what?: string;
  back?: { to: string; label: string };
}) {
  const s = t(locale);
  const prefix = `/${locale}`;
  const ja = locale === 'ja';
  const lead = what
    ? (ja ? `${what}は見つかりませんでした。` : `${what} isn’t here.`)
    : (ja ? 'このページは見つかりませんでした。' : 'This page isn’t here.');

  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <PageTitle title={ja ? 'ページが見つかりません' : 'Not found'} />
      <img className="not-found-art" src="/img/lucy-band-404.png" alt="" width="1200" height="771" />
      <p className="not-found-code" aria-hidden="true">404</p>
      <h1 id="not-found-title" className="not-found-title">
        {ja ? 'みんなで探したけど…' : 'We all looked, but…'}
      </h1>
      <p className="not-found-lead">
        {lead}
        <br />
        {ja ? 'アドレスが変わったか、なくなってしまったのかもしれません。' : 'It may have moved, or it’s gone.'}
      </p>
      <div className="not-found-actions">
        {back && <Link to={back.to} className="ticket-btn">{back.label} →</Link>}
        <Link to={prefix} className={back ? 'tag' : 'ticket-btn'}><span>{s.nav.home}{back ? '' : ' →'}</span></Link>
      </div>
    </section>
  );
}
