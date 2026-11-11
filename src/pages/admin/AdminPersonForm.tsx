import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usePeople, useAllSongs } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import { Section, Field, BilingualRow, SaveBar, DeleteButton, EditDialog, useUnsavedWarning, makeId, errorText } from '../../components/admin/ui';
import { personName } from '../../components/admin/PeoplePicker';
import Icon from '../../components/admin/Icon';
import { songTitle, compareSongs } from '../../utils/songTitles';

// The server rewrites whole rows, so every column is always sent
interface Form { id: string; name_family_en: string; name_given_en: string; name_family_ja: string; name_given_ja: string }
const empty: Form = { id: '', name_family_en: '', name_given_en: '', name_family_ja: '', name_given_ja: '' };

/**
 * A person, read first: their name in both languages and what they wrote,
 * on the left; the songs they're credited on, on the right. ✎ opens the
 * names in a small window. A new person is one plain form.
 */
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
  const [editing, setEditing] = useState(false);
  useEffect(() => { setEditing(false); }, [id]);

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
      .map(x => ({ song: x, music: has(x.music_by), lyrics: has(x.lyrics_by) }))
      .sort((a, b) => compareSongs(locale)(a.song, b.song));
  }, [songs, form.id, locale]);

  async function save(): Promise<boolean> {
    const anyName = [form.name_family_en, form.name_given_en, form.name_family_ja, form.name_given_ja].some(t => t.trim());
    if (!anyName) { setNameError(s.personNameMissing); return false; }
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
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  const fields = (
    <>
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
    </>
  );

  if (!isNew && loading) return <p className="lu-loading">{s.loading}</p>;

  // ---------- A new person: one plain form ----------
  if (isNew) {
    return (
      <form className="lu-form" onSubmit={e => { e.preventDefault(); save(); }} noValidate>
        {leaveGuard}
        <div className="lu-page-head"><div><p className="lu-eyebrow">{s.people}</p><h1>{s.newPerson}</h1></div></div>
        <Section title={s.secDetails}>{fields}</Section>
        <SaveBar s={s} saving={saving} savedAt={savedAt} error={error} dirty={dirty} backHref={`${prefix}/people`} />
      </form>
    );
  }
  if (!people.some(p => p.id === id)) return <p className="lu-empty">{s.noResults}</p>;

  // ---------- The person at a glance ----------
  const saved = baseline ? (JSON.parse(baseline) as Form) : form;
  const main = personName(saved, locale);
  const other = personName(saved, locale === 'ja' ? 'en' : 'ja');
  const groups = [
    { label: s.creditBoth, list: credits.filter(c => c.music && c.lyrics) },
    { label: s.creditMusic, list: credits.filter(c => c.music && !c.lyrics) },
    { label: s.creditLyrics, list: credits.filter(c => !c.music && c.lyrics) },
  ].filter(g => g.list.length);

  return (
    <div className="lu-song-page lu-rel-page">
      {leaveGuard}
      <div className="lu-song-layout">
        <aside className="lu-song-side">
          <div className="lu-song-card">
            <div className="lu-song-card-head">
              <p className="lu-eyebrow"><Link to={`${prefix}/people`}><Icon name="back" /> {s.people}</Link></p>
              <button type="button" className="lu-icon-btn lu-edit-btn" onClick={() => setEditing(true)} aria-label={s.songEdit} title={s.songEdit}><Icon name="edit" /></button>
            </div>
            <div>
              <h1>{main}</h1>
              {other && other !== main && <p className="lu-song-alt lu-rel-alt" lang={locale === 'ja' ? 'en' : 'ja'}>{other}</p>}
            </div>
            <ul className="lu-song-stats" aria-label={s.songStats}>
              <li><span className="lu-stat"><strong>{credits.length}</strong><span>{s.personStatSongs}</span></span></li>
              <li><span className="lu-stat"><strong>{credits.filter(c => c.music).length}</strong><span>{s.creditMusic}</span></span></li>
              <li><span className="lu-stat"><strong>{credits.filter(c => c.lyrics).length}</strong><span>{s.creditLyrics}</span></span></li>
            </ul>
          </div>
        </aside>

        <div className="lu-song-main">
          <Section title={`${s.credits} · ${credits.length}`}>
            {credits.length === 0 ? <p className="lu-hint">{s.noCredits}</p> : (
              <div className="lu-song-history">
                {groups.map(g => (
                  <div key={g.label} className="lu-song-year">
                    <h3>{g.label}</h3>
                    <ul className="lu-list lu-usage lu-compact">
                      {g.list.map(({ song }) => (
                        <li key={song.id}>
                          <Link to={`${prefix}/songs/${song.id}`} className="lu-list-row">
                            <span className="lu-list-main"><strong>{songTitle(song, locale)}</strong></span>
                            {song.status === 'private' && <span className="lu-list-tags"><span className="lu-tag is-muted"><Icon name="lock" /> {s.songDraft}</span></span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      <EditDialog s={s} title={s.secDetails} open={editing} saving={saving} error={error} dirty={dirty}
        onSave={() => { save().then(ok => { if (ok) setEditing(false); }); }}
        onClose={() => {
          if (dirty && !window.confirm(s.songDiscard)) return;
          if (baseline) setForm(JSON.parse(baseline) as Form);
          setNameError(''); setError(''); setEditing(false);
        }}
        footer={credits.length > 0
          ? <span className="lu-hint">{s.inUseCantDelete}</span>
          : <DeleteButton s={s} onConfirm={async () => {
              try { await deleteRow('People', form.id); navigate(`${prefix}/people`); }
              catch (err) { setError(errorText(err)); }
            }} />}>
        {fields}
      </EditDialog>
    </div>
  );
}
