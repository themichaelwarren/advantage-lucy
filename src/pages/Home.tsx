import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useEvents, useNews, useBlog } from '../hooks/useSheetData';
import EventCard from '../components/EventCard';

const GREETINGS = [
  'hi',
  'hey',
  'hey there',
  'hello',
  'hello again',
  'hello mate!',
];

interface Props {
  locale: Locale;
}

function HomeNews({ news, locale, prefix, s }: { news: import('../types').NewsPost[]; locale: Locale; prefix: string; s: ReturnType<typeof t> }) {
  if (news.length === 0) return null;
  const latestNews = [...news].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  return (
    <section className="mb-2">
      <h2 className="section-label">{s.home.latestNews}</h2>
      {latestNews.map(post => {
        const title = locale === 'ja' ? post.title_ja : post.title_en;
        const body = locale === 'ja' ? post.body_ja : post.body_en;
        return (
          <article key={post.id} className="news-card">
            {post.image_url && (
              <div className="news-card-image">
                <img src={post.image_url} alt={title} />
              </div>
            )}
            <div className="news-card-content">
              <time className="news-card-date">{post.date}</time>
              <h3 className="news-card-title">
                <Link to={`${prefix}/news/${post.id}`}>{title}</Link>
              </h3>
              {body && <p className="news-card-body">{body}</p>}
            </div>
          </article>
        );
      })}
      <div className="text-center mt-1">
        <Link to={`${prefix}/news`} className="tag">
          <span>{s.home.viewAllNews}</span>
          <span>→</span>
        </Link>
      </div>
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

  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

  const upcoming = events
    .filter(e => e.date >= now)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextShow = upcoming[0];
  const recentPast = events
    .filter(e => e.date < now)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  if (eventsLoading) return null;

  return (
    <>
      {/* Hero */}
      <div className="page-title home-hero">
        <h1><span>{greeting}</span></h1>
        <p className="home-subtitle">this is advantagelucy.com</p>
      </div>

      {/* Latest news */}
      <HomeNews news={news} locale={locale} prefix={prefix} s={s} />

      {/* Latest blog */}
      {blog.length > 0 && (() => {
        const latest = [...blog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
        return (
          <section className="mb-2">
            <h2 className="section-label">{s.home.latestBlog}</h2>
            {latest.map(post => {
              const title = locale === 'ja' ? post.title_ja : post.title_en;
              return (
                <div key={post.id} className="home-blog-item">
                  <time>{post.date}</time>
                  <Link to={`${prefix}/blog/${post.id}`}>{title || post.instagram_url}</Link>
                </div>
              );
            })}
            <div className="text-center mt-1">
              <Link to={`${prefix}/blog`} className="tag">
                <span>{s.home.viewAllBlog}</span>
                <span>→</span>
              </Link>
            </div>
          </section>
        );
      })()}

      {/* Next show */}
      {nextShow && (
        <section className="mb-2">
          <h2 className="section-label">{s.home.nextShow}</h2>
          <EventCard event={nextShow} locale={locale} featured />
        </section>
      )}

      {/* Recent events */}
      {recentPast.length > 0 && (
        <section className="mb-2">
          <h2 className="section-label">{s.home.recentEvents}</h2>
          {recentPast.map(event => (
            <EventCard key={event.id} event={event} locale={locale} />
          ))}
          <div className="text-center mt-1">
            <Link to={`${prefix}/events`} className="tag">
              <span>{s.home.viewAllEvents}</span>
              <span>→</span>
            </Link>
          </div>
        </section>
      )}

    </>
  );
}
