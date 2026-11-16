import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usePeople, useAllSongs, useAllSetlists, useAllEvents } from '../../hooks/useSheetData';
import { normalize } from '../../components/admin/SuggestInput';
import { todayInJapan } from '../../utils/showDates';
import { songAltTitle } from '../../utils/songTitles';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import { Section, Field, BilingualRow, SaveBar, DeleteButton, EditDialog, useUnsavedWarning, makeId, errorText } from '../../components/admin/ui';
import { personName } from '../../components/admin/PeoplePicker';
import Icon from '../../components/admin/Icon';
import { songTitle, compareSongs } from '../../utils/songTitles';
import { ActivityHistory } from '../../components/admin/Activity';
import PageHelp from '../../components/admin/PageHelp';

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
  const { setlists } = useAllSetlists();
  const { events } = useAllEvents();
  // The credits table: search, a role filter, and sortable columns (like the Songs page)
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<'all' | 'music' | 'lyrics' | 'both'>('all');
  const [sort, setSort] = useState<{ k: 'title' | 'role' | 'plays' | 'last'; desc: boolean }>({ k: 'title', desc: false });

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

  // How often and how lately each of their songs was played (setlists of past shows)
  const plays = useMemo(() => {
    const today = todayInJapan();
    const dateOf = new Map(events.map(e => [e.id, e.end_date || e.date]));
    const by = new Map<string, { n: Set<string>; last: string }>();
    for (const r of setlists) {
      const d = dateOf.get(r.event) || '';
      if (!d || d > today) continue;
      const k = normalize(r.song || '');
      const cur = by.get(k) || { n: new Set<string>(), last: '' };
      cur.n.add(r.event); if (d > cur.last) cur.last = d;
      by.set(k, cur);
    }
    return by;
  }, [setlists, events]);

  const rows = useMemo(() => {
    const order = new Map(credits.map((c, i) => [c.song.id, i]));
    const rank = (c: { music: boolean; lyrics: boolean }) => (c.music && c.lyrics ? 0 : c.music ? 1 : 2);
    const q = normalize(query);
    const out = credits
      .map(c => { const p = plays.get(normalize(c.song.title)); return { ...c, plays: p ? p.n.size : 0, last: p?.last || '' }; })
      .filter(c => (role === 'all' || (role === 'both' ? c.music && c.lyrics : role === 'music' ? c.music : c.lyrics))
        && (!q || normalize([c.song.title, c.song.title_en, c.song.title_kana].filter(Boolean).join(' ')).includes(q)));
    const dir = sort.desc ? -1 : 1;
    const byTitle = (a: typeof out[number], b: typeof out[number]) => (order.get(a.song.id)! - order.get(b.song.id)!);
    return out.sort((a, b) =>
      sort.k === 'plays' ? dir * (a.plays - b.plays) || byTitle(a, b)
      : sort.k === 'last' ? dir * (a.last || '0').localeCompare(b.last || '0') || byTitle(a, b)
      : sort.k === 'role' ? dir * (rank(a) - rank(b)) || byTitle(a, b)
      : dir * byTitle(a, b));
  }, [credits, plays, role, query, sort]);
  const sortBy = (k: typeof sort.k) => setSort(p => ({ k, desc: p.k === k ? !p.desc : k === 'plays' || k === 'last' }));

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
        <div className="lu-page-head"><div><p className="lu-eyebrow">{s.people}</p><h1>{s.newPerson}<PageHelp /></h1></div></div>
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
  const head = (k: typeof sort.k, label: string, className = '') => (
    <th className={className} aria-sort={sort.k === k ? (sort.desc ? 'descending' : 'ascending') : undefined}>
      <button type="button" className={`lu-sort${sort.k === k ? ' is-on' : ''}`} onClick={() => sortBy(k)}>
        {label}<span aria-hidden="true">{sort.k === k ? (sort.desc ? ' ↓' : ' ↑') : ''}</span>
      </button>
    </th>
  );
  const roleLabel = (c: { music: boolean; lyrics: boolean }) => (c.music && c.lyrics ? s.creditBoth : c.music ? s.creditMusic : s.creditLyrics);
  const roles = [
    { v: 'all' as const, label: s.filterAll, n: credits.length },
    { v: 'music' as const, label: s.creditMusic, n: credits.filter(c => c.music).length },
    { v: 'lyrics' as const, label: s.creditLyrics, n: credits.filter(c => c.lyrics).length },
    { v: 'both' as const, label: s.creditBoth, n: credits.filter(c => c.music && c.lyrics).length },
  ].filter(r => r.v === 'all' || r.n > 0);

  return (
    <div className="lu-person-page">
      {leaveGuard}
      <div className="lu-song-card lu-person-head">
        <div className="lu-song-card-head">
          <p className="lu-eyebrow"><Link to={`${prefix}/people`}><Icon name="back" /> {s.people}</Link></p>
          <button type="button" className="lu-icon-btn lu-edit-btn" onClick={() => setEditing(true)} aria-label={s.songEdit} title={s.songEdit}><Icon name="edit" /></button>
        </div>
        <div className="lu-person-head-row">
          <div>
            <h1>{main}<PageHelp /></h1>
            {other && other !== main && <p className="lu-song-alt lu-rel-alt" lang={locale === 'ja' ? 'en' : 'ja'}>{other}</p>}
          </div>
          <ul className="lu-song-stats" aria-label={s.songStats}>
            <li><span className="lu-stat"><strong>{credits.length}</strong><span>{s.personStatSongs}</span></span></li>
            <li><span className="lu-stat"><strong>{credits.filter(c => c.music).length}</strong><span>{s.creditMusic}</span></span></li>
            <li><span className="lu-stat"><strong>{credits.filter(c => c.lyrics).length}</strong><span>{s.creditLyrics}</span></span></li>
          </ul>
        </div>
      </div>

      <h2 className="lu-person-title">{s.credits} <span className="lu-count">{credits.length}</span></h2>
      {credits.length === 0 ? <p className="lu-hint">{s.noCredits}</p> : (
        <>
          <div className="lu-songs-tools">
            <input className="lu-search" type="search" placeholder={s.search} value={query} onChange={e => setQuery(e.target.value)} aria-label={s.search} />
            <div className="lu-chips" role="group" aria-label={s.filterLabel}>
              {roles.map(r => (
                <button key={r.v} type="button" aria-pressed={role === r.v} className={`lu-pill${role === r.v ? ' is-on' : ''}`} onClick={() => setRole(r.v)}>
                  {r.label} <span className="lu-pill-n">{r.n}</span>
                </button>
              ))}
            </div>
          </div>
          {rows.length === 0 ? <p className="lu-empty">{s.noResults}</p> : (
            <div className="lu-table-wrap">
              <table className="lu-table lu-person-grid">
                <thead>
                  <tr>
                    {head('title', s.colTitle)}
                    {head('role', s.credits)}
                    {head('plays', s.songStatLive, 'lu-td-num')}
                    {head('last', s.songStatLast)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(c => (
                    <tr key={c.song.id} onClick={e => { if (!(e.target as HTMLElement).closest('a')) navigate(`${prefix}/songs/${c.song.id}`); }}>
                      <td className="lu-sg-title">
                        <Link to={`${prefix}/songs/${c.song.id}`}>{songTitle(c.song, locale)}</Link>
                        {songAltTitle(c.song, locale) && <span className="lu-sg-alt">{songAltTitle(c.song, locale)}</span>}
                        {c.song.status === 'private' && <span className="lu-tag is-muted lu-sg-draft"><Icon name="lock" /> {s.songDraft}</span>}
                      </td>
                      <td className="lu-pg-role">{roleLabel(c)}</td>
                      <td className="lu-td-num">{c.plays || <span className="lu-sg-none">0</span>}<span className="lu-pg-unit">{locale === 'ja' ? '回' : c.plays === 1 ? ' show' : ' shows'}</span></td>
                      <td className="lu-sg-date">{c.last || <span className="lu-sg-none">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <div className="lu-history-wrap"><ActivityHistory s={s} locale={locale} refs={[`People:${id}`]} /></div>

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
