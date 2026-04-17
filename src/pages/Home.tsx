import { Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useEvents, useNews, useBlog } from '../hooks/useSheetData';

const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

interface Props {
  locale: Locale;
}

function HomeNews({ news, locale, prefix, s }: { news: import('../types').NewsPost[]; locale: Locale; prefix: string; s: ReturnType<typeof t> }) {
  if (news.length === 0) return null;
  const latestNews = [...news].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  return (
    <section className="home-section">
      <div className="section-header-row">
        <h2 className="section-label">{s.home.latestNews}</h2>
        <Link to={`${prefix}/news`} className="section-view-all">{s.home.viewAllNews} →</Link>
      </div>

      {latestNews.map(post => {
        const title = locale === 'ja' ? post.title_ja : post.title_en;
        return (
          <Link key={post.id} to={`${prefix}/news/${post.id}`} className="home-blog-item">
            <time>{post.date}</time>
            <span className="home-blog-item-title">{title}</span>
          </Link>
        );
      })}
    </section>
  );
}

export default function Home({ locale }: Props) {
  const s = t(locale);
  const prefix = `/${locale}`;
  const { events, loading: eventsLoading } = useEvents();
  const { news } = useNews();
  const { blog } = useBlog();
  const now = new Date().toISOString().slice(0, 10);

  const upcoming = events
    .filter(e => e.date >= now)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextShow = upcoming[0];

  if (eventsLoading) return null;

  return (
    <>
      {/* Next show — hero */}
      {nextShow && (() => {
        const d = new Date(nextShow.date + 'T00:00:00');
        const title = locale === 'ja' ? nextShow.title_ja : nextShow.title_en;
        const venue = locale === 'ja' ? nextShow.venue_ja : nextShow.venue_en;
        const area = locale === 'ja' ? nextShow.city_ja : nextShow.city_en;
        return (
          <section className="home-section">
            <div className="section-header-row">
              <h2 className="section-label">{s.home.nextShow}</h2>
              <Link to={`${prefix}/events`} className="section-view-all">{s.home.viewAllEvents} →</Link>
            </div>
            <Link to={`${prefix}/events/${nextShow.id}`} className="next-show-hero">
              {locale === 'ja' ? (
                <div className="next-show-date next-show-date-ja">
                  <span className="next-show-year">{d.getFullYear()}</span>
                  <span className="next-show-monthday">{d.getMonth() + 1}.{d.getDate()}</span>
                </div>
              ) : (
                <div className="next-show-date">
                  <span className="next-show-month">{MONTHS_EN[d.getMonth()]}</span>
                  <span className="next-show-day">{d.getDate()}</span>
                  <span className="next-show-year">{d.getFullYear()}</span>
                </div>
              )}
              <div className="next-show-body">
                {title ? (
                  <>
                    <h3 className="next-show-title">{title}</h3>
                    <div className="next-show-venue">{venue}</div>
                    {area && <div className="next-show-area">{area}</div>}
                  </>
                ) : (
                  <>
                    <h3 className="next-show-venue">{venue}</h3>
                    {area && <div className="next-show-area">{area}</div>}
                  </>
                )}
              </div>
            </Link>
          </section>
        );
      })()}

      {/* Latest news */}
      <HomeNews news={news} locale={locale} prefix={prefix} s={s} />

      {/* Latest blog */}
      {blog.length > 0 && (() => {
        const latest = [...blog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
        return (
          <section className="home-section">
            <div className="section-header-row">
              <h2 className="section-label">{s.home.latestBlog}</h2>
              <Link to={`${prefix}/blog`} className="section-view-all">{s.home.viewAllBlog} →</Link>
            </div>
            {latest.map(post => {
              const title = locale === 'ja' ? post.title_ja : post.title_en;
              return (
                <Link key={post.id} to={`${prefix}/blog/${post.id}`} className="home-blog-item">
                  <time>{post.date}</time>
                  <span className="home-blog-item-title">{title || post.instagram_url}</span>
                </Link>
              );
            })}
          </section>
        );
      })()}

    </>
  );
}
