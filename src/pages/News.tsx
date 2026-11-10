import { Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useNews } from '../hooks/useSheetData';
import PageLoader from '../components/PageLoader';
import PageTitle from '../components/PageTitle';

interface Props {
  locale: Locale;
}

export default function News({ locale }: Props) {
  const s = t(locale);
  const prefix = `/${locale}`;
  const { news, loading } = useNews();

  const sorted = [...news].sort((a, b) => b.date.localeCompare(a.date));

  if (loading) return <PageLoader locale={locale} />;

  return (
    <>
      <PageTitle title={s.nav.news} />
      <header className="news-detail-header">
        <h1 className="news-detail-title">{s.news.title}</h1>
      </header>

      {sorted.length === 0 && (
        <p className="text-center" style={{ background: 'var(--surface)', padding: '2rem' }}>
          {s.news.noNews}
        </p>
      )}

      <ul className="show-list">
        {sorted.map(post => {
          const title = (locale === 'ja' ? post.title_ja || post.title_en : post.title_en || post.title_ja) || post.id;
          return (
            <li key={post.id}>
              <Link to={`${prefix}/news/${post.id}`} className="show-row">
                <time dateTime={post.date}>{post.date}</time>
                <span className="show-row-main"><strong>{title}</strong></span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
