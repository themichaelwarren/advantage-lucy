import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAllBlog } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
import InstagramEmbed from '../../components/InstagramEmbed';

const BLOG_COLUMNS = ['id', 'instagram_url', 'date', 'title_en', 'title_ja', 'status'] as const;
type BlogField = typeof BLOG_COLUMNS[number];

const FIELD_LABELS: Record<BlogField, string> = {
  id: 'ID',
  instagram_url: 'Instagram URL',
  date: 'Date',
  title_en: 'Title (EN)',
  title_ja: 'Title (JA)',
  status: 'Status',
};

function emptyForm(): Record<BlogField, string> {
  const form: Record<string, string> = {};
  BLOG_COLUMNS.forEach(col => { form[col] = ''; });
  form.status = 'published';
  return form as Record<BlogField, string>;
}

export default function AdminBlogForm() {
  const { locale = 'en', id } = useParams<{ locale: string; id: string }>();
  const prefix = `/${locale}/admin`;
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { blog, loading } = useAllBlog();

  const [form, setForm] = useState<Record<BlogField, string>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const deleteInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    if (isNew || loading || blog.length === 0) return;
    const post = blog.find(b => b.id === id);
    if (!post) return;
    setForm({
      id: post.id,
      instagram_url: post.instagram_url || '',
      date: post.date || '',
      title_en: post.title_en || '',
      title_ja: post.title_ja || '',
      status: post.status || 'published',
    });
  }, [isNew, id, blog, loading]);

  function handleChange(field: BlogField, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const fields: Record<string, string> = {};
    BLOG_COLUMNS.forEach(col => { fields[col] = form[col]; });
    try {
      if (isNew) {
        await createRow('Blog', fields);
      } else {
        await updateRow('Blog', form.id, fields);
      }
      navigate(`${prefix}/blog`);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      await deleteRow('Blog', form.id);
      navigate(`${prefix}/blog`);
    } catch (err) {
      setError(String(err));
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  }

  if (!isNew && loading) return <p>Loading...</p>;

  return (
    <>
      <h1>{isNew ? 'New Blog Post' : `Edit: ${form.title_en || form.title_ja || form.id}`}</h1>

      {error && <div className="admin-error">{error}</div>}

      <form onSubmit={handleSubmit} className="admin-form">
        {BLOG_COLUMNS.map(col => (
          <div className="admin-field" key={col}>
            <label htmlFor={`field-${col}`}>{FIELD_LABELS[col]}</label>
            {col === 'status' ? (
              <select
                id={`field-${col}`}
                value={form[col]}
                onChange={e => handleChange(col, e.target.value)}
              >
                <option value="published">Published</option>
                <option value="private">Draft</option>
              </select>
            ) : col === 'date' ? (
              <input
                id={`field-${col}`}
                type="date"
                value={form[col]}
                onChange={e => handleChange(col, e.target.value)}
              />
            ) : (
              <input
                id={`field-${col}`}
                type="text"
                value={form[col]}
                onChange={e => handleChange(col, e.target.value)}
                placeholder={col === 'instagram_url' ? 'https://www.instagram.com/p/...' : ''}
              />
            )}
          </div>
        ))}

        {/* Live Instagram preview */}
        {form.instagram_url && form.instagram_url.includes('instagram.com') && (
          <div className="admin-field">
            <label>Preview</label>
            <InstagramEmbed url={form.instagram_url} />
          </div>
        )}

        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isNew ? 'Create Post' : 'Save Changes'}
          </button>
          <button type="button" className="admin-btn" onClick={() => navigate(`${prefix}/blog`)}>
            Cancel
          </button>
        </div>
      </form>

      {!isNew && (
        <div className="admin-danger-zone">
          <h2>Danger Zone</h2>
          <p>Permanently delete this post from the spreadsheet. This cannot be undone.</p>
          <button
            type="button"
            className="admin-btn admin-btn-danger"
            onClick={() => {
              setShowDeleteModal(true);
              setDeleteConfirmText('');
              setTimeout(() => deleteInputRef.current?.focus(), 50);
            }}
          >
            Delete Post
          </button>
        </div>
      )}

      {showDeleteModal && (
        <div className="admin-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h3>Delete this post?</h3>
            <p>
              This will permanently remove <strong>{form.title_en || form.title_ja || form.id}</strong> from the spreadsheet.
            </p>
            <p className="admin-modal-confirm-label">
              Type <strong>delete</strong> to confirm:
            </p>
            <input
              ref={deleteInputRef}
              type="text"
              className="admin-modal-input"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="delete"
            />
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                disabled={deleteConfirmText !== 'delete' || deleting}
                onClick={handleDelete}
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
              <button
                type="button"
                className="admin-btn"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
