import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useBlog } from '../hooks/useSheetData';
import InstagramEmbed from '../components/InstagramEmbed';
import PageLoader from '../components/PageLoader';

interface Props {
  locale: Locale;
}

/**
 * Blog: one Instagram post per row, with its date and title beside it
 * (stacked on phones). The date and title open the post on Instagram;
 * there's no separate page.
 */
export default function Blog({ locale }: Props) {
  const s = t(locale);
  const { blog, loading } = useBlog();

  const sorted = [...blog].sort((a, b) => b.date.localeCompare(a.date));

  if (loading) return <PageLoader locale={locale} />;

  return (
    <>
      <header className="news-detail-header blog-index-header">
        <h1 className="news-detail-title">{s.blog.title}</h1>
        <p className="blog-index-intro">{s.blog.intro}</p>
      </header>

      {sorted.length === 0 && (
        <p className="text-center" style={{ background: 'var(--surface)', padding: '2rem' }}>
          {s.blog.noPosts}
        </p>
      )}

      <div className="blog-rows">
        {sorted.map(post => {
          const title = (locale === 'ja' ? post.title_ja || post.title_en : post.title_en || post.title_ja) || '';
          return (
            <article key={post.id} className="blog-card">
              <a href={post.instagram_url} target="_blank" rel="noopener noreferrer" className="blog-card-head">
                <time dateTime={post.date}>{post.date.replace(/-/g, '.')}</time>
                {title && <h2 className="blog-card-title">{title} <span className="blog-card-out" aria-hidden="true">↗</span></h2>}
              </a>
              <InstagramEmbed url={post.instagram_url} />
            </article>
          );
        })}
      </div>
    </>
  );
}
