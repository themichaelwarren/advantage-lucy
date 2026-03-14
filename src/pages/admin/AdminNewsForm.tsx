import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAllNews } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow, uploadFile } from '../../services/adminService';

const NEWS_COLUMNS = ['id', 'date', 'title_en', 'title_ja', 'body_en', 'body_ja', 'image_url', 'status'] as const;
type NewsField = typeof NEWS_COLUMNS[number];

const FIELD_LABELS: Record<NewsField, string> = {
  id: 'ID',
  date: 'Date',
  title_en: 'Title (EN)',
  title_ja: 'Title (JA)',
  body_en: 'Body (EN)',
  body_ja: 'Body (JA)',
  image_url: 'Image',
  status: 'Status',
};

function emptyForm(): Record<NewsField, string> {
  const form: Record<string, string> = {};
  NEWS_COLUMNS.forEach(col => { form[col] = ''; });
  form.status = 'published';
  return form as Record<NewsField, string>;
}

export default function AdminNewsForm() {
  const { locale = 'en', id } = useParams<{ locale: string; id: string }>();
  const prefix = `/${locale}/admin`;
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { news, loading } = useAllNews();

  const [form, setForm] = useState<Record<NewsField, string>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const deleteInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    if (isNew || loading || news.length === 0) return;
    const post = news.find(n => n.id === id);
    if (!post) return;
    setForm({
      id: post.id,
      date: post.date || '',
      title_en: post.title_en || '',
      title_ja: post.title_ja || '',
      body_en: post.body_en || '',
      body_ja: post.body_ja || '',
      image_url: post.image_url || '',
      status: post.status || 'published',
    });
  }, [isNew, id, news, loading]);

  function handleChange(field: NewsField, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const fields: Record<string, string> = {};
    NEWS_COLUMNS.forEach(col => { fields[col] = form[col]; });
    try {
      if (isNew) {
        await createRow('News', fields);
      } else {
        await updateRow('News', form.id, fields);
      }
      navigate(`${prefix}/news`);
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
      await deleteRow('News', form.id);
      navigate(`${prefix}/news`);
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
      <h1>{isNew ? 'New Post' : `Edit: ${form.title_en || form.title_ja || form.id}`}</h1>

      {error && <div className="admin-error">{error}</div>}

      <form onSubmit={handleSubmit} className="admin-form">
        {NEWS_COLUMNS.map(col => (
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
            ) : col === 'body_en' || col === 'body_ja' ? (
              <textarea
                id={`field-${col}`}
                value={form[col]}
                onChange={e => handleChange(col, e.target.value)}
                rows={5}
              />
            ) : col === 'image_url' ? (
              <div className="admin-upload-field">
                {form.image_url && (
                  <div className="admin-upload-preview">
                    <img src={form.image_url} alt="Preview" />
                  </div>
                )}
                <div className="admin-upload-controls">
                  <input
                    id={`field-${col}`}
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      setError('');
                      try {
                        const url = await uploadFile(file);
                        handleChange('image_url', url);
                      } catch (err) {
                        setError(`Upload failed: ${err}`);
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                  {uploading && <span className="admin-upload-status">Uploading...</span>}
                  {form.image_url && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm"
                      onClick={() => handleChange('image_url', '')}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Or paste image URL"
                  value={form.image_url}
                  onChange={e => handleChange('image_url', e.target.value)}
                  style={{ marginTop: '0.4rem' }}
                />
              </div>
            ) : (
              <input
                id={`field-${col}`}
                type="text"
                value={form[col]}
                onChange={e => handleChange(col, e.target.value)}
              />
            )}
          </div>
        ))}

        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isNew ? 'Create Post' : 'Save Changes'}
          </button>
          <button type="button" className="admin-btn" onClick={() => navigate(`${prefix}/news`)}>
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
