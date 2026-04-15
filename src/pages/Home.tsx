import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useEvents, useNews, useBlog } from '../hooks/useSheetData';
import EventCard from '../components/EventCard';
import { formatDate } from '../utils/format';

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
      <div className="section-header-row">
        <h2 className="section-label">{s.home.latestNews}</h2>
        <Link to={`${prefix}/news`} className="section-view-all">{s.home.viewAllNews} →</Link>
      </div>
      {latestNews.map(post => {
        const title = locale === 'ja' ? post.title_ja : post.title_en;
        return (
          <div key={post.id} className="home-blog-item">
            <time>{post.date}</time>
            <Link to={`${prefix}/news/${post.id}`}>{title}</Link>
          </div>
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
            <div className="section-header-row">
              <h2 className="section-label">{s.home.latestBlog}</h2>
              <Link to={`${prefix}/blog`} className="section-view-all">{s.home.viewAllBlog} →</Link>
            </div>
            {latest.map(post => {
              const title = locale === 'ja' ? post.title_ja : post.title_en;
              return (
                <div key={post.id} className="home-blog-item">
                  <time>{post.date}</time>
                  <Link to={`${prefix}/blog/${post.id}`}>{title || post.instagram_url}</Link>
                </div>
              );
            })}
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
          <div className="section-header-row">
            <h2 className="section-label">{s.nav.events}</h2>
            <Link to={`${prefix}/events`} className="section-view-all">{s.home.viewAllEvents} →</Link>
          </div>
          <div className="event-list event-list-compact">
            {recentPast.map(event => {
              const venue = locale === 'ja' ? event.venue_ja : event.venue_en;
              const area = locale === 'ja' ? event.city_ja : event.city_en;
              return (
                <Link to={`${prefix}/events/${event.id}`} className="event-list-row" key={event.id}>
                  <span className="event-list-date">{formatDate(event.date, locale)}</span>
                  <span className="event-list-venue">{venue}</span>
                  <span className="event-list-area">{area}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

    </>
  );
}
