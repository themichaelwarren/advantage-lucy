import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useVenues, useAreas, useAllEvents, usePrefectures, useCountries } from '../../hooks/useSheetData';
import { prefectureSuggestions } from '../../components/admin/places';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import { Section, Field, BilingualRow, SaveBar, DeleteButton, useUnsavedWarning, makeId, errorText } from '../../components/admin/ui';
import { resolveArea, areaSuggestions, isKnownArea } from '../../components/admin/VenuePicker';
import SuggestInput from '../../components/admin/SuggestInput';

interface Form { id: string; name_en: string; name_ja: string; area: string; url: string }
const empty: Form = { id: '', name_en: '', name_ja: '', area: '', url: '' };

export default function AdminVenueForm() {
  const { id } = useParams<{ id: string }>();
  const { s, locale, prefix } = useAdminT();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { venues, loading } = useVenues();
  const { areas, refresh: refreshAreas } = useAreas();
  const areaList = useMemo(() => areaSuggestions(areas, locale), [areas, locale]);
  const { prefectures } = usePrefectures();
  const { countries } = useCountries();
  const prefList = useMemo(() => {
    const cn = new Map(countries.map(c => [c.id, locale === 'ja' ? c.name_ja || c.name_en : c.name_en || c.name_ja]));
    return prefectureSuggestions(prefectures, locale, id => cn.get(id) || '');
  }, [prefectures, countries, locale]);
  const [newAreaPrefecture, setNewAreaPrefecture] = useState('');
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
  const leaveGuard = useUnsavedWarning(dirty, saving);
  const set = (k: keyof Form, v: string) => { setForm(f => ({ ...f, [k]: v })); setNameError(''); };
  const showsHere = useMemo(
    () => events.filter(e => form.id && e.venue_id === form.id).sort((a, b) => b.date.localeCompare(a.date)),
    [events, form.id],
  );
  const usedBy = showsHere.length;
  const showName = (e: typeof events[number]) =>
    (locale === 'ja' ? e.title_ja || e.title_en : e.title_en || e.title_ja) || '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name_en.trim() && !form.name_ja.trim()) { setNameError(s.venueNameMissing); return; }
    setSaving(true);
    setError('');
    try {
      const area = await resolveArea(areaText, areas, newAreaPrefecture, prefectures);
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

  if (!isNew && loading) return <p className="lu-loading">{s.loading}</p>;

  const heading = isNew ? s.newVenue : (locale === 'ja' ? form.name_ja || form.name_en : form.name_en || form.name_ja);

  return (
    <form className="lu-form" onSubmit={handleSubmit} noValidate>
      {leaveGuard}
      <div className="lu-page-head">
        <div>
          <p className="lu-eyebrow">{isNew ? s.venuesTitle : s.editVenue}</p>
          <h1>{heading}</h1>
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
            <SuggestInput id={fid} value={areaText} onChange={setAreaText} suggestions={areaList} newLabel={s.newArea} />
          )}
        </Field>
        {!isKnownArea(areaText, areas) && (
          <Field label={s.prefectureForNewArea} hint={s.prefectureHint} optional s={s}>
            {fid => <SuggestInput id={fid} value={newAreaPrefecture} onChange={setNewAreaPrefecture} suggestions={prefList} newLabel={s.newPrefecture} />}
          </Field>
        )}
        {form.area && areas.some(a => a.id === form.area) && areaText === areaLabel(form.area) && (
          <Link to={`${prefix}/areas/${form.area}`} className="lu-related-link">{s.openArea} →</Link>
        )}
        <Field label={s.venueUrl} optional s={s}>
          {fid => <input id={fid} type="url" inputMode="url" placeholder="https://" value={form.url} onChange={e => set('url', e.target.value)} />}
        </Field>
        {!isNew && (
          <div className="lu-danger-row">
            {usedBy > 0
              ? <p className="lu-hint">{s.inUseCantDelete}</p>
              : <DeleteButton s={s} onConfirm={async () => {
                  try { await deleteRow('Venues', form.id); navigate(`${prefix}/venues`); }
                  catch (err) { setError(errorText(err)); }
                }} />}
          </div>
        )}
      </Section>

      {!isNew && (
        <Section title={`${s.showsAtVenue} · ${showsHere.length}`}>
          {showsHere.length === 0 ? <p className="lu-hint">{s.noShowsAtVenue}</p> : (
            <ul className="lu-list lu-usage">
              {showsHere.map(e => (
                <li key={e.id}>
                  <Link to={`${prefix}/events/${e.id}`} className="lu-list-row">
                    <time>{e.date}</time>
                    <span className="lu-list-main"><strong>{showName(e) || heading}</strong></span>
                    {e.status === 'private' && <span className="lu-list-tags"><span className="lu-tag is-muted">{s.hidden}</span></span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <SaveBar s={s} saving={saving} savedAt={savedAt} error={error} dirty={dirty} backHref={`${prefix}/venues`} />
    </form>
  );
}
