import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAllBlog } from '../../hooks/useSheetData';

export default function AdminBlog() {
  const { locale = 'en' } = useParams<{ locale: string }>();
  const prefix = `/${locale}/admin`;
  const { blog, loading } = useAllBlog();
  const [search, setSearch] = useState('');

  const filtered = [...blog]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter(post => {
      if (!search) return true;
      const hay = `${post.title_en} ${post.title_ja} ${post.date} ${post.instagram_url}`.toLowerCase();
      return hay.includes(search.toLowerCase());
    });

  if (loading) return <p>Loading...</p>;

  return (
    <>
      <div className="admin-page-header">
        <h1>Blog ({blog.length})</h1>
        <Link to={`${prefix}/blog/new`} className="admin-btn admin-btn-primary">
          + New Post
        </Link>
      </div>

      <input
        type="search"
        className="admin-search"
        placeholder="Search blog..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Desktop table */}
      <table className="admin-table admin-desktop-only">
        <thead>
          <tr>
            <th>Date</th>
            <th>Title</th>
            <th>URL</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(post => (
            <tr key={post.id} className={post.status === 'private' ? 'admin-row-draft' : ''}>
              <td className="admin-td-date">{post.date}</td>
              <td>
                <Link to={`${prefix}/blog/${post.id}`}>
                  {post.title_en || post.title_ja || post.id}
                </Link>
              </td>
              <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <a href={post.instagram_url} target="_blank" rel="noopener noreferrer">
                  {post.instagram_url.replace('https://www.instagram.com/', '')}
                </a>
              </td>
              <td>
                <span className={`admin-status ${post.status === 'private' ? 'admin-status-draft' : 'admin-status-live'}`}>
                  {post.status === 'private' ? 'Draft' : 'Live'}
                </span>
              </td>
              <td className="admin-td-actions">
                <Link to={`${prefix}/blog/${post.id}`} className="admin-btn admin-btn-sm">
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
            to={`${prefix}/blog/${post.id}`}
            className={`admin-event-card ${post.status === 'private' ? 'admin-event-card-draft' : ''}`}
          >
            <div className="admin-event-card-header">
              <span className="admin-event-card-date">{post.date}</span>
              <span className={`admin-status ${post.status === 'private' ? 'admin-status-draft' : 'admin-status-live'}`}>
                {post.status === 'private' ? 'Draft' : 'Live'}
              </span>
            </div>
            <div className="admin-event-card-title">
              {post.title_en || post.title_ja || 'Untitled'}
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && <p className="admin-empty">No blog posts match your search.</p>}
    </>
  );
}
