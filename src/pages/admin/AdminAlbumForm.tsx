import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAlbums, useTracklists, useSongs } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow, uploadFile, replaceRows } from '../../services/adminService';

const ALBUM_COLUMNS = [
  'id', 'title', 'date', 'year', 'type', 'number',
  'format', 'label', 'artwork_url', 'listen_url',
  'description_en', 'description_ja',
] as const;

type AlbumField = typeof ALBUM_COLUMNS[number];

const FIELD_LABELS: Record<AlbumField, string> = {
  id: 'ID',
  title: 'Title',
  date: 'Release Date',
  year: 'Year',
  type: 'Type',
  number: 'Catalog #',
  format: 'Format',
  label: 'Label',
  artwork_url: 'Artwork',
  listen_url: 'Listen URL',
  description_en: 'Description (EN)',
  description_ja: 'Description (JA)',
};

const FIELD_TYPES: Partial<Record<AlbumField, string>> = {
  date: 'date',
  listen_url: 'url',
};

function emptyForm(): Record<AlbumField, string> {
  const form: Record<string, string> = {};
  ALBUM_COLUMNS.forEach(col => { form[col] = ''; });
  return form as Record<AlbumField, string>;
}

export default function AdminAlbumForm() {
  const { locale = 'en', id } = useParams<{ locale: string; id: string }>();
  const prefix = `/${locale}/admin`;
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { albums, loading } = useAlbums();
  const { tracklists } = useTracklists();
  const { songs } = useSongs();

  const [form, setForm] = useState<Record<AlbumField, string>>(emptyForm);
  const [tracks, setTracks] = useState<{ track: string; title: string }[]>([]);
  const [savingTracks, setSavingTracks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const deleteInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [uploading, setUploading] = useState(false);

  // Map song titles to their Song objects for lyrics status lookup
  const songsByTitle = useMemo(() => {
    const map = new Map<string, typeof songs[number]>();
    for (const s of songs) map.set(s.title, s);
    return map;
  }, [songs]);

  useEffect(() => {
    if (isNew || loading || albums.length === 0) return;
    const album = albums.find(a => a.id === id);
    if (!album) return;
    setForm({
      id: album.id,
      title: album.title || '',
      date: album.date || '',
      year: album.year || '',
      type: album.type || '',
      number: album.number || '',
      format: album.format || '',
      label: album.label || '',
      artwork_url: album.coverUrl || '',
      listen_url: album.listenUrl || '',
      description_en: album.description_en || '',
      description_ja: album.description_ja || '',
    });
  }, [isNew, id, albums, loading]);

  // Populate tracklist for existing album
  useEffect(() => {
    if (isNew || !form.title) return;
    const albumTracks = tracklists
      .filter(t => t.release === form.title)
      .sort((a, b) => a.track - b.track)
      .map(t => ({ track: String(t.track), title: t.title }));
    if (albumTracks.length > 0) setTracks(albumTracks);
  }, [isNew, form.title, tracklists]);

  function handleChange(field: AlbumField, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const fields: Record<string, string> = {};
    ALBUM_COLUMNS.forEach(col => { fields[col] = form[col]; });
    try {
      if (isNew) {
        await createRow('Albums', fields);
      } else {
        await updateRow('Albums', form.id, fields);
      }
      navigate(`${prefix}/releases`);
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
      await deleteRow('Albums', form.id);
      navigate(`${prefix}/releases`);
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
      <h1>{isNew ? 'New Release' : `Edit: ${form.title || form.id}`}</h1>

      {error && <div className="admin-error">{error}</div>}

      <form onSubmit={handleSubmit} className="admin-form">
        {ALBUM_COLUMNS.map(col => (
          <div className="admin-field" key={col}>
            <label htmlFor={`field-${col}`}>{FIELD_LABELS[col]}</label>
            {col === 'type' ? (
              <select
                id={`field-${col}`}
                value={form[col]}
                onChange={e => handleChange(col, e.target.value)}
              >
                <option value="">— select type —</option>
                <option value="album">Album</option>
                <option value="ep">EP</option>
                <option value="single">Single</option>
                <option value="compilation">Compilation</option>
              </select>
            ) : col === 'artwork_url' ? (
              <div className="admin-upload-field">
                {form.artwork_url && (
                  <div className="admin-upload-preview">
                    <img src={form.artwork_url} alt="Artwork preview" />
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
                        handleChange('artwork_url', url);
                      } catch (err) {
                        setError(`Upload failed: ${err}`);
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                  {uploading && <span className="admin-upload-status">Uploading...</span>}
                  {form.artwork_url && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm"
                      onClick={() => handleChange('artwork_url', '')}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Or paste image URL"
                  value={form.artwork_url}
                  onChange={e => handleChange('artwork_url', e.target.value)}
                  style={{ marginTop: '0.4rem' }}
                />
              </div>
            ) : col === 'description_en' || col === 'description_ja' ? (
              <textarea
                id={`field-${col}`}
                value={form[col]}
                onChange={e => handleChange(col, e.target.value)}
                rows={3}
              />
            ) : (
              <input
                id={`field-${col}`}
                type={FIELD_TYPES[col] || 'text'}
                value={form[col]}
                onChange={e => handleChange(col, e.target.value)}
              />
            )}
          </div>
        ))}

        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isNew ? 'Create Release' : 'Save Changes'}
          </button>
          <button type="button" className="admin-btn" onClick={() => navigate(`${prefix}/releases`)}>
            Cancel
          </button>
        </div>
      </form>

      {/* Tracklist editor — only for existing releases */}
      {!isNew && (
        <section className="admin-related-section">
          <h2>Tracklist</h2>
          <div className="admin-tracklist">
            {tracks.map((t, i) => {
              const song = t.title ? songsByTitle.get(t.title) : undefined;
              return (
                <div key={i} className="admin-tracklist-row">
                  <input
                    type="number"
                    className="admin-tracklist-num"
                    value={t.track}
                    onChange={e => {
                      const copy = [...tracks];
                      copy[i] = { ...copy[i], track: e.target.value };
                      setTracks(copy);
                    }}
                    min={1}
                  />
                  <input
                    type="text"
                    className="admin-tracklist-title"
                    value={t.title}
                    onChange={e => {
                      const copy = [...tracks];
                      copy[i] = { ...copy[i], title: e.target.value };
                      setTracks(copy);
                    }}
                    list="song-titles"
                    placeholder="Song title"
                  />
                  {song ? (
                    <Link
                      to={`/${locale}/admin/songs/${song.id}`}
                      className={`admin-lyrics-icon${song.lyrics_doc_id ? ' has-doc' : ''}`}
                      title={song.lyrics_doc_id ? 'Lyrics doc exists' : 'No lyrics doc — click to add'}
                    >
                      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                        <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                        {!song.lyrics_doc_id && (
                          <path d="M10 7v6M7 10h6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                        )}
                      </svg>
                    </Link>
                  ) : t.title ? (
                    <span className="admin-lyrics-icon no-song" title="Song not in database">
                      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" opacity="0.25">
                        <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                      </svg>
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-danger"
                    onClick={() => setTracks(tracks.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            <datalist id="song-titles">
              {songs.map(s => <option key={s.id} value={s.title} />)}
            </datalist>
            <button
              type="button"
              className="admin-btn admin-btn-sm"
              onClick={() => setTracks([...tracks, { track: String(tracks.length + 1), title: '' }])}
            >
              + Add Track
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-primary admin-btn-sm"
              style={{ marginLeft: '0.5rem' }}
              disabled={savingTracks}
              onClick={async () => {
                setSavingTracks(true);
                setError('');
                try {
                  const rows = tracks
                    .filter(t => t.title.trim())
                    .map(t => ({ release: form.title, track: t.track, title: t.title }));
                  await replaceRows('Tracklists', form.title, rows);
                } catch (err) {
                  setError(`Tracklist save failed: ${err}`);
                } finally {
                  setSavingTracks(false);
                }
              }}
            >
              {savingTracks ? 'Saving...' : 'Save Tracklist'}
            </button>
          </div>
        </section>
      )}

      {!isNew && (
        <div className="admin-danger-zone">
          <h2>Danger Zone</h2>
          <p>Permanently delete this release from the spreadsheet. This cannot be undone.</p>
          <button
            type="button"
            className="admin-btn admin-btn-danger"
            onClick={() => {
              setShowDeleteModal(true);
              setDeleteConfirmText('');
              setTimeout(() => deleteInputRef.current?.focus(), 50);
            }}
          >
            Delete Release
          </button>
        </div>
      )}

      {showDeleteModal && (
        <div className="admin-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h3>Delete this release?</h3>
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
