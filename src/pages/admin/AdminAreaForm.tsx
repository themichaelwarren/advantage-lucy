import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAreas, useVenues, usePrefectures, useAllEvents } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import { Section, Field, BilingualRow, SaveBar, DeleteButton, useUnsavedWarning, makeId, errorText } from '../../components/admin/ui';

// The server rewrites whole rows, so every column is always sent
interface Form { id: string; name_en: string; name_ja: string; prefecture: string }
const empty: Form = { id: '', name_en: '', name_ja: '', prefecture: '' };

export default function AdminAreaForm() {
  const { id } = useParams<{ id: string }>();
  const { s, locale, prefix } = useAdminT();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { areas, loading } = useAreas();
  const { venues } = useVenues();
  const { prefectures } = usePrefectures();
  const { events } = useAllEvents();

  const [form, setForm] = useState<Form>(empty);
  const [baseline, setBaseline] = useState('');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) { setBaseline(JSON.stringify(empty)); return; }
    if (loading) return;
    const a = areas.find(x => x.id === id);
    if (!a) return;
    const f: Form = { id: a.id, name_en: a.name_en || '', name_ja: a.name_ja || '', prefecture: a.prefecture || '' };
    setForm(f);
    setBaseline(JSON.stringify(f));
  }, [isNew, id, loading, areas]);

  const dirty = baseline !== '' && JSON.stringify(form) !== baseline;
  const leaveGuard = useUnsavedWarning(dirty, saving);
  const set = (k: keyof Form, v: string) => { setForm(f => ({ ...f, [k]: v })); setNameError(''); };

  const here = useMemo(() => {
    const shows = new Map<string, number>();
    events.forEach(e => e.venue_id && shows.set(e.venue_id, (shows.get(e.venue_id) || 0) + 1));
    return venues
      .filter(v => form.id && v.area === form.id)
      .map(v => ({ v, name: (locale === 'ja' ? v.name_ja || v.name_en : v.name_en || v.name_ja) || v.id, shows: shows.get(v.id) || 0 }))
      .sort((a, b) => b.shows - a.shows || a.name.localeCompare(b.name, locale));
  }, [venues, events, form.id, locale]);

  const prefOptions = useMemo(
    () => prefectures
      .map(p => ({ id: p.id, name: (locale === 'ja' ? p.name_ja || p.name_en : p.name_en || p.name_ja) || p.id }))
      .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [prefectures, locale],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name_en.trim() && !form.name_ja.trim()) { setNameError(s.areaNameMissing); return; }
    setSaving(true);
    setError('');
    try {
      const en = form.name_en.trim();
      const areaId = isNew
        ? makeId([en && /^[\x20-\x7e]+$/.test(en) ? en : `area-${Date.now().toString(36)}`], new Set(areas.map(a => a.id)))
        : form.id;
      const fields = { ...form, id: areaId, name_en: form.name_en.trim(), name_ja: form.name_ja.trim() };
      if (isNew) await createRow('Areas', { ...fields });
      else await updateRow('Areas', areaId, { ...fields });
      setForm(fields);
      setBaseline(JSON.stringify(fields));
      setSavedAt(Date.now());
      if (isNew) navigate(`${prefix}/areas/${areaId}`, { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  if (!isNew && loading) return <p className="lu-loading">{s.loading}</p>;

  const heading = isNew ? s.newAreaTitle : (locale === 'ja' ? form.name_ja || form.name_en : form.name_en || form.name_ja) || form.id;

  return (
    <form className="lu-form" onSubmit={handleSubmit} noValidate>
      {leaveGuard}
      <div className="lu-page-head">
        <div>
          <p className="lu-eyebrow">{isNew ? s.areas : s.editArea}</p>
          <h1>{heading}</h1>
        </div>
      </div>

      <Section title={s.secDetails}>
        <BilingualRow>
          <Field label={`${s.areaName} · ${s.english}`} error={nameError}>
            {fid => <input id={fid} value={form.name_en} onChange={e => set('name_en', e.target.value)} />}
          </Field>
          <Field label={`${s.areaName} · ${s.japanese}`}>
            {fid => <input id={fid} lang="ja" value={form.name_ja} onChange={e => set('name_ja', e.target.value)} />}
          </Field>
        </BilingualRow>
        <Field label={s.prefecture} optional s={s}>
          {fid => (
            <select id={fid} value={form.prefecture} onChange={e => set('prefecture', e.target.value)}>
              <option value="">{s.prefectureNone}</option>
              {prefOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              {form.prefecture && !prefOptions.some(p => p.id === form.prefecture) && <option value={form.prefecture}>{form.prefecture}</option>}
            </select>
          )}
        </Field>
      </Section>

      {!isNew && (
        <Section title={`${s.venuesHere} · ${here.length}`}>
          {here.length === 0 ? <p className="lu-hint">{s.noVenuesHere}</p> : (
            <ul className="lu-list lu-usage">
              {here.map(({ v, name, shows }) => (
                <li key={v.id}>
                  <Link to={`${prefix}/venues/${v.id}`} className="lu-list-row">
                    <span className="lu-list-main"><strong>{name}</strong></span>
                    <span className="lu-list-tags"><span className="lu-tag">{shows} {s.showsHere}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="lu-danger-row">
            {here.length > 0
              ? <p className="lu-hint">{s.inUseCantDelete}</p>
              : <DeleteButton s={s} onConfirm={async () => {
                  try { await deleteRow('Areas', form.id); navigate(`${prefix}/areas`); }
                  catch (err) { setError(errorText(err)); }
                }} />}
          </div>
        </Section>
      )}

      <SaveBar s={s} saving={saving} savedAt={savedAt} error={error} dirty={dirty} backHref={`${prefix}/areas`} />
    </form>
  );
}
