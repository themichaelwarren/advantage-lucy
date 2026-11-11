import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAreas, useVenues, usePrefectures, useCountries, useAllEvents, useAllSetlists } from '../../hooks/useSheetData';
import SuggestInput from '../../components/admin/SuggestInput';
import { prefectureSuggestions, prefectureName, resolvePrefecture } from '../../components/admin/places';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import { Section, Field, BilingualRow, SaveBar, DeleteButton, EditDialog, useUnsavedWarning, makeId, errorText } from '../../components/admin/ui';
import Icon from '../../components/admin/Icon';
import { useFitsViewport } from '../../hooks/useFitsViewport';
import { todayInJapan } from '../../utils/showDates';
import type { Event } from '../../types';
import { ActivityHistory } from '../../components/admin/Activity';

// The server rewrites whole rows, so every column is always sent
interface Form { id: string; name_en: string; name_ja: string; prefecture: string }
const empty: Form = { id: '', name_en: '', name_ja: '', prefecture: '' };

/**
 * An area (Shimokitazawa…), read first: what and where on the left (with a
 * map); its venues and every show there on the right. ✎ opens the details
 * in a small window. A new area is one plain form.
 */
export default function AdminAreaForm() {
  const { id } = useParams<{ id: string }>();
  const { s, locale, prefix } = useAdminT();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { areas, loading } = useAreas();
  const { venues } = useVenues();
  const { prefectures, refresh: refreshPrefectures } = usePrefectures();
  const { countries } = useCountries();
  const { events } = useAllEvents();
  const { setlists } = useAllSetlists();
  const withSetlist = useMemo(() => new Set(setlists.map(r => r.event)), [setlists]);

  // What's typed in the prefecture box: a name in either language
  const [form, setForm] = useState<Form>(empty);
  const [prefText, setPrefText] = useState('');
  const [baseline, setBaseline] = useState('');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  useEffect(() => { setEditing(false); }, [id]);
  const panel = useFitsViewport<HTMLElement>(32);
  const pick = (en?: string, ja?: string) => (locale === 'ja' ? ja || en : en || ja) || '';

  useEffect(() => {
    if (isNew) { setBaseline(JSON.stringify([empty, ''])); return; }
    if (loading) return;
    const a = areas.find(x => x.id === id);
    if (!a) return;
    const f: Form = { id: a.id, name_en: a.name_en || '', name_ja: a.name_ja || '', prefecture: a.prefecture || '' };
    const pt = f.prefecture ? prefectureName(f.prefecture, prefectures, locale) : '';
    setForm(f);
    setPrefText(pt);
    setBaseline(JSON.stringify([f, pt]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, id, loading, areas, prefectures.length]);

  const dirty = baseline !== '' && JSON.stringify([form, prefText]) !== baseline;
  const leaveGuard = useUnsavedWarning(dirty, saving);
  const set = (k: keyof Form, v: string) => { setForm(f => ({ ...f, [k]: v })); setNameError(''); };

  // Venues here (most-played first) and every show at them
  const { here, shows } = useMemo(() => {
    const count = new Map<string, number>();
    events.forEach(e => e.venue_id && count.set(e.venue_id, (count.get(e.venue_id) || 0) + 1));
    const here = venues
      .filter(v => form.id && v.area === form.id)
      .map(v => ({ v, name: pick(v.name_en, v.name_ja) || v.id, shows: count.get(v.id) || 0 }))
      .sort((a, b) => b.shows - a.shows || a.name.localeCompare(b.name, locale));
    const ids = new Set(here.map(h => h.v.id));
    const shows = events.filter(e => e.venue_id && ids.has(e.venue_id)).sort((a, b) => b.date.localeCompare(a.date));
    return { here, shows };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues, events, form.id, locale]);

  const prefList = useMemo(() => {
    const cn = new Map(countries.map(c => [c.id, locale === 'ja' ? c.name_ja || c.name_en : c.name_en || c.name_ja]));
    return prefectureSuggestions(prefectures, locale, id => cn.get(id) || '');
  }, [prefectures, countries, locale]);

  async function save(): Promise<boolean> {
    if (!form.name_en.trim() && !form.name_ja.trim()) { setNameError(s.areaNameMissing); return false; }
    setSaving(true);
    setError('');
    try {
      const en = form.name_en.trim();
      const areaId = isNew
        ? makeId([en && /^[\x20-\x7e]+$/.test(en) ? en : `area-${Date.now().toString(36)}`], new Set(areas.map(a => a.id)))
        : form.id;
      const prefecture = await resolvePrefecture(prefText, prefectures);
      if (prefecture && !prefectures.some(p => p.id === prefecture)) refreshPrefectures();
      const fields = { ...form, id: areaId, name_en: form.name_en.trim(), name_ja: form.name_ja.trim(), prefecture };
      if (isNew) await createRow('Areas', { ...fields });
      else await updateRow('Areas', areaId, { ...fields });
      setForm(fields);
      setBaseline(JSON.stringify([fields, prefText]));
      setSavedAt(Date.now());
      if (isNew) navigate(`${prefix}/areas/${areaId}`, { replace: true });
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
        <Field label={`${s.areaName} · ${s.english}`} error={nameError}>
          {fid => <input id={fid} value={form.name_en} onChange={e => set('name_en', e.target.value)} />}
        </Field>
        <Field label={`${s.areaName} · ${s.japanese}`}>
          {fid => <input id={fid} lang="ja" value={form.name_ja} onChange={e => set('name_ja', e.target.value)} />}
        </Field>
      </BilingualRow>
      <Field label={s.prefecture} hint={s.prefectureHint} s={s}>
        {fid => <SuggestInput id={fid} value={prefText} onChange={setPrefText} suggestions={prefList} newLabel={s.newPrefecture} />}
      </Field>
    </>
  );

  if (!isNew && loading) return <p className="lu-loading">{s.loading}</p>;

  // ---------- A new area: one plain form ----------
  if (isNew) {
    return (
      <form className="lu-form" onSubmit={e => { e.preventDefault(); save(); }} noValidate>
        {leaveGuard}
        <div className="lu-page-head"><div><p className="lu-eyebrow">{s.areas}</p><h1>{s.newAreaTitle}</h1></div></div>
        <Section title={s.secDetails}>{fields}</Section>
        <SaveBar s={s} saving={saving} savedAt={savedAt} error={error} dirty={dirty} backHref={`${prefix}/areas`} />
      </form>
    );
  }
  if (!areas.some(a => a.id === id)) return <p className="lu-empty">{s.noResults}</p>;

  // ---------- The area at a glance ----------
  const saved = baseline ? (JSON.parse(baseline)[0] as Form) : form;
  const name = pick(saved.name_en, saved.name_ja) || saved.id;
  const other = locale === 'ja' ? saved.name_en : saved.name_ja;
  const pref = prefectures.find(p => p.id === saved.prefecture);
  const today = todayInJapan();
  const past = shows.filter(e => (e.end_date || e.date) < today);
  const years = past.map(e => e.date.slice(0, 4));
  const span = years.length ? (years[0] === years[years.length - 1] ? years[0] : `${years[years.length - 1]}–${years[0]}`) : '';
  const byYear: [string, Event[]][] = [];
  for (const e of shows) {
    const y = e.date.slice(0, 4);
    const g = byYear[byYear.length - 1];
    if (g && g[0] === y) g[1].push(e); else byYear.push([y, [e]]);
  }
  const venueName = (vid?: string) => { const v = venues.find(x => x.id === vid); return v ? pick(v.name_en, v.name_ja) : ''; };
  const mapQuery = [saved.name_ja || saved.name_en, pref?.name_ja || pref?.name_en].filter(Boolean).join(' ');

  return (
    <div className="lu-song-page lu-venue-page">
      {leaveGuard}
      <div className="lu-song-layout">
        <aside ref={panel.ref} className={`lu-song-side${panel.fits ? ' is-sticky' : ''}`} style={{ top: panel.top }}>
          <div className="lu-song-card">
            <div className="lu-song-card-head">
              <p className="lu-eyebrow"><Link to={`${prefix}/areas`}><Icon name="back" /> {s.areas}</Link></p>
              <button type="button" className="lu-icon-btn lu-edit-btn" onClick={() => setEditing(true)} aria-label={s.songEdit} title={s.songEdit}><Icon name="edit" /></button>
            </div>
            <div>
              <h1>{name}</h1>
              {other && other !== name && <p className="lu-song-alt lu-rel-alt" lang={locale === 'ja' ? 'en' : 'ja'}>{other}</p>}
            </div>
            <dl className="lu-song-credits">
              <dt>{s.prefecture}</dt>
              <dd>{pref ? <Link to={`${prefix}/prefectures/${pref.id}`}>{pick(pref.name_en, pref.name_ja)}</Link>
                : <button type="button" className="lu-link-btn" onClick={() => setEditing(true)}>+ {s.prefecture}</button>}</dd>
            </dl>
            <ul className="lu-song-stats" aria-label={s.songStats}>
              <li><span className="lu-stat"><strong>{here.length}</strong><span>{s.venues}</span></span></li>
              <li><a className="lu-stat" href="#shows"><strong>{past.length}</strong><span>{s.venueStatShows}</span></a></li>
              {span && <li><span className="lu-stat"><strong>{span}</strong><span>{s.areaStatYears}</span></span></li>}
            </ul>
          </div>
          {mapQuery && (
            <div className="lu-song-card lu-venue-map">
              <iframe title={s.venueMap} src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&hl=${locale}&output=embed`}
                loading="lazy" referrerPolicy="no-referrer-when-downgrade" allow="fullscreen" allowFullScreen />
              <a className="lu-hint" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noopener noreferrer">{s.venueMapOpen} <Icon name="external" /></a>
            </div>
          )}
        </aside>

        <div className="lu-song-main">
          <Section title={`${s.venuesHere} · ${here.length}`}>
            {here.length === 0 ? <p className="lu-hint">{s.noVenuesHere}</p> : (
              <ul className="lu-list lu-usage lu-compact">
                {here.map(({ v, name: vn, shows: n }) => (
                  <li key={v.id}>
                    <Link to={`${prefix}/venues/${v.id}`} className="lu-list-row">
                      <span className="lu-list-main"><strong>{vn}</strong></span>
                      <span className="lu-list-tags"><span className="lu-tag">{n} {s.showsHere}</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={`${s.areaShows} · ${shows.length}`} id="shows">
            {shows.length === 0 ? <p className="lu-hint">{s.noShowsAtVenue}</p> : (
              <div className="lu-song-history">
                {byYear.map(([year, list]) => (
                  <div key={year} className="lu-song-year">
                    <h3>{year}</h3>
                    <ul className="lu-list lu-usage lu-compact">
                      {list.map(e => (
                        <li key={e.id}>
                          <Link to={`${prefix}/events/${e.id}`} className="lu-list-row">
                            <time>{e.date.slice(5).replace('-', '/')}</time>
                            <span className="lu-list-main">
                              <strong>{pick(e.title_en, e.title_ja) || venueName(e.venue_id)}</strong>
                              {pick(e.title_en, e.title_ja) && <span>{venueName(e.venue_id)}</span>}
                            </span>
                            {/* Same tags as the venue page: does this show have a setlist yet? */}
                            <span className="lu-list-tags">
                              {e.status === 'private' && <span className="lu-tag is-muted">{s.hidden}</span>}
                              {(e.end_date || e.date) < today && (withSetlist.has(e.id)
                                ? <span className="lu-tag is-ok"><Icon name="setlist" /> {s.hasSetlist}</span>
                                : <span className="lu-tag is-todo">{s.noSetlist}</span>)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Section>
          <div className="lu-history-wrap"><ActivityHistory s={s} locale={locale} refs={[`Areas:${id}`]} /></div>
        </div>
      </div>

      <EditDialog s={s} title={s.secDetails} open={editing} saving={saving} error={error} dirty={dirty}
        onSave={() => { save().then(ok => { if (ok) setEditing(false); }); }}
        onClose={() => {
          if (dirty && !window.confirm(s.songDiscard)) return;
          if (baseline) { const [f, t] = JSON.parse(baseline) as [Form, string]; setForm(f); setPrefText(t); }
          setNameError(''); setError(''); setEditing(false);
        }}
        footer={here.length > 0
          ? <span className="lu-hint">{s.inUseCantDelete}</span>
          : <DeleteButton s={s} onConfirm={async () => {
              try { await deleteRow('Areas', form.id); navigate(`${prefix}/areas`); }
              catch (err) { setError(errorText(err)); }
            }} />}>
        {fields}
      </EditDialog>
    </div>
  );
}
