import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAllEvents, useVenues, useAreas, useAllSetlists, useSongs } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow, replaceRows } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import {
  Section, Field, BilingualRow, Switch, SaveBar, ImageField, DeleteButton,
  useUnsavedWarning, makeId, errorText,
} from '../../components/admin/ui';
import VenuePicker from '../../components/admin/VenuePicker';
import LinkTextarea from '../../components/admin/LinkTextarea';
import { setlistIsPublic } from '../../utils/showDates';
import { EVENT_COLUMNS, eventToRow } from '../../utils/adminRows';
import SetlistEditor, { newItem, type SetlistItem } from '../../components/admin/SetlistEditor';

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
  const { songs } = useSongs();

  const [form, setForm] = useState<Form>(emptyForm);
  const [setlist, setSetlist] = useState<SetlistItem[]>([]);
  const [baseline, setBaseline] = useState('');
  const [errors, setErrors] = useState<Partial<Record<EventField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  const snapshot = (f: Form, sl: SetlistItem[]) =>
    JSON.stringify([f, sl.map(({ song, set, notes }) => [song, set, notes])]);

  // Load an existing show and its setlist
  useEffect(() => {
    if (isNew) { setBaseline(snapshot(emptyForm(), [])); return; }
    if (loading) return;
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    const f: Form = eventToRow(ev);
    const sl = setlists
      .filter(x => x.event === ev.id)
      .sort((a, b) => a.set.localeCompare(b.set, undefined, { numeric: true }) || a.order - b.order)
      .map(x => ({ ...newItem(x.set, x.song), notes: x.notes || '', status: x.status || 'published' }));
    setForm(f);
    setSetlist(sl);
    setBaseline(snapshot(f, sl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, id, loading, events, setlists]);

  // Arriving from "Add a setlist": jump to the setlist once the show has loaded
  const location = useLocation();
  useEffect(() => {
    if (location.hash === '#setlist' && baseline) {
      document.getElementById('setlist')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash, baseline]);

  const dirty = baseline !== '' && snapshot(form, setlist) !== baseline;
  useUnsavedWarning(dirty);

  const set = (field: EventField, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
  };

  const songTitles = useMemo(() => songs.map(x => x.title).filter(Boolean).sort(), [songs]);

  /** e.g. 2025-11-30-tokyo, like the existing IDs (date + prefecture). */
  function newEventId(): string {
    const venue = venues.find(v => v.id === form.venue);
    const area = areas.find(a => a.id === venue?.area);
    const place = area?.prefecture || area?.id || '';
    return makeId([form.date, place], new Set(events.map(e => e.id)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problems: Partial<Record<EventField, string>> = {};
    if (!form.date) problems.date = s.dateMissing;
    if (!form.venue) problems.venue = s.venueMissing;
    setErrors(problems);
    if (Object.keys(problems).length) {
      document.querySelector('.lu-field.has-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSaving(true);
    setError('');
    try {
      const eventId = isNew ? newEventId() : form.id;
      const fields = { ...form, id: eventId };
      if (isNew) await createRow('Events', fields);
      else await updateRow('Events', eventId, fields);

      // Setlist: the order on screen becomes the order numbers
      const counters: Record<string, number> = {};
      const rows = setlist
        .filter(r => r.song.trim())
        .map(r => {
          counters[r.set] = (counters[r.set] || 0) + 1;
          return { event: eventId, song: r.song.trim(), set: r.set, order: String(counters[r.set]), notes: r.notes, status: r.status };
        });
      const hadSetlist = setlists.some(x => x.event === eventId);
      if (rows.length || hadSetlist) await replaceRows('Setlists', eventId, rows);

      setForm(fields);
      setBaseline(snapshot(fields, setlist));
      setSavedAt(Date.now());
      if (isNew) navigate(`${prefix}/events/${eventId}`, { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  if (!isNew && loading) return <p className="lu-loading">{s.loading}</p>;

  const heading = isNew ? s.newShow : (locale === 'ja' ? form.title_ja || form.title_en : form.title_en || form.title_ja) || form.date;

  return (
    <form className="lu-form" onSubmit={handleSubmit} noValidate>
      <div className="lu-page-head">
        <div>
          <p className="lu-eyebrow">{isNew ? s.shows : s.editShow}</p>
          <h1>{heading}</h1>
        </div>
      </div>

      <Section title={s.secWhenWhere}>
        <div className="lu-grid-2">
          <Field label={s.date} error={errors.date}>
            {fid => <input id={fid} type="date" value={form.date} onChange={e => set('date', e.target.value)} />}
          </Field>
          <Field label={s.endDate} hint={s.endDateHint} optional s={s}>
            {fid => <input id={fid} type="date" value={form.end_date} min={form.date} onChange={e => set('end_date', e.target.value)} />}
          </Field>
        </div>
        <Field label={s.venue} error={errors.venue}>
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
      </Section>

      <Section title={s.secAbout}>
        <p className="lu-hint">{s.bothLanguagesHint}</p>
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
        {/* Notes can be long (times, ticket details…): full width, growing with the text */}
        <Field label={`${s.description} · ${s.english}`} hint={s.notesHint} optional s={s}>
          {fid => <LinkTextarea s={s} id={fid} className="lu-textarea-long" rows={6} value={form.body_en} onChange={v => set('body_en', v)} />}
        </Field>
        <Field label={`${s.description} · ${s.japanese}`} optional s={s}>
          {fid => <LinkTextarea s={s} id={fid} className="lu-textarea-long" rows={6} lang="ja" value={form.body_ja} onChange={v => set('body_ja', v)} />}
        </Field>
      </Section>

      <Section title={s.secSetlist} id="setlist">
        {form.date && !setlistIsPublic({ date: form.date, end_date: form.end_date }) && (
          <p className="lu-note">🔒 {s.setlistAfterShow}</p>
        )}
        <SetlistEditor s={s} items={setlist} onChange={setSetlist} songTitles={songTitles} />
      </Section>

      <Section title={s.secTickets}>
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
      </Section>

      <Section title={s.secPoster}>
        <ImageField s={s} value={form.poster_url} onChange={v => set('poster_url', v)} onError={setError} />
      </Section>

      <Section title={s.visible}>
        <Switch checked={form.status !== 'private'} onChange={v => set('status', v ? 'published' : 'private')} label={s.visible} hint={s.visibleHint} />
        <Switch checked={form.featured === 'TRUE'} onChange={v => set('featured', v ? 'TRUE' : '')} label={s.featured} hint={s.featuredHint} />
        {!isNew && (
          <div className="lu-danger-row">
            <DeleteButton s={s} onConfirm={async () => {
              try {
                if (setlists.some(x => x.event === form.id)) await replaceRows('Setlists', form.id, []);
                await deleteRow('Events', form.id);
                navigate(`${prefix}/events`);
              } catch (err) { setError(errorText(err)); }
            }} />
          </div>
        )}
      </Section>

      <SaveBar
        s={s}
        saving={saving}
        savedAt={savedAt}
        error={error}
        dirty={dirty}
        viewHref={!isNew ? `/${locale}/events/${form.id}` : undefined}
        onCancel={() => navigate(`${prefix}/events`)}
      />
    </form>
  );
}
