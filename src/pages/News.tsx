import { Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useNews } from '../hooks/useSheetData';
import { formatDate } from '../utils/format';

interface Props {
  locale: Locale;
}

export default function News({ locale }: Props) {
  const s = t(locale);
  const prefix = `/${locale}`;
  const { news, loading } = useNews();

  const sorted = [...news].sort((a, b) => b.date.localeCompare(a.date));

  if (loading) return null;

  return (
    <>
      <div className="page-title">
        <h1><span>{s.news.title}</span></h1>
      </div>

      {sorted.length === 0 && (
        <p className="text-center" style={{ background: 'var(--surface)', padding: '2rem' }}>
          {s.news.noNews}
        </p>
      )}

      <div className="news-list">
        {sorted.map(post => {
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
                <time className="news-card-date">{formatDate(post.date, locale)}</time>
                <h2 className="news-card-title">
                  <Link to={`${prefix}/news/${post.id}`}>{title}</Link>
                </h2>
                {body && <p className="news-card-body">{body}</p>}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
