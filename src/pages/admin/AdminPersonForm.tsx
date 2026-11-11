import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usePeople, useAllSongs } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import { Section, Field, BilingualRow, SaveBar, DeleteButton, useUnsavedWarning, makeId, errorText } from '../../components/admin/ui';
import { personName } from '../../components/admin/PeoplePicker';

// The server rewrites whole rows, so every column is always sent
interface Form { id: string; name_family_en: string; name_given_en: string; name_family_ja: string; name_given_ja: string }
const empty: Form = { id: '', name_family_en: '', name_given_en: '', name_family_ja: '', name_given_ja: '' };

export default function AdminPersonForm() {
  const { id } = useParams<{ id: string }>();
  const { s, locale, prefix } = useAdminT();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { people, loading } = usePeople();
  const { songs } = useAllSongs();

  const [form, setForm] = useState<Form>(empty);
  const [baseline, setBaseline] = useState('');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) { setBaseline(JSON.stringify(empty)); return; }
    if (loading) return;
    const p = people.find(x => x.id === id);
    if (!p) return;
    const f: Form = {
      id: p.id, name_family_en: p.name_family_en || '', name_given_en: p.name_given_en || '',
      name_family_ja: p.name_family_ja || '', name_given_ja: p.name_given_ja || '',
    };
    setForm(f);
    setBaseline(JSON.stringify(f));
  }, [isNew, id, loading, people]);

  const dirty = baseline !== '' && JSON.stringify(form) !== baseline;
  const leaveGuard = useUnsavedWarning(dirty, saving);
  const set = (k: keyof Form, v: string) => { setForm(f => ({ ...f, [k]: v })); setNameError(''); };

  const credits = useMemo(() => {
    const has = (csv?: string) => (csv || '').split(',').map(t => t.trim()).includes(form.id);
    return songs
      .filter(x => form.id && (has(x.music_by) || has(x.lyrics_by)))
      .map(x => ({ song: x, roles: [has(x.music_by) && s.creditMusic, has(x.lyrics_by) && s.creditLyrics].filter(Boolean) as string[] }))
      .sort((a, b) => a.song.title.localeCompare(b.song.title, locale));
  }, [songs, form.id, s, locale]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const anyName = [form.name_family_en, form.name_given_en, form.name_family_ja, form.name_given_ja].some(t => t.trim());
    if (!anyName) { setNameError(s.personNameMissing); return; }
    setSaving(true);
    setError('');
    try {
      const en = [form.name_given_en, form.name_family_en].filter(t => t.trim()).join(' ');
      const personId = isNew
        ? makeId([en && /^[\x20-\x7e]+$/.test(en) ? en : `person-${Date.now().toString(36)}`], new Set(people.map(p => p.id)))
        : form.id;
      const fields = { ...form, id: personId };
      if (isNew) await createRow('People', { ...fields });
      else await updateRow('People', personId, { ...fields });
      setForm(fields);
      setBaseline(JSON.stringify(fields));
      setSavedAt(Date.now());
      if (isNew) navigate(`${prefix}/people/${personId}`, { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  if (!isNew && loading) return <p className="lu-loading">{s.loading}</p>;

  const heading = isNew ? s.newPerson : personName(form, locale);

  return (
    <form className="lu-form" onSubmit={handleSubmit} noValidate>
      {leaveGuard}
      <div className="lu-page-head">
        <div>
          <p className="lu-eyebrow">{isNew ? s.people : s.editPerson}</p>
          <h1>{heading}</h1>
        </div>
      </div>

      <Section title={s.secDetails}>
        <BilingualRow>
          <Field label={`${s.familyName} · ${s.japanese}`} error={nameError}>
            {fid => <input id={fid} lang="ja" value={form.name_family_ja} onChange={e => set('name_family_ja', e.target.value)} />}
          </Field>
          <Field label={`${s.givenName} · ${s.japanese}`}>
            {fid => <input id={fid} lang="ja" value={form.name_given_ja} onChange={e => set('name_given_ja', e.target.value)} />}
          </Field>
        </BilingualRow>
        <BilingualRow>
          <Field label={`${s.givenName} · ${s.english}`}>
            {fid => <input id={fid} value={form.name_given_en} onChange={e => set('name_given_en', e.target.value)} />}
          </Field>
          <Field label={`${s.familyName} · ${s.english}`}>
            {fid => <input id={fid} value={form.name_family_en} onChange={e => set('name_family_en', e.target.value)} />}
          </Field>
        </BilingualRow>
      </Section>

      {!isNew && (
        <Section title={`${s.credits} · ${credits.length}`}>
          {credits.length === 0 ? <p className="lu-hint">{s.noCredits}</p> : (
            <ul className="lu-list lu-usage">
              {credits.map(({ song, roles }) => (
                <li key={song.id}>
                  <Link to={`${prefix}/songs/${song.id}`} className="lu-list-row">
                    <span className="lu-list-main"><strong>{song.title}</strong></span>
                    <span className="lu-list-tags">{roles.map(r => <span key={r} className="lu-tag">{r}</span>)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="lu-danger-row">
            {credits.length > 0
              ? <p className="lu-hint">{s.inUseCantDelete}</p>
              : <DeleteButton s={s} onConfirm={async () => {
                  try { await deleteRow('People', form.id); navigate(`${prefix}/people`); }
                  catch (err) { setError(errorText(err)); }
                }} />}
          </div>
        </Section>
      )}

      <SaveBar s={s} saving={saving} savedAt={savedAt} error={error} dirty={dirty} backHref={`${prefix}/people`} />
    </form>
  );
}
