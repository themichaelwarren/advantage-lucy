import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAllEvents, useVenues, useAreas, useSetlists, useSongs } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow, uploadFile, replaceRows } from '../../services/adminService';

/** Pad time like "9:30" → "09:30" for HTML time inputs. */
function padTime(t: string | undefined): string {
  if (!t) return '';
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : t;
}

/** Events sheet columns — order no longer matters (server maps via headers). */
const EVENT_COLUMNS = [
  'id', 'title_en', 'title_ja', 'date', 'end_date',
  'venue', 'doors', 'start', 'end', 'adv_price',
  'door_price', 'ticket_url', 'poster_url', 'performers',
  'featured', 'body_en', 'body_ja', 'status',
] as const;

type EventField = typeof EVENT_COLUMNS[number];

const FIELD_LABELS: Record<EventField, string> = {
  id: 'ID',
  title_en: 'Title (EN)',
  title_ja: 'Title (JA)',
  date: 'Date',
  end_date: 'End Date',
  venue: 'Venue',
  doors: 'Doors',
  start: 'Start',
  end: 'End',
  adv_price: 'Advance Price',
  door_price: 'Door Price',
  ticket_url: 'Ticket URL',
  poster_url: 'Poster URL',
  performers: 'Performers',
  featured: 'Featured',
  body_en: 'Description (EN)',
  body_ja: 'Description (JA)',
  status: 'Status',
};

const FIELD_TYPES: Partial<Record<EventField, string>> = {
  date: 'date',
  end_date: 'date',
  doors: 'time',
  start: 'time',
  end: 'time',
  ticket_url: 'url',
  poster_url: 'url',
};

function emptyForm(): Record<EventField, string> {
  const form: Record<string, string> = {};
  EVENT_COLUMNS.forEach(col => { form[col] = ''; });
  form.status = 'published';
  return form as Record<EventField, string>;
}

export default function AdminEventForm() {
  const { locale = 'en', id } = useParams<{ locale: string; id: string }>();
  const prefix = `/${locale}/admin`;
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { events, loading } = useAllEvents();
  const { venues, refresh: refreshVenues } = useVenues();
  const { areas, refresh: refreshAreas } = useAreas();
  const { setlists: allSetlists } = useSetlists();
  const { songs } = useSongs();

  const [form, setForm] = useState<Record<EventField, string>>(emptyForm);
  type SetlistRow = { song: string; set: string; order: string; notes: string; status: string };
  const [setlistRows, setSetlistRows] = useState<SetlistRow[]>([]);
  const [savingSetlist, setSavingSetlist] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const deleteInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showNewVenue, setShowNewVenue] = useState(false);
  const [newVenue, setNewVenue] = useState({ id: '', name_en: '', name_ja: '', area: '' });
  const [showNewArea, setShowNewArea] = useState(false);
  const [newArea, setNewArea] = useState({ id: '', name_en: '', name_ja: '', prefecture: '' });
  const [savingVenue, setSavingVenue] = useState(false);
  const [savingArea, setSavingArea] = useState(false);

  // Populate form for editing
  useEffect(() => {
    if (isNew || loading || events.length === 0) return;
    const event = events.find(e => e.id === id);
    if (!event) return;
    setForm({
      id: event.id,
      title_en: event.title_en || '',
      title_ja: event.title_ja || '',
      date: event.date || '',
      end_date: event.end_date || '',
      venue: event.venue_id || '',
      doors: padTime(event.doors),
      start: padTime(event.start),
      end: padTime(event.end_time),
      adv_price: event.adv_price || '',
      door_price: event.door_price || '',
      ticket_url: event.ticketUrl || '',
      poster_url: event.posterUrl || '',
      performers: event.performers || '',
      featured: event.featured ? 'TRUE' : '',
      body_en: event.body_en || '',
      body_ja: event.body_ja || '',
      status: event.status || 'published',
    });
  }, [isNew, id, events, loading]);

  // Populate setlist for existing event
  useEffect(() => {
    if (isNew || !form.id) return;
    const entries = allSetlists
      .filter(s => s.event === form.id)
      .sort((a, b) => {
        if (a.set !== b.set) return a.set.localeCompare(b.set);
        return a.order - b.order;
      })
      .map(s => ({
        song: s.song,
        set: s.set,
        order: String(s.order),
        notes: s.notes || '',
        status: s.status || 'published',
      }));
    if (entries.length > 0) setSetlistRows(entries);
  }, [isNew, form.id, allSetlists]);

  function handleChange(field: EventField, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Send as key-value object — server maps to correct columns via headers
    const fields: Record<string, string> = {};
    EVENT_COLUMNS.forEach(col => { fields[col] = form[col]; });

    try {
      if (isNew) {
        await createRow('Events', fields);
      } else {
        await updateRow('Events', form.id, fields);
      }
      navigate(`${prefix}/events`);
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
      await deleteRow('Events', form.id);
      navigate(`${prefix}/events`);
    } catch (err) {
      setError(String(err));
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  }

  // Build venue lookup
  const areaMap = new Map(areas.map(a => [a.id, a]));
  const venueOptions = venues.map(v => {
    const area = areaMap.get(v.area);
    return { value: v.id, label: `${v.name_en} (${area?.name_en || v.area})` };
  });

  if (!isNew && loading) return <p>Loading...</p>;

  return (
    <>
      <h1>{isNew ? 'New Event' : `Edit: ${form.title_en || form.id}`}</h1>

      {error && <div className="admin-error">{error}</div>}

      <form onSubmit={handleSubmit} className="admin-form">
        {EVENT_COLUMNS.map(col => (
          <div className="admin-field" key={col}>
            <label htmlFor={`field-${col}`}>{FIELD_LABELS[col]}</label>
            {col === 'venue' ? (
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    id={`field-${col}`}
                    value={form[col]}
                    onChange={e => handleChange(col, e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">— select venue —</option>
                    {venueOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm"
                    onClick={() => setShowNewVenue(v => !v)}
                  >
                    {showNewVenue ? '✕' : '+ New'}
                  </button>
                </div>
                {showNewVenue && (
                  <div className="admin-inline-create">
                    <input placeholder="ID (e.g. club-que)" value={newVenue.id} onChange={e => setNewVenue(v => ({ ...v, id: e.target.value }))} />
                    <input placeholder="Name (EN)" value={newVenue.name_en} onChange={e => setNewVenue(v => ({ ...v, name_en: e.target.value }))} />
                    <input placeholder="Name (JA)" value={newVenue.name_ja} onChange={e => setNewVenue(v => ({ ...v, name_ja: e.target.value }))} />
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <select value={newVenue.area} onChange={e => setNewVenue(v => ({ ...v, area: e.target.value }))} style={{ flex: 1 }}>
                        <option value="">— select area —</option>
                        {areas.map(a => (
                          <option key={a.id} value={a.id}>{a.name_en}</option>
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
                              setNewVenue(v => ({ ...v, area: newArea.id }));
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
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary admin-btn-sm"
                      disabled={savingVenue || !newVenue.id || !newVenue.name_en}
                      onClick={async () => {
                        setSavingVenue(true);
                        try {
                          await createRow('Venues', newVenue);
                          handleChange('venue', newVenue.id);
                          setShowNewVenue(false);
                          setNewVenue({ id: '', name_en: '', name_ja: '', area: '' });
                          refreshVenues();
                        } catch (err) { setError(`Venue creation failed: ${err}`); }
                        finally { setSavingVenue(false); }
                      }}
                    >
                      {savingVenue ? 'Saving...' : 'Create Venue'}
                    </button>
                  </div>
                )}
              </div>
            ) : col === 'status' ? (
              <select
                id={`field-${col}`}
                value={form[col]}
                onChange={e => handleChange(col, e.target.value)}
              >
                <option value="published">Published</option>
                <option value="private">Private</option>
              </select>
            ) : col === 'featured' ? (
              <select
                id={`field-${col}`}
                value={form[col]}
                onChange={e => handleChange(col, e.target.value)}
              >
                <option value="">No</option>
                <option value="TRUE">Yes</option>
              </select>
            ) : col === 'poster_url' ? (
              <div className="admin-upload-field">
                {form.poster_url && (
                  <div className="admin-upload-preview">
                    <img src={form.poster_url} alt="Poster preview" />
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
                        handleChange('poster_url', url);
                      } catch (err) {
                        setError(`Upload failed: ${err}`);
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                  {uploading && <span className="admin-upload-status">Uploading...</span>}
                  {form.poster_url && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm"
                      onClick={() => handleChange('poster_url', '')}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Or paste image URL"
                  value={form.poster_url}
                  onChange={e => handleChange('poster_url', e.target.value)}
                  style={{ marginTop: '0.4rem' }}
                />
              </div>
            ) : col === 'body_en' || col === 'body_ja' ? (
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
            {saving ? 'Saving...' : isNew ? 'Create Event' : 'Save Changes'}
          </button>
          <button type="button" className="admin-btn" onClick={() => navigate(`${prefix}/events`)}>
            Cancel
          </button>
        </div>
      </form>

      {/* Setlist editor — only for existing events */}
      {!isNew && (
        <section className="admin-related-section">
          <h2>Setlist</h2>
          <div className="admin-tracklist">
            {setlistRows.map((row, i) => (
              <div key={i} className="admin-tracklist-row">
                <select
                  className="admin-setlist-set"
                  value={row.set}
                  onChange={e => {
                    const copy = [...setlistRows];
                    copy[i] = { ...copy[i], set: e.target.value };
                    setSetlistRows(copy);
                  }}
                >
                  <option value="1">Set 1</option>
                  <option value="2">Set 2</option>
                  <option value="3">Set 3</option>
                  <option value="e">Encore</option>
                  <option value="e2">Encore 2</option>
                </select>
                <input
                  type="number"
                  className="admin-tracklist-num"
                  value={row.order}
                  onChange={e => {
                    const copy = [...setlistRows];
                    copy[i] = { ...copy[i], order: e.target.value };
                    setSetlistRows(copy);
                  }}
                  min={1}
                  placeholder="#"
                />
                <input
                  type="text"
                  className="admin-tracklist-title"
                  value={row.song}
                  onChange={e => {
                    const copy = [...setlistRows];
                    copy[i] = { ...copy[i], song: e.target.value };
                    setSetlistRows(copy);
                  }}
                  list="song-titles-setlist"
                  placeholder="Song title"
                />
                <input
                  type="text"
                  className="admin-setlist-notes"
                  value={row.notes}
                  onChange={e => {
                    const copy = [...setlistRows];
                    copy[i] = { ...copy[i], notes: e.target.value };
                    setSetlistRows(copy);
                  }}
                  placeholder="Notes"
                />
                <button
                  type="button"
                  className="admin-btn admin-btn-sm admin-btn-danger"
                  onClick={() => setSetlistRows(setlistRows.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
            <datalist id="song-titles-setlist">
              {songs.map(s => <option key={s.id} value={s.title} />)}
            </datalist>
            <button
              type="button"
              className="admin-btn admin-btn-sm"
              onClick={() => {
                const lastSet = setlistRows.length > 0 ? setlistRows[setlistRows.length - 1].set : '1';
                const lastOrder = setlistRows.filter(r => r.set === lastSet).length + 1;
                setSetlistRows([...setlistRows, { song: '', set: lastSet, order: String(lastOrder), notes: '', status: 'published' }]);
              }}
            >
              + Add Song
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-primary admin-btn-sm"
              style={{ marginLeft: '0.5rem' }}
              disabled={savingSetlist}
              onClick={async () => {
                setSavingSetlist(true);
                setError('');
                try {
                  const rows = setlistRows
                    .filter(r => r.song.trim())
                    .map(r => ({
                      event: form.id,
                      song: r.song,
                      set: r.set,
                      order: r.order,
                      notes: r.notes,
                      status: r.status,
                    }));
                  await replaceRows('Setlists', form.id, rows);
                } catch (err) {
                  setError(`Setlist save failed: ${err}`);
                } finally {
                  setSavingSetlist(false);
                }
              }}
            >
              {savingSetlist ? 'Saving...' : 'Save Setlist'}
            </button>
          </div>
        </section>
      )}

      {/* Danger zone — only for existing events */}
      {!isNew && (
        <div className="admin-danger-zone">
          <h2>Danger Zone</h2>
          <p>Permanently delete this event from the spreadsheet. This cannot be undone.</p>
          <button
            type="button"
            className="admin-btn admin-btn-danger"
            onClick={() => {
              setShowDeleteModal(true);
              setDeleteConfirmText('');
              setTimeout(() => deleteInputRef.current?.focus(), 50);
            }}
          >
            Delete Event
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="admin-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h3>Delete this event?</h3>
            <p>
              This will permanently remove <strong>{form.title_en || form.id}</strong> from the spreadsheet.
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
