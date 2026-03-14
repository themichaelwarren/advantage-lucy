import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSongs, usePeople } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
import { useAuth } from '../../contexts/AuthContext';
import { createDriveDoc } from '../../services/driveService';

const SONG_COLUMNS = ['id', 'title', 'lyrics_by', 'music_by', 'lyrics_doc_id'] as const;
type SongField = typeof SONG_COLUMNS[number];

const FIELD_LABELS: Record<SongField, string> = {
  id: 'ID',
  title: 'Title',
  music_by: 'Music by',
  lyrics_by: 'Lyrics by',
  lyrics_doc_id: 'Lyrics Doc ID',
};

function emptyForm(): Record<SongField, string> {
  const form: Record<string, string> = {};
  SONG_COLUMNS.forEach(col => { form[col] = ''; });
  return form as Record<SongField, string>;
}

export default function AdminSongForm() {
  const { locale = 'en', id } = useParams<{ locale: string; id: string }>();
  const prefix = `/${locale}/admin`;
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { songs, loading } = useSongs();
  const { people } = usePeople();
  const { accessToken } = useAuth();

  const [form, setForm] = useState<Record<SongField, string>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const deleteInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    if (isNew || loading || songs.length === 0) return;
    const song = songs.find(s => s.id === id);
    if (!song) return;
    setForm({
      id: song.id,
      title: song.title || '',
      music_by: song.music_by || '',
      lyrics_by: song.lyrics_by || '',
      lyrics_doc_id: song.lyrics_doc_id || '',
    });
  }, [isNew, id, songs, loading]);

  function handleChange(field: SongField, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const fields: Record<string, string> = {};
    SONG_COLUMNS.forEach(col => { fields[col] = form[col]; });
    try {
      if (isNew) {
        await createRow('Songs', fields);
      } else {
        await updateRow('Songs', form.id, fields);
      }
      navigate(`${prefix}/songs`);
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
      await deleteRow('Songs', form.id);
      navigate(`${prefix}/songs`);
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
      <h1>{isNew ? 'New Song' : `Edit: ${form.title || form.id}`}</h1>

      {error && <div className="admin-error">{error}</div>}

      <form onSubmit={handleSubmit} className="admin-form">
        {SONG_COLUMNS.map(col => (
          <div className="admin-field" key={col}>
            <label htmlFor={`field-${col}`}>{FIELD_LABELS[col]}</label>
            {col === 'music_by' || col === 'lyrics_by' ? (() => {
              const selectedIds = form[col] ? form[col].split(',').filter(Boolean) : [];
              const available = people
                .filter(p => !selectedIds.includes(p.id))
                .sort((a, b) => {
                  const nameA = [a.name_given_en, a.name_family_en].filter(Boolean).join(' ');
                  const nameB = [b.name_given_en, b.name_family_en].filter(Boolean).join(' ');
                  return nameA.localeCompare(nameB);
                });
              const personLabel = (pid: string) => {
                const p = people.find(p => p.id === pid);
                if (!p) return pid;
                return [p.name_given_en, p.name_family_en].filter(Boolean).join(' ') || pid;
              };
              return (
                <div className="admin-people-picker">
                  {selectedIds.length > 0 && (
                    <div className="admin-people-tags">
                      {selectedIds.map(pid => (
                        <span key={pid} className="admin-people-tag">
                          {personLabel(pid)}
                          <button
                            type="button"
                            onClick={() => handleChange(col, selectedIds.filter(x => x !== pid).join(','))}
                            aria-label={`Remove ${personLabel(pid)}`}
                          >×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  {available.length > 0 && (
                    <select
                      id={`field-${col}`}
                      value=""
                      onChange={e => {
                        if (!e.target.value) return;
                        handleChange(col, [...selectedIds, e.target.value].join(','));
                      }}
                    >
                      <option value="">+ Add person...</option>
                      {available.map(p => (
                        <option key={p.id} value={p.id}>
                          {[p.name_given_en, p.name_family_en].filter(Boolean).join(' ') || p.id}
                          {p.name_family_ja ? ` (${[p.name_family_ja, p.name_given_ja].filter(Boolean).join(' ')})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })() : col === 'lyrics_doc_id' ? (
              <div className="admin-lyrics-field">
                {form.lyrics_doc_id ? (
                  <a
                    href={`https://docs.google.com/document/d/${form.lyrics_doc_id}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-btn admin-btn-sm"
                  >
                    Open in Google Docs
                  </a>
                ) : (
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary admin-btn-sm"
                    disabled={creatingDoc || !form.title || !accessToken}
                    onClick={async () => {
                      if (!accessToken) return;
                      setCreatingDoc(true);
                      setError('');
                      try {
                        const folderId = import.meta.env.VITE_LYRICS_FOLDER_ID;
                        const docId = await createDriveDoc(form.title, folderId, accessToken);
                        handleChange('lyrics_doc_id', docId);
                        // Auto-save the record so the doc ID is persisted
                        const fields: Record<string, string> = {};
                        SONG_COLUMNS.forEach(col => { fields[col] = form[col]; });
                        fields.lyrics_doc_id = docId;
                        await updateRow('Songs', form.id, fields);
                      } catch (err) {
                        setError(`Failed to create doc: ${err}`);
                      } finally {
                        setCreatingDoc(false);
                      }
                    }}
                  >
                    {creatingDoc ? 'Creating...' : 'Create Lyrics Doc'}
                  </button>
                )}
                <input
                  id={`field-${col}`}
                  type="text"
                  value={form[col]}
                  onChange={e => {
                    let val = e.target.value;
                    const match = val.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
                    if (match) val = match[1];
                    handleChange(col, val);
                  }}
                  placeholder="Paste Doc ID or Google Docs URL"
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
            {saving ? 'Saving...' : isNew ? 'Create Song' : 'Save Changes'}
          </button>
          <button type="button" className="admin-btn" onClick={() => navigate(`${prefix}/songs`)}>
            Cancel
          </button>
        </div>
      </form>

      {!isNew && (
        <div className="admin-danger-zone">
          <h2>Danger Zone</h2>
          <p>Permanently delete this song from the spreadsheet. This cannot be undone.</p>
          <button
            type="button"
            className="admin-btn admin-btn-danger"
            onClick={() => {
              setShowDeleteModal(true);
              setDeleteConfirmText('');
              setTimeout(() => deleteInputRef.current?.focus(), 50);
            }}
          >
            Delete Song
          </button>
        </div>
      )}

      {showDeleteModal && (
        <div className="admin-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h3>Delete this song?</h3>
            <p>
              This will permanently remove <strong>{form.title || form.id}</strong> from the spreadsheet.
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
