import { linkify } from '../utils/linkify';
import type { ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useNews } from '../hooks/useSheetData';
import { useFitsViewport } from '../hooks/useFitsViewport';
import PageLoader from '../components/PageLoader';
import NotFound from '../components/NotFound';
import type { NewsPost } from '../types';
import PageTitle from '../components/PageTitle';
import BackLink from '../components/BackLink';

/** A line that is only [text](url) links: those become buttons. */
const LINK_ONLY = /^\s*(\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)\s*)+$/;
const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g;

/**
 * News text: a blank line starts a new paragraph, single line breaks are
 * kept. Lines that are only [text](url) links become a row of buttons
 * (several in a row sit side by side); links inside a sentence stay links.
 * **bold** works as in the rest of the site.
 */
function renderBody(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let lines: string[] = [];
  let buttons: { label: string; href: string }[] = [];
  const flushLines = () => {
    if (!lines.length) return;
    const key = `p${out.length}`;
    out.push(
      <p key={key}>
        {lines.flatMap((l, i) => (i ? [<br key={`${key}br${i}`} />, ...linkify(l, `${key}-${i}-`)] : linkify(l, `${key}-${i}-`)))}
      </p>,
    );
    lines = [];
  };
  // A run of link-only lines is one row of buttons, even across blank lines
  const flushButtons = () => {
    if (!buttons.length) return;
    out.push(
      <div key={`b${out.length}`} className="news-links">
        {buttons.map((b, i) => (
          <a key={i} href={b.href} target="_blank" rel="noopener noreferrer" className="ticket-btn">{b.label} →</a>
        ))}
      </div>,
    );
    buttons = [];
  };
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (LINK_ONLY.test(line)) {
      flushLines();
      for (const m of line.matchAll(LINK)) buttons.push({ label: m[1], href: m[2] });
    } else if (line.trim()) {
      flushButtons();
      lines.push(line);
    } else {
      flushLines(); // blank line: new paragraph
    }
  }
  flushLines();
  flushButtons();
  return out;
}

interface Props {
  locale: Locale;
}

export default function NewsDetail({ locale }: Props) {
  const s = t(locale);
  const prefix = `/${locale}`;
  const { id } = useParams<{ id: string }>();
  const { news, loading } = useNews();
  // The left panel only sticks when it fits on screen, as on show pages
  const panel = useFitsViewport<HTMLElement>();

  if (loading) return <PageLoader locale={locale} />;

  // Newest first, the same order as the News page
  const sorted = [...news].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const at = sorted.findIndex(n => n.id === id);
  const post = sorted[at];

  if (!post) {
    return <NotFound locale={locale} what={locale === 'ja' ? 'この記事' : 'This post'} back={{ to: `${prefix}/news`, label: s.news.all }} />;
  }

  // Fall back to the other language when a translation is missing
  const titleOf = (p: NewsPost) => (locale === 'ja' ? p.title_ja || p.title_en : p.title_en || p.title_ja) || '';
  const title = titleOf(post);
  const body = (locale === 'ja' ? post.body_ja || post.body_en : post.body_en || post.body_ja) || '';
  const bodyLang = locale === 'ja' ? (post.body_ja ? 'ja' : 'en') : (post.body_en ? 'en' : 'ja');

  const weekday = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-GB', { weekday: locale === 'ja' ? 'long' : 'short', timeZone: 'UTC' })
    .format(new Date(`${post.date}T00:00:00Z`));
  const newer = at > 0 ? sorted[at - 1] : undefined;
  const older = sorted[at + 1];
  const more = sorted.filter(n => n.id !== post.id).slice(0, 4);

  return (
    <article className="event-detail news-page">
      <BackLink to={`${prefix}/news`} label={s.news.title} />
      <PageTitle title={title} />
      {/* Like a show page: date, title and image on the left (sticky when it
          fits); the text, links and other news on the right. Phones: stacked. */}
      <div className="evd-layout">
        <aside ref={panel.ref} className={`evd-aside${panel.fits ? ' is-sticky' : ''}`} style={{ top: panel.top }}>
          <div className="evd-head">
            <div className="evd-date-type">
              <span className="evd-date-line">
                <time dateTime={post.date} className="evd-date-big">{post.date.replace(/-/g, '.')}</time>
                <span className="evd-day-pill">{locale === 'ja' ? weekday : weekday.toUpperCase()}</span>
              </span>
            </div>
          </div>

          <header className="evd-title-block">
            <h1 className="news-detail-title evd-title">{title}</h1>
          </header>

          {post.image_url && (
            <a className="event-poster" href={post.image_url} target="_blank" rel="noopener noreferrer" aria-label={s.news.viewImage}>
              <img src={post.image_url} alt={title} />
              <span className="event-poster-zoom" aria-hidden="true">⤢</span>
            </a>
          )}
        </aside>

        <div className="evd-main">
          {body && (
            <section className="evd-section">
              <div className="prose news-body" lang={bodyLang}>{renderBody(body)}</div>
            </section>
          )}

          {(newer || older) && (
            <nav className="news-pager" aria-label={s.news.title}>
              {older ? (
                <Link to={`${prefix}/news/${older.id}`} className="news-pager-link is-older">
                  <span className="news-pager-dir">← {s.news.older}</span>
                  <strong>{titleOf(older)}</strong>
                </Link>
              ) : <span />}
              {newer ? (
                <Link to={`${prefix}/news/${newer.id}`} className="news-pager-link is-newer">
                  <span className="news-pager-dir">{s.news.newer} →</span>
                  <strong>{titleOf(newer)}</strong>
                </Link>
              ) : <span />}
            </nav>
          )}

          {more.length > 0 && (
            <section className="evd-section">
              <div className="section-header-row">
                <h2 className="section-label">{s.news.more}</h2>
                <Link to={`${prefix}/news`} className="section-view-all">{s.news.all} →</Link>
              </div>
              <ul className="show-list">
                {more.map(n => (
                  <li key={n.id}>
                    <Link to={`${prefix}/news/${n.id}`} className="show-row">
                      <time dateTime={n.date}>{n.date}</time>
                      <span className="show-row-main"><strong>{titleOf(n)}</strong></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <div className="mt-2">
        <Link to={`${prefix}/news`} className="tag"><span>← {s.news.title}</span></Link>
      </div>
    </article>
  );
}
