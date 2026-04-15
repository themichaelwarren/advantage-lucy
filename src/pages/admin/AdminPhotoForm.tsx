import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAllPhotos } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow, uploadFile } from '../../services/adminService';

const PHOTO_COLUMNS = ['id', 'image_url', 'caption_en', 'caption_ja', 'status'] as const;
type PhotoField = typeof PHOTO_COLUMNS[number];

const FIELD_LABELS: Record<PhotoField, string> = {
  id: 'ID',
  image_url: 'Image',
  caption_en: 'Caption (EN)',
  caption_ja: 'Caption (JA)',
  status: 'Status',
};

function emptyForm(): Record<PhotoField, string> {
  const form: Record<string, string> = {};
  PHOTO_COLUMNS.forEach(col => { form[col] = ''; });
  form.status = 'published';
  return form as Record<PhotoField, string>;
}

export default function AdminPhotoForm() {
  const { locale = 'en', id } = useParams<{ locale: string; id: string }>();
  const prefix = `/${locale}/admin`;
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { photos, loading } = useAllPhotos();

  const [form, setForm] = useState<Record<PhotoField, string>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const deleteInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    if (isNew || loading || photos.length === 0) return;
    const photo = photos.find(p => p.id === id);
    if (!photo) return;
    setForm({
      id: photo.id,
      image_url: photo.image_url || '',
      caption_en: photo.caption_en || '',
      caption_ja: photo.caption_ja || '',
      status: photo.status || 'published',
    });
  }, [isNew, id, photos, loading]);

  function handleChange(field: PhotoField, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const fields: Record<string, string> = {};
    PHOTO_COLUMNS.forEach(col => { fields[col] = form[col]; });
    try {
      if (isNew) {
        await createRow('Photos', fields);
      } else {
        await updateRow('Photos', form.id, fields);
      }
      navigate(`${prefix}/photos`);
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
      await deleteRow('Photos', form.id);
      navigate(`${prefix}/photos`);
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
      <h1>{isNew ? 'New Splash Photo' : `Edit: ${form.caption_en || form.id}`}</h1>

      {error && <div className="admin-error">{error}</div>}

      <form onSubmit={handleSubmit} className="admin-form">
        {PHOTO_COLUMNS.map(col => (
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
            {saving ? 'Saving...' : isNew ? 'Create Photo' : 'Save Changes'}
          </button>
          <button type="button" className="admin-btn" onClick={() => navigate(`${prefix}/photos`)}>
            Cancel
          </button>
        </div>
      </form>

      {!isNew && (
        <div className="admin-danger-zone">
          <h2>Danger Zone</h2>
          <p>Permanently delete this photo from the spreadsheet. This cannot be undone.</p>
          <button
            type="button"
            className="admin-btn admin-btn-danger"
            onClick={() => {
              setShowDeleteModal(true);
              setDeleteConfirmText('');
              setTimeout(() => deleteInputRef.current?.focus(), 50);
            }}
          >
            Delete Photo
          </button>
        </div>
      )}

      {showDeleteModal && (
        <div className="admin-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h3>Delete this photo?</h3>
            <p>
              This will permanently remove <strong>{form.caption_en || form.id}</strong> from the spreadsheet.
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
