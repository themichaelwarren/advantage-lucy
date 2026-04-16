import { Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useNews } from '../hooks/useSheetData';

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
      <header className="news-detail-header">
        <h1 className="news-detail-title">{s.news.title}</h1>
      </header>

      {sorted.length === 0 && (
        <p className="text-center" style={{ background: 'var(--surface)', padding: '2rem' }}>
          {s.news.noNews}
        </p>
      )}

      <div className="news-list">
        {sorted.map(post => {
          const title = locale === 'ja' ? post.title_ja : post.title_en;
          return (
            <Link key={post.id} to={`${prefix}/news/${post.id}`} className="news-row">
              <time>{post.date}</time>
              <span className="news-row-title">{title}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
