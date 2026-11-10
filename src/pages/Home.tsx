import { Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useEvents, useNews, useBlog, usePhotos } from '../hooks/useSheetData';
import PhotoPile from '../components/PhotoPile';
import { photoSlides } from '../utils/photoLinks';
import ShowCard from '../components/ShowCard';
import PageLoader from '../components/PageLoader';

interface Props {
  locale: Locale;
}

function PostList({ title, viewAll, to, items }: {
  title: string;
  viewAll: string;
  to: string;
  items: { id: string; date: string; title: string; href: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="home-section">
      <div className="section-header-row">
        <h2 className="section-label">{title}</h2>
        <Link to={to} className="section-view-all">{viewAll} →</Link>
      </div>
      <ul className="show-list">
        {items.map(item => (
          <li key={item.id}>
            <Link to={item.href} className="show-row">
              <time dateTime={item.date}>{item.date}</time>
              <span className="show-row-main"><strong>{item.title}</strong></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}


export default function Home({ locale }: Props) {
  const s = t(locale);
  const prefix = `/${locale}`;
  const { events, loading: eventsLoading } = useEvents();
  const { news } = useNews();
  const { blog } = useBlog();
  const { photos } = usePhotos();
  const now = new Date().toISOString().slice(0, 10);

  if (eventsLoading) return <PageLoader locale={locale} />;

  const upcoming = events
    .filter(e => e.date >= now)
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = events
    .filter(e => e.date < now)
    .sort((a, b) => b.date.localeCompare(a.date));
  const featured = upcoming[0] ?? past[0];

  const newsItems = [...news]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .map(p => ({ id: p.id, date: p.date, title: locale === 'ja' ? p.title_ja : p.title_en, href: `${prefix}/news/${p.id}` }));
  const blogItems = [...blog]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .map(p => ({ id: p.id, date: p.date, title: (locale === 'ja' ? p.title_ja : p.title_en) || p.instagram_url, href: `${prefix}/blog/${p.id}` }));

  return (
    <>
      <h1 className="visually-hidden band-name">advantage Lucy</h1>
      <PhotoPile slides={photoSlides(photos, events, locale)} locale={locale} />

      {featured && (
        <section className="home-section">
          <div className="section-header-row">
            <h2 className="section-label">{upcoming[0] ? s.home.nextShow : s.home.lastShow}</h2>
            <Link to={`${prefix}/events`} className="section-view-all">{s.home.viewAllEvents} →</Link>
          </div>
          {!upcoming[0] && <p className="home-note">{s.home.nothingBooked}</p>}
          <ShowCard event={featured} locale={locale} prefix={prefix} />
        </section>
      )}

      <div className="home-columns">
        <PostList title={s.home.latestNews} viewAll={s.home.viewAllNews} to={`${prefix}/news`} items={newsItems} />
        <PostList title={s.home.latestBlog} viewAll={s.home.viewAllBlog} to={`${prefix}/blog`} items={blogItems} />
      </div>
    </>
  );
}
