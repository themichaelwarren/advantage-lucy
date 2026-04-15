import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAllNews } from '../../hooks/useSheetData';
import { t, type Locale } from '../../i18n/translations';

export default function AdminNews() {
  const { locale: rawLocale = 'en' } = useParams<{ locale: string }>();
  const locale = (rawLocale === 'ja' ? 'ja' : 'en') as Locale;
  const s = t(locale).admin;
  const prefix = `/${locale}/admin`;
  const { news, loading } = useAllNews();
  const [search, setSearch] = useState('');

  const filtered = [...news]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter(post => {
      if (!search) return true;
      const hay = `${post.title_en} ${post.title_ja} ${post.date}`.toLowerCase();
      return hay.includes(search.toLowerCase());
    });

  if (loading) return <p>{s.loading}</p>;

  return (
    <>
      <div className="admin-page-header">
        <h1>{s.news} ({news.length})</h1>
        <Link to={`${prefix}/news/new`} className="admin-btn admin-btn-primary">
          {s.newPost}
        </Link>
      </div>

      <input
        type="search"
        className="admin-search"
        placeholder="Search news..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Desktop table */}
      <table className="admin-table admin-desktop-only">
        <thead>
          <tr>
            <th>Date</th>
            <th>Title</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(post => (
            <tr key={post.id} className={post.status === 'private' ? 'admin-row-draft' : ''}>
              <td className="admin-td-date">{post.date}</td>
              <td>
                <Link to={`${prefix}/news/${post.id}`}>
                  {post.title_en || post.title_ja || post.id}
                </Link>
              </td>
              <td>
                <span className={`admin-status ${post.status === 'private' ? 'admin-status-draft' : 'admin-status-live'}`}>
                  {post.status === 'private' ? s.draft : s.live}
                </span>
              </td>
              <td className="admin-td-actions">
                <Link to={`${prefix}/news/${post.id}`} className="admin-btn admin-btn-sm">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="admin-card-list admin-mobile-only">
        {filtered.map(post => (
          <Link
            key={post.id}
            to={`${prefix}/news/${post.id}`}
            className={`admin-event-card ${post.status === 'private' ? 'admin-event-card-draft' : ''}`}
          >
            <div className="admin-event-card-header">
              <span className="admin-event-card-date">{post.date}</span>
              <span className={`admin-status ${post.status === 'private' ? 'admin-status-draft' : 'admin-status-live'}`}>
                {post.status === 'private' ? s.draft : s.live}
              </span>
            </div>
            <div className="admin-event-card-title">
              {post.title_en || post.title_ja || post.id}
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && <p className="admin-empty">No news posts match your search.</p>}
    </>
  );
}
