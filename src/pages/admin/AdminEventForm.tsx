import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAllEvents, useVenues, useAreas, useAllSetlists, useSongs } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow, replaceRows, getMedia, saveMedia, getReservations, type MediaRow, getVideoTitle } from '../../services/adminService';
import ShowVideos, { toShowVideos, fromShowVideos, videosSnapshot, songSlots, newVideo, type ShowVideo } from '../../components/admin/ShowVideos';
import { useAdminT } from '../../i18n/admin';
import {
  Section, Field, FieldGroup, BilingualRow, Switch, SaveBar, ImageField, DeleteButton, EditDialog, LockHint,
  useUnsavedWarning, makeId, errorText,
} from '../../components/admin/ui';
import { useFitsViewport } from '../../hooks/useFitsViewport';
import { formatPrice } from '../../utils/format';
import { linkify } from '../../utils/linkify';
import VenuePicker from '../../components/admin/VenuePicker';
import LinkTextarea from '../../components/admin/LinkTextarea';
import { setlistIsPublic, todayInJapan, normDateTime } from '../../utils/showDates';
import { showDateTime } from '../../components/admin/PublishControl';

/** "2026-11-29" → "2026-11-30" */
const dayAfter = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
import { EVENT_COLUMNS, eventToRow } from '../../utils/adminRows';
import SetlistEditor, { newItem, type SetlistItem } from '../../components/admin/SetlistEditor';
import { addMissingSongs } from '../../components/admin/songs';
import { normalize } from '../../components/admin/SuggestInput';
import AddedSongs from '../../components/admin/AddedSongs';
import type { Song } from '../../types';
import TimestampPaste from '../../components/admin/TimestampPaste';
import { matchSong, type PastedSong } from '../../utils/timestamps';
import { youTubeId } from '../../utils/youtube';

type EventField = typeof EVENT_COLUMNS[number];
type Form = Record<EventField, string>;

function emptyForm(): Form {
  const f = Object.fromEntries(EVENT_COLUMNS.map(c => [c, ''])) as Form;
  f.status = 'published';
  f.performers = 'advantage Lucy';
  return f;
}

export default function AdminEventForm() {
  const { id } = useParams<{ id: string }>();
  const { s, locale, prefix } = useAdminT();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const { events, loading } = useAllEvents();
  const { venues, refresh: refreshVenues } = useVenues();
  const { areas, refresh: refreshAreas } = useAreas();
  const { setlists } = useAllSetlists();
  const { songs, refresh: refreshSongs } = useSongs();
  const [addedSongs, setAddedSongs] = useState<Song[]>([]);

  const [form, setForm] = useState<Form>(emptyForm);
  const [setlist, setSetlist] = useState<SetlistItem[]>([]);
  // Videos (admin only, private Media tab): loaded once, saved with the show
  const [media, setMedia] = useState<MediaRow[] | null>(null);
  const [videos, setVideos] = useState<ShowVideo[]>([]);
  const [videosBaseline, setVideosBaseline] = useState('[]');
  useEffect(() => { getMedia().then(setMedia).catch(() => setMedia([])); }, []);
  const [errors, setErrors] = useState<Partial<Record<EventField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  // What's saved, to tell what changed: the show's fields, its setlist, its videos
  const [formBase, setFormBase] = useState('');
  const [setlistBase, setSetlistBase] = useState<SetlistItem[]>([]);
  const setlistKey = (sl: SetlistItem[]) => JSON.stringify(sl.filter(r => r.song.trim()).map(({ song, set, notes }) => [song, set, notes]));

  // Load an existing show and its setlist
  useEffect(() => {
    if (isNew) { setFormBase(JSON.stringify(emptyForm())); return; }
    if (loading) return;
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    const f: Form = eventToRow(ev);
    const sl = setlists
      .filter(x => x.event === ev.id)
      .sort((a, b) => a.set.localeCompare(b.set, undefined, { numeric: true }) || a.order - b.order)
      .map(x => ({ ...newItem(x.set, x.song), notes: x.notes || '', status: x.status || 'published' }));
    setForm(f);
    setFormBase(JSON.stringify(f));
    setSetlist(sl);
    setSetlistBase(sl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, id, loading, events, setlists]);
  const baseline = formBase;

  // The show's videos, once both it and the Media tab have loaded (once per show,
  // so saving doesn't reload what's on screen)
  const videosFor = useRef('');
  useEffect(() => {
    if (isNew || !media || !baseline || !id || videosFor.current === id) return;
    videosFor.current = id;
    const v = toShowVideos(media, id, setlist);
    setVideos(v);
    setVideosBaseline(videosSnapshot(v, setlist));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, media, baseline, id]);

  // Read first: the setlist has its own editor; the rest edit in small windows
  const [dialog, setDialog] = useState<null | 'details' | 'tickets' | 'notes' | 'poster'>(null);
  const [setlistEditing, setSetlistEditing] = useState(isNew);
  const [videosEditing, setVideosEditing] = useState(false);
  useEffect(() => { setDialog(null); setSetlistEditing(isNew); setVideosEditing(false); }, [id, isNew]);
  const panel = useFitsViewport<HTMLElement>(32);

  // Arriving from "Add a setlist": open the setlist editor once the show has loaded
  const location = useLocation();
  useEffect(() => {
    if (location.hash === '#setlist' && baseline) {
      setSetlistEditing(true);
      window.setTimeout(() => document.getElementById('setlist')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }, [location.hash, baseline]);

  const formDirty = baseline !== '' && JSON.stringify(form) !== baseline;
  const setlistDirty = setlistKey(setlist) !== setlistKey(setlistBase);
  const videosChanged = videosSnapshot(videos, setlist) !== videosBaseline;
  const dirty = formDirty || setlistDirty || videosChanged;
  const leaveGuard = useUnsavedWarning(dirty, saving);

  const set = (field: EventField, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
  };

  const songTitles = useMemo(() => songs.map(x => x.title).filter(Boolean).sort(), [songs]);
  const songHref = useMemo(() => {
    const m = new Map(songs.filter(x => x.title).map(x => [normalize(x.title), x.id]));
    return (title: string) => { const id = m.get(normalize(title)); return id ? `${prefix}/songs/${id}` : undefined; };
  }, [songs, prefix]);
  const songCover = useMemo(() => {
    const m = new Map(songs.filter(x => x.title && x.original_artist).map(x => [normalize(x.title), x.original_artist as string]));
    return (title: string) => m.get(normalize(title));
  }, [songs]);

  /** e.g. 2025-11-30-tokyo, like the existing IDs (date + prefecture). */
  function newEventId(): string {
    const venue = venues.find(v => v.id === form.venue);
    const area = areas.find(a => a.id === venue?.area);
    const place = area?.prefecture || area?.id || '';
    return makeId([form.date, place], new Set(events.map(e => e.id)));
  }

  function checkRequired(): boolean {
    const problems: Partial<Record<EventField, string>> = {};
    if (!form.date) problems.date = s.dateMissing;
    if (!form.venue) problems.venue = s.venueMissing;
    setErrors(problems);
    if (Object.keys(problems).length) {
      document.querySelector('.lu-field.has-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }

  /** The show's own row (Events). */
  async function writeEvent(eventId: string, extra: Partial<Form> = {}) {
    const fields = { ...form, ...extra, id: eventId };
    if (isNew) await createRow('Events', fields);
    else await updateRow('Events', eventId, fields);
    setForm(fields);
    setFormBase(JSON.stringify(fields));
    return fields;
  }

  /** The setlist: new titles go into Songs; the order on screen becomes the order numbers. */
  async function writeSetlist(eventId: string) {
    const filled = setlist.filter(r => r.song.trim());
    const { added, canonical } = await addMissingSongs(filled.map(r => r.song), songs);
    const cleaned = setlist.filter(r => r.song.trim()).map(r => ({ ...r, song: canonical(r.song) }));
    const counters: Record<string, number> = {};
    const rows = cleaned.map(r => {
      counters[r.set] = (counters[r.set] || 0) + 1;
      return { event: eventId, song: r.song, set: r.set, order: String(counters[r.set]), notes: r.notes, status: r.status };
    });
    const hadSetlist = setlists.some(x => x.event === eventId) || setlistBase.length > 0;
    if (rows.length || hadSetlist) await replaceRows('Setlists', eventId, rows);
    if (added.length) { setAddedSongs(added); refreshSongs(); }
    setSetlist(cleaned);
    setSetlistBase(cleaned);
    return cleaned;
  }

  async function writeVideos(eventId: string, sl: SetlistItem[]) {
    const saved = await saveMedia(eventId, fromShowVideos(videos, sl));
    setMedia(m => [...(m || []).filter(r => r.owner !== eventId), ...saved]);
    setVideosBaseline(videosSnapshot(videos, sl));
  }

  /** Runs one save with the shared saving/error state; true if it worked. */
  async function run(task: () => Promise<unknown>): Promise<boolean> {
    setSaving(true);
    setError('');
    try {
      await task();
      setSavedAt(Date.now());
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  // A new show: everything at once
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checkRequired()) return;
    const eventId = newEventId();
    await run(async () => {
      // A setlist entered with the show: note the day it was added
      await writeEvent(eventId, setlist.some(r => r.song.trim()) ? { setlist_added: todayInJapan() } : {});
      const sl = await writeSetlist(eventId);
      if (videosChanged) await writeVideos(eventId, sl);
      navigate(`${prefix}/events/${eventId}`, { replace: true });
    });
  }

  // An existing show: one part at a time
  const saveDialog = async () => {
    if (!checkRequired()) return;
    if (await run(() => writeEvent(form.id))) setDialog(null);
  };
  const closeDialog = () => {
    if (formDirty && !window.confirm(s.songDiscard)) return;
    if (baseline) setForm(JSON.parse(baseline) as Form);
    setErrors({});
    setError('');
    setDialog(null);
  };
  const saveSetlist = async () => {
    const ok = await run(async () => {
      // When the setlist goes public (and where it was found) is part of the show's row;
      // so is the day it was first entered
      const first = setlistBase.length === 0 && setlist.some(r => r.song.trim()) && !form.setlist_added;
      if (formDirty || first) await writeEvent(form.id, first ? { setlist_added: todayInJapan() } : {});
      const sl = await writeSetlist(form.id);
      if (videosChanged) await writeVideos(form.id, sl);
    });
    if (ok) setSetlistEditing(false);
  };
  const cancelSetlist = () => {
    if ((setlistDirty || formDirty || videosChanged) && !window.confirm(s.songDiscard)) return;
    setSetlist(setlistBase);
    if (baseline) setForm(JSON.parse(baseline) as Form);
    // Times marked while editing the setlist are discarded with it
    if (!isNew && id) setVideos(toShowVideos(media || [], id, setlistBase));
    setSetlistEditing(false);
  };

  // Reservations so far (when the show takes them)
  const [booked, setBooked] = useState<number | null>(null);
  useEffect(() => {
    if (isNew || form.reserve !== 'TRUE' || !id) { setBooked(null); return; }
    getReservations()
      .then(list => setBooked(list.filter(r => r.event === id && r.status !== 'cancelled').reduce((n, r) => n + (parseInt(String(r.tickets), 10) || 0), 0)))
      .catch(() => setBooked(null));
  }, [isNew, id, form.reserve]);

  if (!isNew && loading) return <p className="lu-loading">{s.loading}</p>;

  // ---------- The edit fields, for the new-show form and the edit windows ----------
  const whenWhereFields = (
    <>
      <div className="lu-grid-2">
        <Field label={s.date} error={errors.date} required s={s}>
          {fid => <input id={fid} type="date" value={form.date} onChange={e => set('date', e.target.value)} />}
        </Field>
        <Field label={s.endDate} hint={s.endDateHint} optional s={s}>
          {fid => <input id={fid} type="date" value={form.end_date} min={form.date} onChange={e => set('end_date', e.target.value)} />}
        </Field>
      </div>
      <Field label={s.venue} error={errors.venue} required s={s}>
        {fid => (
          <VenuePicker
            s={s} locale={locale} id={fid}
            value={form.venue}
            onChange={v => set('venue', v)}
            venues={venues} areas={areas}
            onCreated={() => { refreshVenues(); refreshAreas(); }}
            onError={setError}
          />
        )}
      </Field>
      <div className="lu-grid-3">
        <Field label={s.doors} optional s={s}>
          {fid => <input id={fid} type="time" value={form.doors} onChange={e => set('doors', e.target.value)} />}
        </Field>
        <Field label={s.start} optional s={s}>
          {fid => <input id={fid} type="time" value={form.start} onChange={e => set('start', e.target.value)} />}
        </Field>
        <Field label={s.end} optional s={s}>
          {fid => <input id={fid} type="time" value={form.end} onChange={e => set('end', e.target.value)} />}
        </Field>
      </div>
    </>
  );
  const aboutFields = (
    <>
      <BilingualRow>
        <Field label={`${s.showTitle} · ${s.english}`} hint={s.showTitleHint} optional s={s}>
          {fid => <input id={fid} value={form.title_en} onChange={e => set('title_en', e.target.value)} />}
        </Field>
        <Field label={`${s.showTitle} · ${s.japanese}`} optional s={s}>
          {fid => <input id={fid} lang="ja" value={form.title_ja} onChange={e => set('title_ja', e.target.value)} />}
        </Field>
      </BilingualRow>
      <Field label={s.performers} hint={s.performersHint} optional s={s}>
        {fid => <input id={fid} value={form.performers} onChange={e => set('performers', e.target.value)} />}
      </Field>
    </>
  );
  const notesFields = (
    <>
      <p className="lu-hint">{s.bothLanguagesHint}</p>
      <Field label={`${s.description} · ${s.english}`} hint={s.notesHint} optional s={s}>
        {fid => <LinkTextarea s={s} id={fid} className="lu-textarea-long" rows={6} value={form.body_en} onChange={v => set('body_en', v)} />}
      </Field>
      <Field label={`${s.description} · ${s.japanese}`} optional s={s}>
        {fid => <LinkTextarea s={s} id={fid} className="lu-textarea-long" rows={6} lang="ja" value={form.body_ja} onChange={v => set('body_ja', v)} />}
      </Field>
    </>
  );
  const visibilityFields = (
    <>
      <Switch checked={form.status !== 'private'} onChange={v => set('status', v ? 'published' : 'private')} label={s.visible} hint={s.visibleHint} />
      <Switch checked={form.featured === 'TRUE'} onChange={v => set('featured', v ? 'TRUE' : '')} label={s.featured} hint={s.featuredHint} />
    </>
  );
  const ticketFields = (
    <>
      <div className="lu-grid-2">
        <Field label={s.advPrice} optional s={s}>
          {fid => <input id={fid} value={form.adv_price} placeholder={s.pricePlaceholder} onChange={e => set('adv_price', e.target.value)} />}
        </Field>
        <Field label={s.doorPrice} optional s={s}>
          {fid => <input id={fid} value={form.door_price} placeholder={s.pricePlaceholder} onChange={e => set('door_price', e.target.value)} />}
        </Field>
      </div>
      <Field label={s.ticketUrl} optional s={s}>
        {fid => <input id={fid} type="url" inputMode="url" value={form.ticket_url} placeholder="https://" onChange={e => set('ticket_url', e.target.value)} />}
      </Field>
      <div className="lu-reserve-settings">
        <Switch checked={form.reserve === 'TRUE'} onChange={v => set('reserve', v ? 'TRUE' : '')} label={s.reserveOn} hint={s.reserveOnHint} />
        {form.reserve === 'TRUE' && (
          <div className="lu-grid-3">
            <Field label={s.reserveCap} hint={s.reserveCapHint} optional s={s}>
              {fid => <input id={fid} type="number" inputMode="numeric" min={1} value={form.reserve_cap} onChange={e => set('reserve_cap', e.target.value)} />}
            </Field>
            <Field label={s.reserveMax} hint={s.reserveMaxHint} optional s={s}>
              {fid => <input id={fid} type="number" inputMode="numeric" min={1} max={20} value={form.reserve_max} placeholder="4" onChange={e => set('reserve_max', e.target.value)} />}
            </Field>
            <Field label={s.reserveUntil} hint={s.reserveUntilHint} optional s={s}>
              {fid => <input id={fid} type="datetime-local" value={normDateTime(form.reserve_until)} onChange={e => set('reserve_until', e.target.value)} />}
            </Field>
          </div>
        )}
      </div>
    </>
  );
  const setlistPublic = form.date ? setlistIsPublic({ date: form.date, end_date: form.end_date, setlist_at: form.setlist_at }) : false;
  const setlistState = form.date && (
    <p className={`lu-hint lu-publish-state${setlistPublic ? '' : ' is-locked'}`}>
      {setlistPublic
        ? s.setlistPublicNow
        : form.setlist_at
          ? `🔒 ${s.setlistAtHint.replace('{at}', showDateTime(form.setlist_at))}`
          : `🔒 ${s.setlistDefaultHint.replace('{at}', `${dayAfter(form.end_date || form.date)} 00:00`)}`}
    </p>
  );
  const setlistTiming = (
    <div className="lu-publish">
      <p className="lu-publish-label">{s.setlistGoesLive}</p>
      <div className="lu-chips" role="radiogroup" aria-label={s.setlistGoesLive}>
        <button type="button" role="radio" aria-checked={!form.setlist_at} className={`lu-pill${!form.setlist_at ? ' is-on' : ''}`} onClick={() => set('setlist_at', '')}>{s.setlistDayAfter}</button>
        <button type="button" role="radio" aria-checked={!!form.setlist_at} className={`lu-pill${form.setlist_at ? ' is-on' : ''}`}
          onClick={() => set('setlist_at', form.setlist_at || `${form.date || todayInJapan()}T21:00`)}>{s.goLiveLater}</button>
      </div>
      {form.setlist_at && (
        <label className="lu-publish-when">
          <input type="datetime-local" value={normDateTime(form.setlist_at)} onChange={e => set('setlist_at', e.target.value)} aria-label={s.goLiveLater} />
          <span className="lu-hint">{s.japanTime}</span>
        </label>
      )}
      {setlistState}
    </div>
  );
  /**
   * A video description pasted into the setlist editor: becomes the setlist
   * (asking first if there is one), and with the video's link, the video is
   * added with every song marked. Saved with the setlist's Save.
   */
  function pasteSetlist(lines: PastedSong[], link: string): string {
    if (setlist.some(r => r.song.trim()) && !window.confirm(s.pasteReplaceConfirm)) return '';
    const items = lines.map(l => newItem('1', matchSong(l.title, songs)?.title || l.title));
    setSetlist(items);
    const slots = songSlots(items);
    const timed = lines.some(l => l.start !== null);
    if (link && youTubeId(link)) {
      const starts: Record<string, number> = {};
      items.forEach((it, i) => { const t = lines[i].start; if (t !== null) starts[slots[it.key]] = t; });
      const vid = youTubeId(link);
      setVideos(vs => {
        const have = vs.find(x => youTubeId(x.url) === vid);
        if (have) return vs.map(x => (x === have ? { ...x, starts: { ...x.starts, ...starts } } : x));
        return [...vs.filter(x => x.url.trim()), { ...newVideo(link), starts }];
      });
      getVideoTitle(link).then(t => { if (t) setVideos(vs => vs.map(x => (youTubeId(x.url) === vid && !x.title ? { ...x, title: t } : x))); });
      if (!form.setlist_source) set('setlist_source', link);
    }
    const unknown = items.filter(it => !songs.some(x => normalize(x.title) === normalize(it.song))).length;
    return [
      s.viPasteDone.replace('{n}', String(items.length)),
      link && timed ? s.pasteWithVideo : timed ? s.pasteTimesNeedLink : '',
      unknown ? s.viNewSongsNote.replace('{n}', String(unknown)) : '',
    ].filter(Boolean).join(' ');
  }

  const setlistEditor = (
    <>
      {setlistTiming}
      <label className="lu-field lu-setlist-source">
        <span>{s.setlistSource} <span className="lu-optional">· 🔒 {s.setlistSourcePrivate}</span></span>
        <input value={form.setlist_source} onChange={e => set('setlist_source', e.target.value)} placeholder={s.setlistSourceHint} />
      </label>
      <TimestampPaste s={s} label={s.pasteSetlist} withLink onRead={pasteSetlist} />
      <SetlistEditor s={s} items={setlist} onChange={setSetlist} songTitles={songTitles} songHref={songHref} songCover={songCover} />
      <AddedSongs s={s} songs={addedSongs} prefix={prefix} onClose={() => setAddedSongs([])} />
    </>
  );

  // ---------- A new show: the plain form ----------
  if (isNew) {
    return (
      <form className="lu-form" onSubmit={handleSubmit} noValidate>
        {leaveGuard}
        <div className="lu-page-head">
          <div>
            <p className="lu-eyebrow">{s.shows}</p>
            <h1>{s.newShow}</h1>
          </div>
        </div>
        <Section title={s.secWhenWhere}>{whenWhereFields}</Section>
        <Section title={s.secAbout}>{aboutFields}{notesFields}</Section>
        <Section title={s.secSetlist} id="setlist">{setlistEditor}</Section>
        <Section title={s.secTickets}>{ticketFields}</Section>
        <Section title={s.secPoster}><ImageField s={s} value={form.poster_url} onChange={v => set('poster_url', v)} onError={setError} /></Section>
        <Section title={s.visible}>{visibilityFields}</Section>
        <SaveBar s={s} saving={saving} savedAt={savedAt} error={error} dirty={dirty} backHref={`${prefix}/events`} />
      </form>
    );
  }

  // ---------- The show at a glance ----------
  const saved = (baseline ? JSON.parse(baseline) : form) as Form;
  const pick = (en?: string, ja?: string) => (locale === 'ja' ? ja || en : en || ja) || '';
  const venue = venues.find(v => v.id === saved.venue);
  const area = venue ? areas.find(a => a.id === venue.area) : undefined;
  const venueName = venue ? pick(venue.name_en, venue.name_ja) : saved.venue;
  const areaName = area ? pick(area.name_en, area.name_ja) : '';
  const title = pick(saved.title_en, saved.title_ja);
  const weekday = saved.date
    ? new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${saved.date}T00:00:00Z`))
    : '';
  const isPast = (saved.end_date || saved.date) < todayInJapan();
  const times = [
    saved.doors && `${s.doors} ${saved.doors}`,
    saved.start && `${s.start} ${saved.start}`,
    saved.end && `${s.end} ${saved.end}`,
  ].filter(Boolean).join(' / ');
  const prices = [
    saved.adv_price && `${s.advPrice} ${formatPrice(saved.adv_price, locale)}`,
    saved.door_price && `${s.doorPrice} ${formatPrice(saved.door_price, locale)}`,
  ].filter(Boolean);
  const notes = pick(saved.body_en, saved.body_ja);
  const editBtn = (which: 'details' | 'tickets' | 'notes' | 'poster') => (
    <button type="button" className="lu-icon-btn lu-edit-btn" onClick={() => setDialog(which)} aria-label={s.songEdit} title={s.songEdit}>✎</button>
  );
  const setLabel = (set: string) => set === 'e' ? s.encore : set.startsWith('e') ? `${s.encore} ${set.slice(1)}` : `${s.set} ${set}`;
  const sets = [...new Set(setlistBase.map(r => r.set))];

  return (
    <div className="lu-song-page lu-show-page">
      {leaveGuard}
      <div className="lu-song-layout">
        {/* Left: the show itself, tickets and flyer (stays in view while it fits) */}
        <aside ref={panel.ref} className={`lu-song-side${panel.fits ? ' is-sticky' : ''}`} style={{ top: panel.top }}>
          <div className="lu-song-card">
            <div className="lu-song-card-head">
              <p className="lu-eyebrow"><Link to={`${prefix}/events`}>← {s.shows}</Link></p>
              {editBtn('details')}
            </div>
            <p className="lu-show-date">
              <strong>{saved.date.replace(/-/g, '.')}</strong>
              {weekday && <span className="lu-tag">{weekday}</span>}
              {saved.end_date && saved.end_date !== saved.date && <span className="lu-hint">〜 {saved.end_date.replace(/-/g, '.')}</span>}
            </p>
            <h1>{title || venueName}</h1>
            <dl className="lu-song-credits">
              <dt>{s.venue}</dt>
              <dd>{venue ? <Link to={`${prefix}/venues/${venue.id}`}>{venueName}</Link> : venueName}{areaName && <span className="lu-hint"> · {areaName}</span>}</dd>
              {times && (<><dt>{s.showTimes}</dt><dd>{times}</dd></>)}
              {saved.performers && (<><dt>{s.performers}</dt><dd>{saved.performers}</dd></>)}
            </dl>
            {(saved.status === 'private' || saved.featured === 'TRUE') && (
              <p className="lu-row">
                {saved.status === 'private' && <span className="lu-tag is-muted">{s.hidden}</span>}
                {saved.featured === 'TRUE' && <span className="lu-tag is-ok">{s.featured}</span>}
              </p>
            )}
            <Link to={`/${locale}/events/${saved.id}`} className="lu-btn lu-btn-quiet lu-song-site">{s.viewOnSite} ↗</Link>
          </div>

          <div className="lu-song-card">
            <div className="lu-song-card-head">
              <p className="lu-publish-label">{s.secTickets}</p>
              {editBtn('tickets')}
            </div>
            {prices.length === 0 && !saved.ticket_url && saved.reserve !== 'TRUE' && <p className="lu-hint">{s.ticketsNone}</p>}
            {prices.length > 0 && <p className="lu-show-line">{prices.join(' / ')}</p>}
            {saved.ticket_url && <a className="lu-show-line" href={saved.ticket_url} target="_blank" rel="noopener noreferrer">{s.ticketUrl} ↗</a>}
            {saved.reserve === 'TRUE' && (
              <Link to={`${prefix}/reservations/${saved.id}`} className="lu-show-resv">
                🎫 <strong>{booked ?? '…'}{saved.reserve_cap ? ` / ${saved.reserve_cap}` : ''}</strong> {s.resvTicketsShort}
                <span className="lu-hint"> · {s.openReservations} →</span>
              </Link>
            )}
          </div>

          <div className="lu-song-card">
            <div className="lu-song-card-head">
              <p className="lu-publish-label">{s.secPoster}</p>
              {editBtn('poster')}
            </div>
            {saved.poster_url
              ? <a href={saved.poster_url} target="_blank" rel="noopener noreferrer" className="lu-show-flyer"><img src={saved.poster_url} alt="" loading="lazy" /></a>
              : <p className="lu-hint">{s.posterNone}</p>}
          </div>
        </aside>

        {/* Right: setlist, videos, notes */}
        <div className="lu-song-main">
          <Section
            title={`${s.secSetlist}${setlistBase.length ? ` · ${setlistBase.length}` : ''}`}
            id="setlist"
            aside={!setlistEditing && setlistBase.length > 0 ? <button type="button" className="lu-icon-btn lu-edit-btn" onClick={() => setSetlistEditing(true)} aria-label={s.songEdit} title={s.songEdit}>✎</button> : undefined}
          >
            {setlistEditing ? (
              <>
                {setlistEditor}
                <div className="lu-row lu-section-actions">
                  {error && <span className="lu-field-error">{s.errorPrefix} {error}</span>}
                  <button type="button" className="lu-btn" onClick={cancelSetlist} disabled={saving}>{s.cancel}</button>
                  <button type="button" className="lu-btn lu-btn-primary" onClick={saveSetlist} disabled={saving || (!setlistDirty && !formDirty && !videosChanged)}>{saving ? s.saving : s.save}</button>
                </div>
              </>
            ) : setlistBase.length === 0 ? (
              <div className="lu-row lu-videos-empty">
                <span className="lu-hint">{isPast ? s.setlistMissing : s.setlistLater}</span>
                <button type="button" className="lu-btn lu-btn-primary" onClick={() => setSetlistEditing(true)}>+ {s.setlistEnter}</button>
              </div>
            ) : (
              <>
                {setlistState}
                {(form.setlist_source || form.setlist_added) && (
                  <p className="lu-hint lu-setlist-meta">
                    {form.setlist_source && <span>🔒 {s.setlistSource}: {linkify(form.setlist_source)}</span>}
                    {form.setlist_added && <span>{s.setlistAddedOn.replace('{date}', form.setlist_added)}</span>}
                  </p>
                )}
                <div className="lu-show-setlist">
                  {sets.map(set => (
                    <div key={set}>
                      {sets.length > 1 && <h3>{setLabel(set)}</h3>}
                      <ol>
                        {setlistBase.filter(r => r.set === set).map(r => {
                          const href = songHref(r.song);
                          const cover = songCover(r.song);
                          return (
                            <li key={r.key}>
                              {href ? <Link to={href}>{r.song}</Link> : <span className="is-unlinked" title={s.needsLookHint}>{r.song}</span>}
                              {cover && <span className="lu-tag lu-cover-tag">{s.coverTag}</span>}
                              {r.notes && <span className="lu-hint"> （{r.notes}）</span>}
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Section>

          <Section
            title={`${s.secVideos}${videos.filter(v => v.url.trim()).length ? ` · ${videos.filter(v => v.url.trim()).length}` : ''}`}
            id="videos"
            badge={<LockHint text={s.videosPrivate} />}
            aside={!videosEditing && !setlistEditing && videos.length > 0
              ? <button type="button" className="lu-icon-btn lu-edit-btn" onClick={() => setVideosEditing(true)} aria-label={s.songEdit} title={s.songEdit}>✎</button>
              : undefined}
          >
            {/* Watching by default; ✎ to change links and times (saved or cancelled here) */}
            <ShowVideos s={s} knownSongs={songs} videos={videos} onChange={setVideos} setlist={setlistEditing ? setlist : setlistBase} editing={videosEditing || setlistEditing} />
            {!videosEditing && !setlistEditing && videos.length === 0 && (
              <div className="lu-vfoot">
                <button type="button" className="lu-link-btn" onClick={() => { setVideosEditing(true); }}>+ {s.videoAdd}</button>
              </div>
            )}
            {videosEditing && !setlistEditing && (
              <div className="lu-row lu-section-actions">
                {error && <span className="lu-field-error">{s.errorPrefix} {error}</span>}
                <button type="button" className="lu-btn" disabled={saving}
                  onClick={() => {
                    if (videosChanged && !window.confirm(s.songDiscard)) return;
                    setVideos(toShowVideos(media || [], saved.id, setlistBase));
                    setVideosEditing(false);
                  }}>{s.cancel}</button>
                <button type="button" className="lu-btn lu-btn-primary" disabled={saving || !videosChanged}
                  onClick={async () => { if (await run(() => writeVideos(saved.id, setlistBase))) setVideosEditing(false); }}>{saving ? s.saving : s.save}</button>
              </div>
            )}
          </Section>

          <Section title={s.description} aside={editBtn('notes')}>
            {notes
              ? <div className="event-notes lu-show-notes">{notes.split(/\n\s*\n/).map((para, i) => <p key={i}>{linkify(para.trim())}</p>)}</div>
              : <p className="lu-hint">{s.notesNone}</p>}
          </Section>
        </div>
      </div>

      <EditDialog s={s} title={s.secDetails} open={dialog === 'details'} onClose={closeDialog} onSave={saveDialog} saving={saving} error={error} dirty={formDirty}
        footer={<DeleteButton s={s} onConfirm={async () => {
          try {
            if (setlists.some(x => x.event === form.id)) await replaceRows('Setlists', form.id, []);
            await deleteRow('Events', form.id);
            navigate(`${prefix}/events`);
          } catch (err) { setError(errorText(err)); }
        }} />}
      >
        <FieldGroup title={s.groupWhen}>{whenWhereFields}</FieldGroup>
        <FieldGroup title={s.groupShow}>{aboutFields}</FieldGroup>
        <FieldGroup title={s.groupVisibility}>{visibilityFields}</FieldGroup>
      </EditDialog>
      <EditDialog s={s} title={s.secTickets} open={dialog === 'tickets'} onClose={closeDialog} onSave={saveDialog} saving={saving} error={error} dirty={formDirty}>
        {ticketFields}
      </EditDialog>
      <EditDialog s={s} title={s.description} open={dialog === 'notes'} onClose={closeDialog} onSave={saveDialog} saving={saving} error={error} dirty={formDirty}>
        {notesFields}
      </EditDialog>
      <EditDialog s={s} title={s.secPoster} open={dialog === 'poster'} onClose={closeDialog} onSave={saveDialog} saving={saving} error={error} dirty={formDirty}>
        <ImageField s={s} value={form.poster_url} onChange={v => set('poster_url', v)} onError={setError} />
      </EditDialog>
    </div>
  );
}
