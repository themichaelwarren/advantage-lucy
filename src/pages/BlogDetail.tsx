import { useParams, Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useBlog } from '../hooks/useSheetData';
import { formatDate } from '../utils/format';
import InstagramEmbed from '../components/InstagramEmbed';

interface Props {
  locale: Locale;
}

export default function BlogDetail({ locale }: Props) {
  const s = t(locale);
  const prefix = `/${locale}`;
  const { id } = useParams<{ id: string }>();
  const { blog, loading } = useBlog();

  if (loading) return null;

  const post = blog.find(b => b.id === id);

  if (!post) {
    return (
      <div className="text-center mt-2">
        <p style={{ background: 'var(--surface)', padding: '2rem', fontSize: '1.2rem' }}>
          {locale === 'en' ? 'Post not found.' : '記事が見つかりません。'}
        </p>
        <div className="mt-1">
          <Link to={`${prefix}/blog`} className="tag">
            <span>← {s.blog.title}</span>
          </Link>
        </div>
      </div>
    );
  }

  const title = locale === 'ja' ? post.title_ja : post.title_en;

  return (
    <article className="blog-detail">
      {title && (
        <div className="page-title">
          <h1><span>{title}</span></h1>
        </div>
      )}

      <time className="blog-detail-date">{formatDate(post.date, locale)}</time>

      <InstagramEmbed url={post.instagram_url} />

      <div className="mt-2">
        <Link to={`${prefix}/blog`} className="tag">
          <span>← {s.blog.title}</span>
        </Link>
      </div>
    </article>
  );
}
