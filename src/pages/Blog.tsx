import { Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useBlog } from '../hooks/useSheetData';
import { formatDate } from '../utils/format';
import InstagramEmbed from '../components/InstagramEmbed';

interface Props {
  locale: Locale;
}

export default function Blog({ locale }: Props) {
  const s = t(locale);
  const prefix = `/${locale}`;
  const { blog, loading } = useBlog();

  const sorted = [...blog].sort((a, b) => b.date.localeCompare(a.date));

  if (loading) return null;

  return (
    <>
      <header className="news-detail-header">
        <h1 className="news-detail-title">{s.blog.title}</h1>
      </header>

      {sorted.length === 0 && (
        <p className="text-center" style={{ background: 'var(--surface)', padding: '2rem' }}>
          {s.blog.noPosts}
        </p>
      )}

      <div className="blog-list">
        {sorted.map(post => {
          const title = locale === 'ja' ? post.title_ja : post.title_en;
          return (
            <article key={post.id} className="blog-post">
              {title && (
                <h2 className="blog-post-title">
                  <Link to={`${prefix}/blog/${post.id}`}>{title}</Link>
                </h2>
              )}
              <time className="blog-post-date">{formatDate(post.date, locale)}</time>
              <InstagramEmbed url={post.instagram_url} />
            </article>
          );
        })}
      </div>
    </>
  );
}
