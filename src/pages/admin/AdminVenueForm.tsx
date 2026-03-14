import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVenues, useAreas } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow } from '../../services/adminService';

const VENUE_COLUMNS = ['id', 'name_en', 'name_ja', 'area', 'url'] as const;
type VenueField = typeof VENUE_COLUMNS[number];

const FIELD_LABELS: Record<VenueField, string> = {
  id: 'ID',
  name_en: 'Name (EN)',
  name_ja: 'Name (JA)',
  area: 'Area',
  url: 'Website URL',
};

function emptyForm(): Record<VenueField, string> {
  const form: Record<string, string> = {};
  VENUE_COLUMNS.forEach(col => { form[col] = ''; });
  return form as Record<VenueField, string>;
}

export default function AdminVenueForm() {
  const { locale = 'en', id } = useParams<{ locale: string; id: string }>();
  const prefix = `/${locale}/admin`;
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { venues, loading } = useVenues();
  const { areas, refresh: refreshAreas } = useAreas();

  const [form, setForm] = useState<Record<VenueField, string>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const deleteInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showNewArea, setShowNewArea] = useState(false);
  const [newArea, setNewArea] = useState({ id: '', name_en: '', name_ja: '', prefecture: '' });
  const [savingArea, setSavingArea] = useState(false);

  useEffect(() => {
    if (isNew || loading || venues.length === 0) return;
    const venue = venues.find(v => v.id === id);
    if (!venue) return;
    setForm({
      id: venue.id,
      name_en: venue.name_en || '',
      name_ja: venue.name_ja || '',
      area: venue.area || '',
      url: venue.url || '',
    });
  }, [isNew, id, venues, loading]);

  function handleChange(field: VenueField, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const fields: Record<string, string> = {};
    VENUE_COLUMNS.forEach(col => { fields[col] = form[col]; });
    try {
      if (isNew) {
        await createRow('Venues', fields);
      } else {
        await updateRow('Venues', form.id, fields);
      }
      navigate(`${prefix}/venues`);
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
      await deleteRow('Venues', form.id);
      navigate(`${prefix}/venues`);
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
      <h1>{isNew ? 'New Venue' : `Edit: ${form.name_en || form.id}`}</h1>

      {error && <div className="admin-error">{error}</div>}

      <form onSubmit={handleSubmit} className="admin-form">
        {VENUE_COLUMNS.map(col => (
          <div className="admin-field" key={col}>
            <label htmlFor={`field-${col}`}>{FIELD_LABELS[col]}</label>
            {col === 'area' ? (
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    id={`field-${col}`}
                    value={form[col]}
                    onChange={e => handleChange(col, e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">— select area —</option>
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>{a.name_en} ({a.name_ja})</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm"
                    onClick={() => setShowNewArea(v => !v)}
                  >
                    {showNewArea ? '✕' : '+ New'}
                  </button>
                </div>
                {showNewArea && (
                  <div className="admin-inline-create">
                    <input placeholder="Area ID (e.g. shimokitazawa)" value={newArea.id} onChange={e => setNewArea(a => ({ ...a, id: e.target.value }))} />
                    <input placeholder="Area Name (EN)" value={newArea.name_en} onChange={e => setNewArea(a => ({ ...a, name_en: e.target.value }))} />
                    <input placeholder="Area Name (JA)" value={newArea.name_ja} onChange={e => setNewArea(a => ({ ...a, name_ja: e.target.value }))} />
                    <input placeholder="Prefecture ID" value={newArea.prefecture} onChange={e => setNewArea(a => ({ ...a, prefecture: e.target.value }))} />
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary admin-btn-sm"
                      disabled={savingArea || !newArea.id || !newArea.name_en}
                      onClick={async () => {
                        setSavingArea(true);
                        try {
                          await createRow('Areas', newArea);
                          handleChange('area', newArea.id);
                          setShowNewArea(false);
                          setNewArea({ id: '', name_en: '', name_ja: '', prefecture: '' });
                          refreshAreas();
                        } catch (err) { setError(`Area creation failed: ${err}`); }
                        finally { setSavingArea(false); }
                      }}
                    >
                      {savingArea ? 'Saving...' : 'Create Area'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <input
                id={`field-${col}`}
                type={col === 'url' ? 'url' : 'text'}
                value={form[col]}
                onChange={e => handleChange(col, e.target.value)}
              />
            )}
          </div>
        ))}

        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isNew ? 'Create Venue' : 'Save Changes'}
          </button>
          <button type="button" className="admin-btn" onClick={() => navigate(`${prefix}/venues`)}>
            Cancel
          </button>
        </div>
      </form>

      {!isNew && (
        <div className="admin-danger-zone">
          <h2>Danger Zone</h2>
          <p>Permanently delete this venue from the spreadsheet. This cannot be undone.</p>
          <button
            type="button"
            className="admin-btn admin-btn-danger"
            onClick={() => {
              setShowDeleteModal(true);
              setDeleteConfirmText('');
              setTimeout(() => deleteInputRef.current?.focus(), 50);
            }}
          >
            Delete Venue
          </button>
        </div>
      )}

      {showDeleteModal && (
        <div className="admin-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h3>Delete this venue?</h3>
            <p>
              This will permanently remove <strong>{form.name_en || form.id}</strong> from the spreadsheet.
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
