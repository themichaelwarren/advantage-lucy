import Icon from '../../components/admin/Icon';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom';
import { useVenues, useAreas, useAllEvents, usePrefectures, useCountries, useAllSetlists, useAllSongs } from '../../hooks/useSheetData';
import { prefectureSuggestions } from '../../components/admin/places';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import { Section, Field, BilingualRow, FieldGroup, SaveBar, DeleteButton, EditDialog, useUnsavedWarning, makeId, errorText } from '../../components/admin/ui';
import { resolveArea, areaSuggestions, isKnownArea } from '../../components/admin/VenuePicker';
import SuggestInput, { normalize } from '../../components/admin/SuggestInput';
import { useFitsViewport } from '../../hooks/useFitsViewport';
import { todayInJapan } from '../../utils/showDates';
import { songTitle, compareSongs } from '../../utils/songTitles';
import type { Event } from '../../types';
import { ActivityHistory } from '../../components/admin/Activity';
import { VenueDupeHint, useVenueMatches } from '../../components/admin/DupeHint';
import FormerNames from '../../components/admin/FormerNames';
import { parseFormerNames, formatFormerNames, formerPeriods } from '../../../functions/lib/venueNames';
import { eventToRow } from '../../utils/adminRows';
import AddressDialog, { movedTo } from '../../components/admin/AddressDialog';

interface Form { id: string; name_en: string; name_ja: string; area: string; url: string; former_names: string }
const empty: Form = { id: '', name_en: '', name_ja: '', area: '', url: '', former_names: '' };
const SONGS_SHOWN = 8;

/**
 * A venue, read first: what and where it is on the left (with a map), its
 * shows and the songs played there most on the right. ✎ opens the details
 * in a small window. A new venue is one plain form.
 */
export default function AdminVenueForm() {
  const { id } = useParams<{ id: string }>();
  const { s, locale, prefix } = useAdminT();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const [addrOpen, setAddrOpen] = useState(false);
  const { venues, loading, refresh: refreshVenues } = useVenues();
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
  const { setlists } = useAllSetlists();
  const { songs } = useAllSongs();

  // `areaText` is what's typed in the area box: a name in either language
  const [form, setForm] = useState<Form>(empty);
  const [areaText, setAreaText] = useState('');
  const [baseline, setBaseline] = useState('');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [allSongs, setAllSongs] = useState(false);
  useEffect(() => { setEditing(false); setAllSongs(false); }, [id]);
  const panel = useFitsViewport<HTMLElement>(32);

  const pick = (en?: string, ja?: string) => (locale === 'ja' ? ja || en : en || ja) || '';
  const areaLabel = (areaId: string) => {
    const a = areas.find(x => x.id === areaId);
    return a ? pick(a.name_en, a.name_ja) : areaId;
  };

  useEffect(() => {
    if (isNew) { setBaseline(JSON.stringify([empty, ''])); return; }
    if (loading) return;
    const v = venues.find(x => x.id === id);
    if (!v) return;
    const f = { id: v.id, name_en: v.name_en || '', name_ja: v.name_ja || '', area: v.area || '', url: v.url || '', former_names: v.former_names || '' };
    setForm(f);
    setAreaText(areaLabel(f.area));
    setBaseline(JSON.stringify([f, areaLabel(f.area)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, id, loading, venues, areas.length]);

  const dirty = baseline !== '' && JSON.stringify([form, areaText]) !== baseline;
  const leaveGuard = useUnsavedWarning(dirty, saving);
  const set = (k: keyof Form, v: string) => { setForm(f => ({ ...f, [k]: v })); setNameError(''); };

  // Shows here, newest first; which have a setlist; the songs played here most
  const today = todayInJapan();
  const showsHere = useMemo(
    () => events.filter(e => form.id && e.venue_id === form.id).sort((a, b) => b.date.localeCompare(a.date)),
    [events, form.id],
  );
  const { withSetlist, topSongs } = useMemo(() => {
    const ids = new Set(showsHere.filter(e => (e.end_date || e.date) <= today).map(e => e.id));
    const withSetlist = new Set<string>();
    const count = new Map<string, { title: string; shows: Set<string> }>();
    for (const r of setlists) {
      if (!ids.has(r.event) || !r.song?.trim()) continue;
      withSetlist.add(r.event);
      const k = normalize(r.song);
      const c = count.get(k) || { title: r.song, shows: new Set<string>() };
      c.shows.add(r.event);
      count.set(k, c);
    }
    const byTitle = compareSongs(locale);
    const songBy = new Map(songs.map(x => [normalize(x.title), x]));
    const topSongs = [...count.entries()]
      .map(([k, c]) => ({ song: songBy.get(k), title: c.title, n: c.shows.size }))
      // Most played first; ties in 50音順 by reading (ja) or A–Z by English title (en)
      .sort((a, b) => b.n - a.n || byTitle(a.song || { title: a.title }, b.song || { title: b.title }));
    return { withSetlist, topSongs };
  }, [showsHere, setlists, songs, today, locale]);
  const showName = (e: Event) => pick(e.title_en, e.title_ja);

  const dupes = useVenueMatches(form, venues, isNew ? undefined : form.id);

  // ---- Merge this venue into another (a double, or an old name of it) ----
  const [merge, setMerge] = useState<{ target: string; until: string } | null>(null);
  const mergeTargets = useMemo(() => venues
    .filter(v => v.id !== form.id)
    .sort((a, b) => Number(b.area === form.area) - Number(a.area === form.area) || (pick(a.name_en, a.name_ja)).localeCompare(pick(b.name_en, b.name_ja), locale)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [venues, form.id, form.area, locale]);
  function openMerge() {
    // Renamed the month after its last show, as a first guess
    const last = [...showsHere].sort((a, b) => a.date.localeCompare(b.date)).pop()?.date;
    let until = '';
    if (last) { const d = new Date(`${last.slice(0, 7)}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); until = d.toISOString().slice(0, 7); }
    setError('');
    setMerge({ target: dupes[0]?.venue.id || '', until });
  }
  async function doMerge() {
    if (!merge?.target) return;
    const target = venues.find(v => v.id === merge.target);
    if (!target) return;
    const me = baseline ? (JSON.parse(baseline)[0] as Form) : form;
    setSaving(true); setError('');
    try {
      // 1. Its shows go to the other venue (whole rows: the server rewrites them)
      for (const e of showsHere) await updateRow('Events', e.id, { ...eventToRow(e), venue: target.id });
      // 2. Its names (now and before) become the other venue's former names
      const names = [...parseFormerNames(target.former_names), ...parseFormerNames(me.former_names)];
      if (merge.until) names.push({ until: merge.until, name_en: me.name_en, name_ja: me.name_ja });
      await updateRow('Venues', target.id, {
        id: target.id, name_en: target.name_en || '', name_ja: target.name_ja || '', area: target.area || '', url: target.url || '',
        former_names: formatFormerNames(names),
      });
      // 3. Then it goes
      await deleteRow('Venues', me.id);
      refreshVenues?.();
      navigate(`${prefix}/venues/${target.id}`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function save(): Promise<boolean> {
    if (!form.name_en.trim() && !form.name_ja.trim()) { setNameError(s.venueNameMissing); return false; }
    if (isNew && dupes.length && !window.confirm(s.dupVenueConfirm)) return false;
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
      <FieldGroup title={s.venueName}>
        <BilingualRow>
          <Field label={`${s.venueName} · ${s.english}`} error={nameError}>
            {fid => <input id={fid} value={form.name_en} onChange={e => set('name_en', e.target.value)} />}
          </Field>
          <Field label={`${s.venueName} · ${s.japanese}`}>
            {fid => <input id={fid} lang="ja" value={form.name_ja} onChange={e => set('name_ja', e.target.value)} />}
          </Field>
        </BilingualRow>
        <VenueDupeHint s={s} locale={locale} prefix={prefix} matches={dupes} areas={areas} />
      </FieldGroup>
      <FieldGroup title={s.venueGroupWhere}>
        <Field label={s.area} hint={s.areaHint} s={s}>
          {fid => <SuggestInput id={fid} value={areaText} onChange={setAreaText} suggestions={areaList} newLabel={s.newArea} />}
        </Field>
        {!isKnownArea(areaText, areas) && (
          <Field label={s.prefectureForNewArea} hint={s.prefectureHint} s={s}>
            {fid => <SuggestInput id={fid} value={newAreaPrefecture} onChange={setNewAreaPrefecture} suggestions={prefList} newLabel={s.newPrefecture} />}
          </Field>
        )}
        <Field label={s.venueUrl} s={s}>
          {fid => <input id={fid} type="url" inputMode="url" placeholder="https://" value={form.url} onChange={e => set('url', e.target.value)} />}
        </Field>
      </FieldGroup>
      <FieldGroup title={s.formerTitle}>
        <p className="lu-hint">{s.formerHint}</p>
        <FormerNames s={s} value={form.former_names} onChange={v => set('former_names', v)} />
      </FieldGroup>
    </>
  );

  // An old address (before the id changed) forwards to the new one
  const moved = movedTo(venues, isNew ? undefined : id);
  if (moved) return <Navigate to={`${prefix}/venues/${moved}`} replace />;
  if (!isNew && loading) return <p className="lu-loading">{s.loading}</p>;

  // ---------- A new venue: one plain form ----------
  if (isNew) {
    return (
      <form className="lu-form" onSubmit={e => { e.preventDefault(); save(); }} noValidate>
        {leaveGuard}
        <div className="lu-page-head">
          <div>
            <p className="lu-eyebrow">{s.venuesTitle}</p>
            <h1>{s.newVenue}</h1>
          </div>
        </div>
        <Section title={s.secDetails}>{fields}</Section>
        <SaveBar s={s} saving={saving} savedAt={savedAt} error={error} dirty={dirty} backHref={`${prefix}/venues`} />
      </form>
    );
  }

  if (!venues.some(v => v.id === id)) return <p className="lu-empty">{s.noResults}</p>;

  // ---------- The venue at a glance ----------
  const saved = baseline ? (JSON.parse(baseline)[0] as Form) : form;
  const name = pick(saved.name_en, saved.name_ja);
  const formerNames = parseFormerNames(saved.former_names);
  const other = locale === 'ja' ? saved.name_en : saved.name_ja;
  const area = areas.find(a => a.id === saved.area);
  const pref = area ? prefectures.find(p => p.id === area.prefecture) : undefined;
  const upcoming = showsHere.filter(e => (e.end_date || e.date) >= today).reverse(); // soonest first
  const past = showsHere.filter(e => (e.end_date || e.date) < today);
  const years = past.map(e => e.date.slice(0, 4));
  const span = years.length ? (years[years.length - 1] === years[0] ? years[0] : `${years[years.length - 1]}–${years[0]}`) : '';
  const byYear: [string, Event[]][] = [];
  for (const e of past) {
    const y = e.date.slice(0, 4);
    const g = byYear[byYear.length - 1];
    if (g && g[0] === y) g[1].push(e); else byYear.push([y, [e]]);
  }
  // Map: the Japanese name and place find it best
  const mapQuery = [saved.name_ja || saved.name_en, area?.name_ja || area?.name_en, pref?.name_ja].filter(Boolean).join(' ');
  const maxN = Math.max(1, ...topSongs.map(t => t.n));
  const shownSongs = allSongs ? topSongs : topSongs.slice(0, SONGS_SHOWN);

  const showRow = (e: Event) => (
    <li key={e.id}>
      <Link to={`${prefix}/events/${e.id}`} className="lu-list-row">
        <time>{e.date.slice(5).replace('-', '/')}</time>
        <span className="lu-list-main">
          {showName(e)
            ? <strong>{showName(e)}</strong>
            : e.performers ? <span className="lu-venue-with">{s.venueWith} {e.performers}</span> : <strong>{name}</strong>}
        </span>
        <span className="lu-list-tags">
          {e.status === 'private' && <span className="lu-tag is-muted">{s.hidden}</span>}
          {(e.end_date || e.date) < today && (withSetlist.has(e.id)
            ? <span className="lu-tag is-ok"><Icon name="setlist" /> {s.hasSetlist}</span>
            : <span className="lu-tag is-todo">{s.noSetlist}</span>)}
        </span>
      </Link>
    </li>
  );

  return (
    <div className="lu-song-page lu-venue-page">
      {leaveGuard}
      <div className="lu-song-layout">
        <aside ref={panel.ref} className={`lu-song-side${panel.fits ? ' is-sticky' : ''}`} style={{ top: panel.top }}>
          <div className="lu-song-card">
            <div className="lu-song-card-head">
              <p className="lu-eyebrow"><Link to={`${prefix}/venues`}>← {s.venuesTitle}</Link></p>
              <button type="button" className="lu-icon-btn lu-edit-btn" onClick={() => setEditing(true)} aria-label={s.songEdit} title={s.songEdit}><Icon name="edit" /></button>
            </div>
            <div>
              <h1>{name}</h1>
              {other && normalize(other) !== normalize(name) && <p className="lu-song-alt lu-rel-alt" lang={locale === 'ja' ? 'en' : 'ja'}>{other}</p>}
            </div>
            {formerNames.length > 0 && (
              <p className="lu-venue-former">
                <span className="lu-publish-label">{s.formerly}</span>
                {formerPeriods(formerNames, locale === 'ja' ? '〜' : '–').map((n, i) => (
                  <span key={i}>{pick(n.name_en, n.name_ja)} <small>{n.period}</small></span>
                ))}
              </p>
            )}
            <dl className="lu-song-credits">
              <dt>{s.area}</dt>
              <dd>{area
                ? <><Link to={`${prefix}/areas/${area.id}`}>{pick(area.name_en, area.name_ja)}</Link>{pref && <span className="lu-venue-pref"> · {pick(pref.name_en, pref.name_ja)}</span>}</>
                : <button type="button" className="lu-link-btn" onClick={() => setEditing(true)}>+ {s.area}</button>}</dd>
              <dt>{s.venueWeb}</dt>
              <dd>{saved.url
                ? <a href={saved.url} target="_blank" rel="noopener noreferrer" className="lu-venue-url">{saved.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')} ↗</a>
                : <button type="button" className="lu-link-btn" onClick={() => setEditing(true)}>+ {s.venueWeb}</button>}</dd>
            </dl>
            <ul className="lu-song-stats" aria-label={s.songStats}>
              <li><a className="lu-stat" href="#shows"><strong>{past.length}</strong><span>{s.venueStatShows}</span></a></li>
              <li><span className="lu-stat"><strong>{withSetlist.size}</strong><span>{s.venueStatSetlists}</span></span></li>
              <li><span className="lu-stat"><strong>{topSongs.length}</strong><span>{s.venueStatSongs}</span></span></li>
              {span && <li className="is-wide"><span className="lu-stat"><strong>{span}</strong><span>{s.venueStatYears}</span></span></li>}
            </ul>
            {upcoming[0] && (
              <Link to={`${prefix}/events/${upcoming[0].id}`} className="lu-venue-next">
                <span className="lu-publish-label">{s.venueNext}</span>
                <strong>{upcoming[0].date}</strong>
                <span>{showName(upcoming[0]) || name}</span>
              </Link>
            )}
            <Link to={`/${locale}/venues/${saved.id}`} className="lu-btn lu-btn-quiet lu-song-site">{s.viewOnSite} ↗</Link>
          </div>

          {mapQuery && (
            <div className="lu-song-card lu-venue-map">
              <iframe
                title={s.venueMap}
                src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&hl=${locale}&output=embed`}
                loading="lazy" referrerPolicy="no-referrer-when-downgrade" allow="fullscreen" allowFullScreen
              />
              <a className="lu-hint" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noopener noreferrer">{s.venueMapOpen} ↗</a>
            </div>
          )}
        </aside>

        <div className="lu-song-main">
          {upcoming.length > 0 && (
            <Section title={`${s.upcoming} · ${upcoming.length}`}>
              <ul className="lu-list lu-usage lu-compact">{upcoming.map(showRow)}</ul>
            </Section>
          )}

          {topSongs.length > 0 && (
            <Section title={s.venueTopSongs}>
              <ol className="lu-tracks">
                {shownSongs.map((t, i) => (
                  <li key={t.title} className="lu-track">
                    <span className="lu-track-n">{i + 1}</span>
                    <span className="lu-track-main">
                      {t.song ? <Link to={`${prefix}/songs/${t.song.id}`} className="lu-track-title">{songTitle(t.song, locale)}</Link> : <span className="lu-track-title">{t.title}</span>}
                    </span>
                    <span className="lu-track-plays" title={s.relTrackPlays.replace('{n}', String(t.n))}>
                      <span className="lu-rel-bar" style={{ ['--p' as string]: `${(t.n / maxN) * 100}%` }} />
                      <span className="lu-track-count">{t.n}</span>
                    </span>
                  </li>
                ))}
              </ol>
              {topSongs.length > SONGS_SHOWN && (
                <button type="button" className="lu-link-btn" onClick={() => setAllSongs(v => !v)}>
                  {allSongs ? s.lyricsLess : s.venueAllSongs.replace('{n}', String(topSongs.length))}
                </button>
              )}
            </Section>
          )}

          <Section title={`${s.showsAtVenue} · ${past.length}`} id="shows">
            {past.length === 0 ? <p className="lu-hint">{s.noShowsAtVenue}</p> : (
              <div className="lu-song-history">
                {byYear.map(([year, list]) => (
                  <div key={year} className="lu-song-year">
                    <h3>{year}</h3>
                    <ul className="lu-list lu-usage lu-compact">{list.map(showRow)}</ul>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <div className="lu-history-wrap"><ActivityHistory s={s} locale={locale} refs={[`Venues:${id}`]} /></div>
        </div>
      </div>

      <AddressDialog s={s} kind="venue" id={form.id} open={addrOpen} onClose={() => setAddrOpen(false)} />
      <EditDialog s={s} title={s.secDetails} open={editing} saving={saving} error={error} dirty={dirty}
        onSave={() => { save().then(ok => { if (ok) setEditing(false); }); }}
        onClose={() => {
          if (dirty && !window.confirm(s.songDiscard)) return;
          if (baseline) { const [f, t] = JSON.parse(baseline) as [Form, string]; setForm(f); setAreaText(t); }
          setNameError(''); setError(''); setEditing(false);
        }}
        footer={<span className="lu-row">
          <button type="button" className="lu-btn" onClick={() => { setEditing(false); setAddrOpen(true); }}>{s.addrButton}</button>
          <button type="button" className="lu-btn" onClick={() => { if (dirty && !window.confirm(s.songDiscard)) return; setEditing(false); openMerge(); }}>{s.mergeButton}</button>
          {showsHere.length > 0
            ? <span className="lu-hint">{s.inUseCantDelete}</span>
            : <DeleteButton s={s} onConfirm={async () => {
                try { await deleteRow('Venues', form.id); navigate(`${prefix}/venues`); }
                catch (err) { setError(errorText(err)); }
              }} />}
        </span>}
      >
        {fields}
      </EditDialog>

      <EditDialog s={s} title={s.mergeTitle} open={merge !== null} saving={saving} error={error} dirty={!!merge?.target}
        onClose={() => { setMerge(null); setError(''); }}
        onSave={doMerge} saveLabel={s.mergeGo}>
        {merge && (
          <>
            <p className="lu-hint">{s.mergeIntro}</p>
            <Field label={s.mergeInto}>
              {fid => (
                <select id={fid} value={merge.target} onChange={e => setMerge(m => m && { ...m, target: e.target.value })}>
                  <option value="">{s.mergePick}</option>
                  {mergeTargets.map(v => <option key={v.id} value={v.id}>{pick(v.name_en, v.name_ja)}{v.area ? ` · ${areaLabel(v.area)}` : ''}</option>)}
                </select>
              )}
            </Field>
            <Field label={s.mergeUntil} hint={s.mergeUntilHint.replace('{name}', name)}>
              {fid => <input id={fid} type="month" value={merge.until} onChange={e => setMerge(m => m && { ...m, until: e.target.value })} />}
            </Field>
            {merge.target && (
              <p className="lu-dupe is-soft">{s.mergeWhat
                .replace('{n}', String(showsHere.length))
                .replace('{target}', pick(venues.find(v => v.id === merge.target)?.name_en, venues.find(v => v.id === merge.target)?.name_ja))
                .replace('{name}', name)}</p>
            )}
          </>
        )}
      </EditDialog>
    </div>
  );
}
