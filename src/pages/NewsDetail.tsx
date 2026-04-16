import type { ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { useNews } from '../hooks/useSheetData';

function renderBody(text: string): ReactNode[] {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <br key={i} />;
    // Parse [text](url) links within the line
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    const re = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    let match;
    while ((match = re.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      parts.push(
        <a key={`${i}-${match.index}`} href={match[2]} target="_blank" rel="noopener noreferrer" className="ticket-btn">
          {match[1]} →
        </a>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }
    // If line is only a link, render as a div (block), otherwise as a paragraph
    const hasOnlyLinks = parts.every(p => typeof p !== 'string' || !p.trim());
    if (hasOnlyLinks && parts.length > 0) {
      return <div key={i} className="news-links">{parts}</div>;
    }
    return <p key={i}>{parts}</p>;
  });
}

interface Props {
  locale: Locale;
}

export default function NewsDetail({ locale }: Props) {
  const s = t(locale);
  const prefix = `/${locale}`;
  const { id } = useParams<{ id: string }>();
  const { news, loading } = useNews();

  if (loading) return null;

  const post = news.find(n => n.id === id);

  if (!post) {
    return (
      <div className="text-center mt-2">
        <p style={{ background: 'var(--surface)', padding: '2rem', fontSize: '1.2rem' }}>
          {locale === 'en' ? 'Post not found.' : '記事が見つかりません。'}
        </p>
        <div className="mt-1">
          <Link to={`${prefix}/news`} className="tag">
            <span>← {s.news.title}</span>
          </Link>
        </div>
      </div>
    );
  }

  const title = locale === 'ja' ? post.title_ja : post.title_en;
  const body = locale === 'ja' ? post.body_ja : post.body_en;

  return (
    <article className="news-detail">
      <header className="news-detail-header">
        <h1 className="news-detail-title">{title}</h1>
        <time className="news-detail-date">{post.date}</time>
      </header>

      {post.image_url && (
        <div className="news-detail-image">
          <img src={post.image_url} alt={title} />
        </div>
      )}

      {body && (
        <div className="prose">
          {renderBody(body)}
        </div>
      )}

      <div className="mt-2">
        <Link to={`${prefix}/news`} className="tag">
          <span>← {s.news.title}</span>
        </Link>
      </div>
    </article>
  );
}
