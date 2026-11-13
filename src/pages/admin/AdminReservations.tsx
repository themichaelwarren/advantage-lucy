import Icon from '../../components/admin/Icon';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAllEvents } from '../../hooks/useSheetData';
import { useAdminT, type AdminLocale, type AdminStrings } from '../../i18n/admin';
import {
  getReservations, updateReservation, addReservation, resendReservation, type Reservation,
} from '../../services/adminService';
import { errorText } from '../../components/admin/ui';
import { reserveState, todayInJapan } from '../../utils/showDates';
import type { Event } from '../../types';
import { useFilters } from '../../hooks/useFilters';
import type { SenderMatch } from '../../../functions/lib/filters';
import { toKatakana, sortKey } from '../../../functions/lib/kana';

const ticketsOf = (r: Reservation) => Math.max(0, parseInt(r.tickets, 10) || 0);
/** By reading where there is one (フリガナ), else by name: kanji names sort right only with their reading */
const byReading = (a: Reservation, b: Reservation) => sortKey(a).localeCompare(sortKey(b), 'ja');
const active = (r: Reservation) => r.status !== 'cancelled';
const sumTickets = (rs: Reservation[]) => rs.reduce((n, r) => n + ticketsOf(r), 0);

const showName = (e: Event, locale: AdminLocale) =>
  (locale === 'ja' ? e.title_ja || e.title_en || e.venue_ja || e.venue_en : e.title_en || e.title_ja || e.venue_en || e.venue_ja) || e.id;

/** When a booking came in, Japan time: "9月8日(火) 22:23" / "Tue 8 Sep, 22:23" */
const when = (iso: string, locale: AdminLocale) =>
  iso ? new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-GB', { month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }).format(new Date(iso)) : '';

/** "2026-11-28T23:59" (Japan time) → "11月28日(土) 23:59" */
const closesText = (at: string, locale: AdminLocale) =>
  new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-GB', { month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
    .format(new Date(`${at}:00Z`));

function StateTag({ e, taken, s, locale }: { e: Event; taken: number; s: AdminStrings; locale: AdminLocale }) {
  const st = reserveState(e, taken);
  if (st.state === 'open') return <span className="lu-tag is-ok" title={s.resvClosesAt.replace('{at}', closesText(st.closes, locale))}>● {s.resvOpen}</span>;
  if (st.state === 'full') return <span className="lu-tag is-new">{s.resvFull}</span>;
  return <span className="lu-tag is-muted">{s.resvClosed}</span>;
}

function useReservations() {
  const [list, setList] = useState<Reservation[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { getReservations().then(setList).catch(err => setError(errorText(err))); }, []);
  return { list, setList, error, setError };
}

/** /admin/reservations: every show that takes reservations, with its totals. */
export default function AdminReservations() {
  const { s, locale, prefix } = useAdminT();
  const { events, loading } = useAllEvents();
  const { list, error } = useReservations();
  const today = todayInJapan();

  const byShow = useMemo(() => {
    const m = new Map<string, Reservation[]>();
    for (const r of list || []) if (active(r)) m.set(r.event, [...(m.get(r.event) || []), r]);
    return m;
  }, [list]);

  const shows = events.filter(e => e.reserve || byShow.has(e.id));
  const upcoming = shows.filter(e => (e.end_date || e.date) >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = shows.filter(e => (e.end_date || e.date) < today).sort((a, b) => b.date.localeCompare(a.date));

  const row = (e: Event) => {
    const rs = byShow.get(e.id) || [];
    const taken = sumTickets(rs);
    const cap = parseInt(e.reserve_cap || '', 10);
    return (
      <li key={e.id}>
        <Link to={`${prefix}/reservations/${e.id}`} className="lu-list-row">
          <time>{e.date}</time>
          <span className="lu-list-main">
            <strong>{showName(e, locale)}</strong>
            <span className="lu-snippet">
              {cap > 0 ? s.resvTicketsOf.replace('{n}', String(taken)).replace('{cap}', String(cap)) : s.resvTickets.replace('{n}', String(taken))}
              {' · '}{s.resvBookings.replace('{n}', String(rs.length))}
            </span>
          </span>
          <span className="lu-list-tags">{e.reserve && <StateTag e={e} taken={taken} s={s} locale={locale} />}</span>
        </Link>
      </li>
    );
  };

  return (
    <>
      <div className="lu-page-head">
        <div>
          <h1>{s.reservations}</h1>
          <p className="lu-hint">{s.reservationsHint}</p>
        </div>
      </div>
      {error && <div className="lu-alert">{error}</div>}
      {(loading || (!list && !error)) && <p className="lu-loading">{s.loading}</p>}
      {!loading && list && shows.length === 0 && <p className="lu-empty">{s.reservationsEmpty}</p>}
      {!loading && list && upcoming.length > 0 && (
        <section className="lu-list-group">
          <h2>{s.upcomingShows}</h2>
          <ul className="lu-list">{upcoming.map(row)}</ul>
        </section>
      )}
      {!loading && list && past.length > 0 && (
        <section className="lu-list-group">
          <h2>{s.resvPast}</h2>
          <ul className="lu-list">{past.map(row)}</ul>
        </section>
      )}
    </>
  );
}

/** /admin/reservations/:id: one show's bookings, the venue list, and door mode. */
export function AdminShowReservations() {
  const { id } = useParams<{ id: string }>();
  const { s, locale, prefix } = useAdminT();
  const { events, loading } = useAllEvents();
  const { list, setList, error, setError } = useReservations();
  const [door, setDoor] = useState(false);
  const { match } = useFilters();
  const [query, setQuery] = useState('');
  // Which bookings: those still on (the default), only the cancelled ones, or all
  const [view, setView] = useState<'active' | 'cancelled' | 'all'>('active');
  // Order: when they booked (oldest first, as they came in), newest first, or by name
  const [order, setOrder] = useState<'oldest' | 'newest' | 'name'>('oldest');
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const event = events.find(e => e.id === id);

  const mine = useMemo(() => (list || []).filter(r => r.event === id), [list, id]);
  const booked = mine.filter(active);
  const taken = sumTickets(booked);
  const arrived = sumTickets(booked.filter(r => r.arrived === 'TRUE'));
  const cap = parseInt(event?.reserve_cap || '', 10);

  const replace = (r: Reservation) => setList(l => (l || []).map(x => (x.id === r.id ? r : x)));

  async function change(r: Reservation, fields: Partial<Reservation>) {
    const before = r;
    replace({ ...r, ...fields });   // show it straight away
    setError('');
    try { replace(await updateReservation(r.id, fields)); }
    catch (err) { replace(before); setError(errorText(err)); }
  }

  const venueList = () => {
    const name = event ? `${Number(event.date.slice(5, 7))}/${Number(event.date.slice(8, 10))} ${showName(event, 'ja')}` : '';
    const rows = [...booked].sort(byReading);
    return [
      `${name} advantage Lucy ${s.resvListTitle}`,
      '',
      // The venue reads names out at the door: the reading alongside (山田花子（ヤマダ ハナコ）)
      ...rows.map(r => `${r.name}${r.kana ? `（${r.kana}）` : ''}　${ticketsOf(r)}${locale === 'ja' ? '枚' : ''}`),
      '',
      s.resvTotalLine.replace('{tickets}', String(taken)).replace('{n}', String(booked.length)),
    ].join('\n');
  };

  async function copy() {
    try { await navigator.clipboard.writeText(venueList()); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError('Couldn’t copy. Your browser blocked the clipboard.'); }
  }

  function csv() {
    const cols = ['name', 'tickets', 'email', 'note', 'received_at', 'status', 'arrived'] as const;
    const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const text = [cols.join(','), ...mine.map(r => cols.map(c => q(r[c] || '')).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));  // BOM: Excel reads Japanese correctly
    const a = Object.assign(document.createElement('a'), { href: url, download: `reservations-${id}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading || (!list && !error)) return <p className="lu-loading">{s.loading}</p>;
  if (!event) return <p className="lu-empty">{s.noResults}</p>;

  const q = query.trim().toLowerCase();
  const shown = mine
    .filter(r => door || view === 'active' ? active(r) : view === 'cancelled' ? !active(r) : true)
    .filter(r => !q || [r.name, r.kana || '', r.email, r.note].some(t => t.toLowerCase().includes(q)) || (!!r.kana && toKatakana(r.kana).includes(toKatakana(q))))
    .sort((a, b) => door || order === 'name' ? byReading(a, b) || a.received_at.localeCompare(b.received_at)
      : order === 'newest' ? b.received_at.localeCompare(a.received_at) : a.received_at.localeCompare(b.received_at));
  const cancelledCount = mine.length - booked.length;

  return (
    <div className={door ? 'lu-door' : ''}>
      <div className="lu-page-head">
        <div>
          <p className="lu-eyebrow"><Icon name="ticket" /> {s.reservations} · {event.date}</p>
          <h1>{showName(event, locale)}</h1>
          <p className="lu-resv-totals">
            <strong>{cap > 0 ? s.resvTicketsOf.replace('{n}', String(taken)).replace('{cap}', String(cap)) : s.resvTickets.replace('{n}', String(taken))}</strong>
            <span>{s.resvBookings.replace('{n}', String(booked.length))}</span>
            {event.reserve && <StateTag e={event} taken={taken} s={s} locale={locale} />}
          </p>
          {cap > 0 && <div className="lu-resv-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, (taken / cap) * 100)}%` }} /></div>}
        </div>
      </div>

      {error && <div className="lu-alert">{error}</div>}

      {door ? (
        <div className="lu-door-bar">
          <p><strong>{s.resvArrivedCount.replace('{n}', String(arrived)).replace('{total}', String(taken))}</strong> <span className="lu-hint">{s.resvDoorHint}</span></p>
          <button type="button" className="lu-btn" onClick={() => setDoor(false)}>{s.resvDoorExit}</button>
        </div>
      ) : (
        <div className="lu-resv-actions">
          <button type="button" className="lu-btn lu-btn-primary" onClick={copy} disabled={!booked.length}>{copied ? s.resvCopied : <><Icon name="paste" /> {s.resvCopy}</>}</button>
          <button type="button" className="lu-btn" onClick={() => setDoor(true)} disabled={!booked.length}><Icon name="door" /> {s.resvDoor}</button>
          <button type="button" className="lu-btn" onClick={() => setAdding(a => !a)}>+ {s.resvAdd}</button>
          <button type="button" className="lu-btn lu-btn-quiet" onClick={csv} disabled={!mine.length}>⤓ {s.resvCsv}</button>
          <Link to={`${prefix}/events/${event.id}`} className="lu-btn lu-btn-quiet">{s.resvEditShow}</Link>
        </div>
      )}

      {adding && !door && (
        <AddForm s={s} eventId={event.id} onCancel={() => setAdding(false)}
          onAdded={r => { setList(l => [...(l || []), r]); setAdding(false); }} onError={setError} />
      )}

      {mine.length > 0 && (
        <div className="lu-resv-filter">
          <input type="search" className="lu-search" placeholder={s.search} value={query} onChange={e => setQuery(e.target.value)} />
          {!door && cancelledCount > 0 && (
            <div className="lu-chips" role="group" aria-label={s.resvViewLabel}>
              {([['active', s.resvViewActive, mine.length - cancelledCount], ['cancelled', s.resvCancelled, cancelledCount], ['all', s.filterAll, mine.length]] as const).map(([v, label, n]) => (
                <button key={v} type="button" className={`lu-pill${view === v ? ' is-on' : ''}`} aria-pressed={view === v} onClick={() => setView(v)}>{label} · {n}</button>
              ))}
            </div>
          )}
          {!door && mine.length > 1 && (
            <label className="lu-sort">
              <span className="lu-visually-hidden">{s.sortBy}</span>
              <select value={order} onChange={e => setOrder(e.target.value as typeof order)} aria-label={s.sortBy}>
                <option value="oldest">↕ {s.resvSortOldest}</option>
                <option value="newest">↕ {s.resvSortNewest}</option>
                <option value="name">↕ {s.resvSortName}</option>
              </select>
            </label>
          )}
        </div>
      )}

      {mine.length === 0 && <p className="lu-empty">{s.resvNone}</p>}

      <ul className={`lu-list lu-resv-list${door ? ' is-door' : ''}`}>
        {shown.map(r => door ? (
          <li key={r.id}>
            <button type="button" className={`lu-door-row${r.arrived === 'TRUE' ? ' is-in' : ''}`} aria-pressed={r.arrived === 'TRUE'}
              onClick={() => change(r, { arrived: r.arrived === 'TRUE' ? '' : 'TRUE' })}>
              <span className="lu-door-check" aria-hidden="true">{r.arrived === 'TRUE' ? '✓' : ''}</span>
              <span className="lu-door-name">{match(r.email) && <span className="lu-door-flag" title={s.resvFlagTip}><Icon name="warn" /> </span>}{r.name}{r.kana && <small className="lu-door-kana">{r.kana}</small>}</span>
              <span className="lu-door-count">{ticketsOf(r)}</span>
              {r.note && <span className="lu-door-note">{r.note}</span>}
            </button>
          </li>
        ) : (
          <ReservationRow key={r.id} r={r} s={s} locale={locale} open={openRow === r.id} flag={match(r.email)}
            onToggle={() => setOpenRow(o => (o === r.id ? null : r.id))}
            onChange={fields => change(r, fields)}
            onResend={async () => {
              setError('');
              try { replace(await resendReservation(r.id)); } catch (err) { setError(errorText(err)); }
            }} />
        ))}
      </ul>
    </div>
  );
}

function ReservationRow({ r, s, locale, open, onToggle, onChange, onResend, flag }: {
  r: Reservation; s: AdminStrings; locale: AdminLocale; open: boolean; flag?: SenderMatch;
  onToggle: () => void; onChange: (f: Partial<Reservation>) => Promise<void>; onResend: () => Promise<void>;
}) {
  const [draft, setDraft] = useState({ name: r.name, kana: r.kana || '', email: r.email, tickets: r.tickets, note: r.note });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setDraft({ name: r.name, kana: r.kana || '', email: r.email, tickets: r.tickets, note: r.note }); }, [open, r]);
  const cancelled = r.status === 'cancelled';
  const dirty = draft.name !== r.name || draft.kana !== (r.kana || '') || draft.email !== r.email || draft.tickets !== r.tickets || draft.note !== r.note;
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  return (
    <li className={cancelled ? 'is-done' : ''}>
      <button type="button" className="lu-list-row lu-resv-row" aria-expanded={open} onClick={onToggle}>
        <span className="lu-resv-count">{ticketsOf(r)}</span>
        <span className="lu-list-main">
          <strong>{r.name}{r.kana && <small className="lu-resv-kana">{r.kana}</small>}</strong>
          <span className="lu-snippet">{[r.email, r.note].filter(Boolean).join(' · ')}</span>
        </span>
        <span className="lu-list-tags">
          {flag && <span className="lu-tag is-warn" title={s.resvFlagTip}><Icon name="warn" /> {flag.kind === 'filtered' ? s.resvFlagFiltered : s.filterLookalike}</span>}
          {cancelled && <span className="lu-tag is-muted">{s.resvCancelled}</span>}
          {r.arrived === 'TRUE' && <span className="lu-tag is-ok">✓ {s.resvArrived}</span>}
          {r.emailed === 'no' && <span className="lu-tag is-new">{s.resvNotEmailed}</span>}
          {r.source === 'admin' && <span className="lu-tag is-muted">{s.resvByHand}</span>}
          {r.source === 'form' && <span className="lu-tag is-muted" title={s.resvFromFormTip}>{s.resvFromForm}</span>}
          <time dateTime={r.received_at} title={s.resvBookedAt} className="lu-resv-when">{when(r.received_at, locale)}</time>
        </span>
      </button>
      {open && (
        <div className="lu-resv-edit">
          <div className="lu-resv-edit-grid">
            <label className="lu-field"><span>{s.resvName}</span><input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} /></label>
            <label className="lu-field"><span>{s.resvKana}</span><input lang="ja" value={draft.kana} placeholder={s.resvKanaHint} onChange={e => setDraft(d => ({ ...d, kana: e.target.value }))} onBlur={() => setDraft(d => ({ ...d, kana: toKatakana(d.kana) }))} /></label>
            <label className="lu-field"><span>{s.resvCount}</span><input type="number" min={1} inputMode="numeric" value={draft.tickets} onChange={e => setDraft(d => ({ ...d, tickets: e.target.value }))} /></label>
            <label className="lu-field"><span>{s.resvEmail}</span><input type="email" value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} /></label>
            <label className="lu-field"><span>{s.resvNote}</span><input value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} /></label>
          </div>
          {flag && <p className="lu-alert lu-filter-banner is-warn"><Icon name="warn" /> {flag.kind === 'filtered' ? s.resvFlagFilteredBody : s.resvFlagLookalikeBody.replace('{email}', flag.listed)}</p>}
          <p className="lu-hint">
            {r.source === 'form' ? s.resvFromFormTip : r.emailed === 'yes' ? `✓ ${s.resvEmailed}` : r.emailed === 'held' ? s.resvEmailHeld : r.emailed === 'no' ? s.resvNotEmailed : r.source === 'admin' ? s.resvByHand : ''}
          </p>
          <div className="lu-resv-edit-actions">
            <button type="button" className="lu-btn lu-btn-primary" disabled={!dirty || busy} onClick={() => run(() => onChange(draft))}>{s.save}</button>
            {r.email && flag?.kind !== 'filtered' && <button type="button" className="lu-btn" disabled={busy} onClick={() => run(onResend)}><Icon name="mail" /> {s.resvResend}</button>}
            <button type="button" className={`lu-btn ${cancelled ? '' : 'lu-btn-danger-quiet'}`} disabled={busy}
              onClick={() => run(() => onChange({ status: cancelled ? '' : 'cancelled' }))}>
              {cancelled ? s.resvRestore : s.resvCancel}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function AddForm({ s, eventId, onAdded, onCancel, onError }: {
  s: AdminStrings; eventId: string;
  onAdded: (r: Reservation) => void; onCancel: () => void; onError: (msg: string) => void;
}) {
  const [f, setF] = useState({ name: '', kana: '', email: '', tickets: '1', note: '' });
  const [send, setSend] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form className="lu-resv-add" onSubmit={async e => {
      e.preventDefault();
      if (!f.name.trim()) return;
      setBusy(true);
      onError('');
      try { onAdded(await addReservation({ ...f, event: eventId }, send && !!f.email.trim())); }
      catch (err) { onError(errorText(err)); }
      finally { setBusy(false); }
    }}>
      <p className="lu-hint">{s.resvAddHint}</p>
      <div className="lu-resv-edit-grid">
        <label className="lu-field"><span>{s.resvName}</span><input autoFocus value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} /></label>
        <label className="lu-field"><span>{s.resvKana} <span className="lu-optional">· {s.optional}</span></span><input lang="ja" value={f.kana} placeholder={s.resvKanaHint} onChange={e => setF(x => ({ ...x, kana: e.target.value }))} onBlur={() => setF(x => ({ ...x, kana: toKatakana(x.kana) }))} /></label>
        <label className="lu-field"><span>{s.resvCount}</span><input type="number" min={1} inputMode="numeric" value={f.tickets} onChange={e => setF(x => ({ ...x, tickets: e.target.value }))} /></label>
        <label className="lu-field"><span>{s.resvEmail} <span className="lu-optional">· {s.optional}</span></span><input type="email" value={f.email} onChange={e => setF(x => ({ ...x, email: e.target.value }))} /></label>
        <label className="lu-field"><span>{s.resvNote} <span className="lu-optional">· {s.optional}</span></span><input value={f.note} onChange={e => setF(x => ({ ...x, note: e.target.value }))} /></label>
      </div>
      {f.email.trim() && (
        <label className="lu-check"><input type="checkbox" checked={send} onChange={e => setSend(e.target.checked)} /> {s.resvSendEmail}</label>
      )}
      <div className="lu-resv-edit-actions">
        <button type="submit" className="lu-btn lu-btn-primary" disabled={busy || !f.name.trim()}>{s.add}</button>
        <button type="button" className="lu-btn lu-btn-quiet" onClick={onCancel}>{s.cancel}</button>
      </div>
    </form>
  );
}
