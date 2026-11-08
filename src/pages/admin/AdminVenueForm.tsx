import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVenues, useAreas, useAllEvents } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import { Section, Field, BilingualRow, SaveBar, DeleteButton, useUnsavedWarning, makeId, errorText } from '../../components/admin/ui';
import { resolveArea } from '../../components/admin/VenuePicker';

interface Form { id: string; name_en: string; name_ja: string; area: string; url: string }
const empty: Form = { id: '', name_en: '', name_ja: '', area: '', url: '' };

export default function AdminVenueForm() {
  const { id } = useParams<{ id: string }>();
  const { s, locale, prefix } = useAdminT();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { venues, loading } = useVenues();
  const { areas, refresh: refreshAreas } = useAreas();
  const { events } = useAllEvents();

  // `areaText` is what's typed in the area box: a name in either language
  const [form, setForm] = useState<Form>(empty);
  const [areaText, setAreaText] = useState('');
  const [baseline, setBaseline] = useState('');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  const areaLabel = (areaId: string) => {
    const a = areas.find(x => x.id === areaId);
    return a ? (locale === 'ja' ? a.name_ja || a.name_en : a.name_en || a.name_ja) : areaId;
  };

  useEffect(() => {
    if (isNew) { setBaseline(JSON.stringify([empty, ''])); return; }
    if (loading) return;
    const v = venues.find(x => x.id === id);
    if (!v) return;
    const f = { id: v.id, name_en: v.name_en || '', name_ja: v.name_ja || '', area: v.area || '', url: v.url || '' };
    setForm(f);
    setAreaText(areaLabel(f.area));
    setBaseline(JSON.stringify([f, areaLabel(f.area)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, id, loading, venues, areas.length]);

  const dirty = baseline !== '' && JSON.stringify([form, areaText]) !== baseline;
  useUnsavedWarning(dirty);
  const set = (k: keyof Form, v: string) => { setForm(f => ({ ...f, [k]: v })); setNameError(''); };
  const usedBy = events.filter(e => e.venue_id === form.id).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name_en.trim() && !form.name_ja.trim()) { setNameError(s.venueNameMissing); return; }
    setSaving(true);
    setError('');
    try {
      const area = await resolveArea(areaText, areas);
      if (area && !areas.some(a => a.id === area.id)) refreshAreas();
      const venueId = isNew ? makeId([form.name_en || form.name_ja], new Set(venues.map(v => v.id))) : form.id;
      const fields = { ...form, id: venueId, area: area?.id || '' };
      if (isNew) await createRow('Venues', fields);
      else await updateRow('Venues', venueId, fields);
      setForm(fields);
      setBaseline(JSON.stringify([fields, areaText]));
      setSavedAt(Date.now());
      if (isNew) navigate(`${prefix}/venues/${venueId}`, { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  if (!isNew && loading) return <p className="ad-loading">{s.loading}</p>;

  return (
    <form className="ad-form" onSubmit={handleSubmit} noValidate>
      <div className="ad-page-head">
        <div>
          <p className="ad-eyebrow">{isNew ? s.venuesTitle : s.editVenue}</p>
          <h1>{isNew ? s.newVenue : (locale === 'ja' ? form.name_ja || form.name_en : form.name_en || form.name_ja)}</h1>
        </div>
      </div>

      <Section title={s.secDetails}>
        <BilingualRow>
          <Field label={`${s.venueName} · ${s.english}`} error={nameError}>
            {fid => <input id={fid} value={form.name_en} onChange={e => set('name_en', e.target.value)} />}
          </Field>
          <Field label={`${s.venueName} · ${s.japanese}`}>
            {fid => <input id={fid} lang="ja" value={form.name_ja} onChange={e => set('name_ja', e.target.value)} />}
          </Field>
        </BilingualRow>
        <Field label={s.area} hint={s.areaHint} optional s={s}>
          {fid => (
            <>
              <input id={fid} list="ad-venue-areas" value={areaText} onChange={e => setAreaText(e.target.value)} />
              <datalist id="ad-venue-areas">
                {areas.map(a => <option key={a.id} value={locale === 'ja' ? a.name_ja || a.name_en : a.name_en || a.name_ja} />)}
              </datalist>
            </>
          )}
        </Field>
        <Field label={s.venueUrl} optional s={s}>
          {fid => <input id={fid} type="url" inputMode="url" placeholder="https://" value={form.url} onChange={e => set('url', e.target.value)} />}
        </Field>
        {!isNew && (
          <div className="ad-danger-row">
            {usedBy > 0
              ? <p className="ad-hint">{usedBy} {s.showsHere}</p>
              : <DeleteButton s={s} onConfirm={async () => {
                  try { await deleteRow('Venues', form.id); navigate(`${prefix}/venues`); }
                  catch (err) { setError(errorText(err)); }
                }} />}
          </div>
        )}
      </Section>

      <SaveBar s={s} saving={saving} savedAt={savedAt} error={error} dirty={dirty} onCancel={() => navigate(`${prefix}/venues`)} />
    </form>
  );
}
