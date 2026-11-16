import Icon from '../../components/admin/Icon';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAllEvents } from '../../hooks/useSheetData';
import { useAdminT, type AdminLocale, type AdminStrings } from '../../i18n/admin';
import {
  getReservations, updateReservation, addReservation, resendReservation, checkReservations, previewReservationEmail, getSentReservationMail, type Reservation, type SentReservationMail,
} from '../../services/adminService';
import { errorText, ConfirmDialog } from '../../components/admin/ui';
import { reserveState, todayInJapan } from '../../utils/showDates';
import type { Event } from '../../types';
import { useFilters } from '../../hooks/useFilters';
import type { SenderMatch } from '../../../functions/lib/filters';
import { toKatakana, sortKey } from '../../../functions/lib/kana';
import PageHelp from '../../components/admin/PageHelp';
import { isFanBooking, needsCheck } from '../../utils/resvSeen';
import { whoName } from '../../components/admin/Activity';

const RESV_PREFS = 'admin-resv-list';
/** The language a booking's emails go out in: the page they booked from (Google Form imports: guessed from the name) */
const langOf = (r: Reservation): 'ja' | 'en' => (r.locale === 'en' ? 'en' : 'ja');
/**
 * A booking's history, oldest first. Bookings from before the log started (and Google Form
 * imports) begin with when they came in.
 */
function BookingLog({ r, s, locale, onOpenMail }: { r: Reservation; s: AdminStrings; locale: AdminLocale; onOpenMail?: (mailId: string) => void }) {
  const lines = (r.log || '').split('\n').filter(Boolean).map(l => { const [at, what, detail, who, mail] = l.split('\t'); return { at, what, detail: detail || '', who: who || '', mail: mail || '' }; });
  if (!lines.some(l => ['booked', 'added'].includes(l.what))) {
    lines.unshift({ at: r.received_at, what: r.source === 'form' ? 'form' : r.source === 'admin' ? 'added' : 'booked', detail: r.tickets, who: '', mail: '' });
  }
  const label = (what: string, detail: string) => {
    const t = (s.resvLog as Record<string, string>)[what] || what;
    return t.replace('{n}', detail).replace('{email}', detail).replace('{lang}', detail === 'en' ? 'English' : '日本語');
  };
  return (
    <ol className="lu-resv-log" aria-label={s.resvLogTitle}>
      {lines.map((l, i) => (
        <li key={i} className={`is-${l.what}`}>
          <time dateTime={l.at}>{when(l.at, locale)}</time>
          <span>
            {label(l.what, l.detail)}
            {/* Emails since copies were kept can be opened again */}
            {l.mail && onOpenMail && <> <button type="button" className="lu-link-btn" onClick={() => onOpenMail(l.mail)}>{s.resvViewMail}</button></>}
          </span>
          <span className="lu-resv-log-who">{l.who ? whoName(l.who) : l.what === 'form' ? '' : ['booked', 'rebooked'].includes(l.what) ? s.resvLogFan : ''}</span>
        </li>
      ))}
    </ol>
  );
}

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
  const { list, setList, error, setError } = useReservations();
  const today = todayInJapan();
  const [checking, setChecking] = useState(false);

  // Fans' bookings across every show, newest first: every one nobody has checked yet, then recent ones
  const unchecked = useMemo(() => (list || []).filter(needsCheck).sort((a, b) => b.received_at.localeCompare(a.received_at)), [list]);
  const latest = useMemo(() => {
    const seen = (list || []).filter(r => isFanBooking(r) && !needsCheck(r)).sort((a, b) => b.received_at.localeCompare(a.received_at));
    return [...unchecked, ...seen.slice(0, Math.max(0, 6 - unchecked.length))];
  }, [list, unchecked]);
  async function markChecked(ids: string[]) {
    if (!ids.length) return;
    setChecking(true); setError('');
    setList(l => (l || []).map(r => (ids.includes(r.id) ? { ...r, checked: 'TRUE' } : r)));
    try { await checkReservations(ids); }
    catch (err) { setError(errorText(err)); getReservations().then(setList).catch(() => {}); }
    finally { setChecking(false); }
  }
  const eventById = useMemo(() => new Map(events.map(e => [e.id, e])), [events]);

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
          <h1>{s.reservations}<PageHelp /></h1>
          <p className="lu-hint">{s.reservationsHint}</p>
        </div>
      </div>
      {error && <div className="lu-alert">{error}</div>}
      {(loading || (!list && !error)) && <p className="lu-loading">{s.loading}</p>}
      {!loading && list && shows.length === 0 && <p className="lu-empty">{s.reservationsEmpty}</p>}
      {!loading && list && latest.length > 0 && (
        <section className="lu-list-group lu-resv-latest">
          <h2>
            {s.resvLatest}{unchecked.length > 0 && <span className="lu-badge">{unchecked.length}</span>}
            {unchecked.length > 1 && <button type="button" className="lu-btn lu-btn-sm lu-section-link" disabled={checking} onClick={() => markChecked(unchecked.map(r => r.id))}>✓ {s.resvCheckAll}</button>}
          </h2>
          <ul className="lu-list">
            {latest.map(r => {
              const e = eventById.get(r.event);
              const fresh = needsCheck(r);
              return (
                <li key={r.id} className={`lu-resv-latest-item${fresh ? ' is-fresh' : ''}`}>
                  <Link to={`${prefix}/reservations/${r.event}/${r.id}`} className="lu-list-row">
                    <span className="lu-resv-count">{ticketsOf(r)}</span>
                    <span className="lu-list-main">
                      <strong>{r.name}{r.kana && <small className="lu-resv-kana">{r.kana}</small>}</strong>
                      <span className="lu-snippet">{e ? `${e.date} · ${showName(e, locale)}` : r.event}</span>
                    </span>
                    <span className="lu-list-tags">
                      {fresh && <span className="lu-tag is-new">{s.resvNew}</span>}
                      <time dateTime={r.received_at} className="lu-resv-when">{when(r.received_at, locale)}</time>
                    </span>
                  </Link>
                  {fresh && <button type="button" className="lu-resv-checkbtn" disabled={checking} onClick={() => markChecked([r.id])} aria-label={s.resvCheck} title={s.resvCheck}>✓</button>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
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

/** /admin/reservations/:id(/:resv): one show's bookings, the venue list, and door mode. A booking opens beside the list. */
export function AdminShowReservations() {
  const { id, resv } = useParams<{ id: string; resv?: string }>();
  const { s, locale, prefix } = useAdminT();
  const navigate = useNavigate();
  const { events, loading } = useAllEvents();
  const { list, setList, error, setError } = useReservations();
  const [door, setDoor] = useState(false);
  const { match } = useFilters();
  const [query, setQuery] = useState('');
  // Which bookings (still on, cancelled, all) and in what order (newest first by default, oldest, by name).
  // Remembered on this device for every show, so coming back from elsewhere keeps them.
  const [prefs, setPrefs] = useState<{ view: 'active' | 'cancelled' | 'all'; order: 'oldest' | 'newest' | 'name' }>(() => {
    try { return { view: 'active', order: 'newest', ...JSON.parse(localStorage.getItem(RESV_PREFS) || '{}') }; }
    catch { return { view: 'active', order: 'newest' }; }
  });
  useEffect(() => { try { localStorage.setItem(RESV_PREFS, JSON.stringify(prefs)); } catch { /* private mode */ } }, [prefs]);
  const { view, order } = prefs;
  const setView = (v: typeof view) => setPrefs(p => ({ ...p, view: v }));
  const setOrder = (o: typeof order) => setPrefs(p => ({ ...p, order: o }));
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const event = events.find(e => e.id === id);
  const showUrl = `${prefix}/reservations/${id}`;
  // On a phone (or a narrow window) the booking takes the whole page: start it at the top
  useEffect(() => {
    if (!resv) return;
    if (!window.matchMedia('(min-width: 1180px)').matches) window.scrollTo(0, 0);
    // Beside the list: keep the open booking's row in view (after ↑/↓, or a link straight to it)
    else document.querySelector('.lu-resv-list li.is-current')?.scrollIntoView({ block: 'nearest' });
  }, [resv]);
  // ↑/↓ (or k/j) for the previous/next booking, Esc to close it: not while typing or with a window open
  const steps = useRef<{ prev?: string; next?: string; close?: string }>({});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('.lu-modal-overlay')) return;
      const to = e.key === 'ArrowUp' || e.key === 'k' ? steps.current.prev : e.key === 'ArrowDown' || e.key === 'j' ? steps.current.next : e.key === 'Escape' ? steps.current.close : undefined;
      if (to && steps.current.close) { e.preventDefault(); navigate(to); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate]);

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
  const toCheck = mine.filter(needsCheck);
  async function checkAll() {
    const ids = toCheck.map(r => r.id);
    setList(l => (l || []).map(r => (ids.includes(r.id) ? { ...r, checked: 'TRUE' } : r)));
    try { await checkReservations(ids); } catch (err) { setError(errorText(err)); }
  }
  const selected = !door && resv ? mine.find(r => r.id === resv) : undefined;
  // Previous / next follow the list as it's shown (filter and order); a booking filtered out still opens
  const at = selected ? shown.findIndex(r => r.id === selected.id) : -1;
  const prev = at > 0 ? shown[at - 1] : undefined;
  const next = at >= 0 && at < shown.length - 1 ? shown[at + 1] : undefined;
  // The next booking nobody has checked, after this one in the list (or from the top)
  const unseen = shown.filter(r => needsCheck(r) && r.id !== selected?.id);
  const nextNew = unseen.find(r => shown.indexOf(r) > at) || unseen[0];
  steps.current = { prev: prev && `${showUrl}/${prev.id}`, next: next && `${showUrl}/${next.id}`, close: selected ? showUrl : undefined };

  return (
    <div className={[door ? 'lu-door' : '', selected ? 'has-pane' : ''].filter(Boolean).join(' ') || undefined}>
      <div className="lu-page-head lu-resv-head">
        <div>
          <p className="lu-eyebrow"><Link to={`${prefix}/reservations`}><Icon name="ticket" /> {s.reservations}</Link> · {event.date}</p>
          <h1>{showName(event, locale)}<PageHelp /></h1>
          <p className="lu-resv-totals">
            <strong>{cap > 0 ? s.resvTicketsOf.replace('{n}', String(taken)).replace('{cap}', String(cap)) : s.resvTickets.replace('{n}', String(taken))}</strong>
            <span>{s.resvBookings.replace('{n}', String(booked.length))}</span>
            {event.reserve && <StateTag e={event} taken={taken} s={s} locale={locale} />}
          </p>
          {cap > 0 && <div className="lu-resv-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, (taken / cap) * 100)}%` }} /></div>}
          {/* Back to the show itself: its admin page (details, 予約枠) and the page fans see */}
          <p className="lu-resv-showlinks">
            <Link to={`${prefix}/events/${event.id}`} className="lu-btn lu-btn-sm"><Icon name="shows" /> {s.resvShowPage}</Link>
            <a href={`/${locale}/events/${event.id}`} target="_blank" rel="noopener" className="lu-btn lu-btn-sm lu-btn-quiet"><Icon name="external" /> {s.viewOnSite}</a>
          </p>
        </div>
      </div>

      {error && <div className="lu-alert">{error}</div>}

      <div className={`lu-resv-split${selected ? ' has-pane' : ''}`}>
        <div className="lu-resv-listcol">
          {door ? (
            <div className="lu-door-bar">
              <p><strong>{s.resvArrivedCount.replace('{n}', String(arrived)).replace('{total}', String(taken))}</strong> <span className="lu-hint">{s.resvDoorHint}</span></p>
              <button type="button" className="lu-btn" onClick={() => setDoor(false)}>{s.resvDoorExit}</button>
            </div>
          ) : (
            <div className="lu-resv-actions">
              <button type="button" className="lu-btn lu-btn-primary" onClick={copy} disabled={!booked.length}>{copied ? s.resvCopied : <><Icon name="paste" /> {s.resvCopy}</>}</button>
              <button type="button" className="lu-btn" onClick={() => { setDoor(true); if (resv) navigate(showUrl); }} disabled={!booked.length}><Icon name="door" /> {s.resvDoor}</button>
              <button type="button" className="lu-btn" onClick={() => setAdding(a => !a)}>+ {s.resvAdd}</button>
              <button type="button" className="lu-btn lu-btn-quiet lu-hide-phone" onClick={csv} disabled={!mine.length}>⤓ {s.resvCsv}</button>
            </div>
          )}

          {adding && !door && (
            <AddForm s={s} eventId={event.id} onCancel={() => setAdding(false)}
              onAdded={r => { setList(l => [...(l || []), r]); setAdding(false); navigate(`${showUrl}/${r.id}`); }} onError={setError} />
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
                    <option value="newest">↕ {s.resvSortNewest}</option>
                    <option value="oldest">↕ {s.resvSortOldest}</option>
                    <option value="name">↕ {s.resvSortName}</option>
                  </select>
                </label>
              )}
            </div>
          )}

          {!door && toCheck.length > 0 && (
            <p className="lu-resv-tocheck">
              <span className="lu-tag is-new">{s.resvNew} · {toCheck.length}</span>
              <span className="lu-hint">{s.resvCheckHint}</span>
              {toCheck.length > 1 && <button type="button" className="lu-btn lu-btn-sm" onClick={checkAll}>✓ {s.resvCheckAll}</button>}
            </p>
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
              <BookingRow key={r.id} r={r} s={s} locale={locale} to={`${showUrl}/${r.id}`} current={r.id === selected?.id} flag={match(r.email)} isNew={needsCheck(r)} />
            ))}
          </ul>
        </div>

        {selected && (
          <BookingPane key={selected.id} r={selected} s={s} locale={locale} flag={match(selected.email)} isNew={needsCheck(selected)}
            showTitle={`${event.date} · ${showName(event, locale)}`} closeTo={showUrl}
            prevTo={prev && `${showUrl}/${prev.id}`} nextTo={next && `${showUrl}/${next.id}`} nextNewTo={nextNew && `${showUrl}/${nextNew.id}`}
            onChange={fields => change(selected, fields)} onReplace={replace} onError={setError} />
        )}
      </div>
      {!door && resv && !selected && <p className="lu-empty">{s.noResults}</p>}
    </div>
  );
}

/** Tags that say where a booking stands (new, flagged, cancelled, arrived, not emailed, how it came in). */
function BookingTags({ r, s, flag, isNew }: { r: Reservation; s: AdminStrings; flag?: SenderMatch; isNew?: boolean }) {
  const cancelled = r.status === 'cancelled';
  return (
    <>
      {isNew && <span className="lu-tag is-new">{s.resvNew}</span>}
      {flag && <span className="lu-tag is-warn" title={s.resvFlagTip}><Icon name="warn" /> {flag.kind === 'filtered' ? s.resvFlagFiltered : s.filterLookalike}</span>}
      {cancelled && <span className="lu-tag is-muted">{s.resvCancelled}</span>}
      {r.arrived === 'TRUE' && <span className="lu-tag is-ok">✓ {s.resvArrived}</span>}
      {/* Has an address but no confirmation went out (failed, or added by hand without it); filtered senders are flagged above */}
      {!cancelled && r.email && r.emailed !== 'yes' && r.emailed !== 'held' && <span className="lu-tag is-new" title={r.emailed === 'no' ? s.resvEmailFailedTip : undefined}><Icon name="mail" /> {s.resvNotEmailed}</span>}
      {r.source === 'admin' && <span className="lu-tag is-muted">{s.resvByHand}</span>}
      {r.source === 'form' && <span className="lu-tag is-muted" title={s.resvFromFormTip}>{s.resvFromForm}</span>}
    </>
  );
}

function BookingRow({ r, s, locale, to, current, flag, isNew }: {
  r: Reservation; s: AdminStrings; locale: AdminLocale; to: string; current: boolean; flag?: SenderMatch; isNew?: boolean;
}) {
  const cancelled = r.status === 'cancelled';
  return (
    <li className={[cancelled ? 'is-done' : '', isNew ? 'is-fresh' : '', current ? 'is-current' : ''].filter(Boolean).join(' ') || undefined}>
      <Link to={to} className="lu-list-row lu-resv-row" aria-current={current ? 'true' : undefined}>
        <span className="lu-resv-count">{ticketsOf(r)}</span>
        <span className="lu-list-main">
          <strong>{r.name}{r.kana && <small className="lu-resv-kana">{r.kana}</small>}</strong>
          <span className="lu-snippet">{r.note ? <><span className="lu-resv-hasnote" aria-label={s.resvTheirNote}>💬</span> {r.note}</> : r.email}</span>
        </span>
        <span className="lu-list-tags">
          <BookingTags r={r} s={s} flag={flag} isNew={isNew} />
          <time dateTime={r.received_at} title={s.resvBookedAt} className="lu-resv-when">{when(r.received_at, locale)}</time>
        </span>
      </Link>
    </li>
  );
}

/** One booking, beside the list (or on its own page on a phone): their note, an email to them, its history, its details. */
function BookingPane({ r, s, locale, flag, isNew, showTitle, closeTo, prevTo, nextTo, nextNewTo, onChange, onReplace, onError }: {
  r: Reservation; s: AdminStrings; locale: AdminLocale; flag?: SenderMatch; isNew?: boolean;
  showTitle: string; closeTo: string; prevTo?: string; nextTo?: string; nextNewTo?: string;
  onChange: (f: Partial<Reservation>) => Promise<void>; onReplace: (r: Reservation) => void; onError: (msg: string) => void;
}) {
  const [draft, setDraft] = useState({ name: r.name, kana: r.kana || '', email: r.email, tickets: r.tickets, note: r.note, locale: langOf(r) });
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [askCancel, setAskCancel] = useState(false);
  useEffect(() => { setDraft({ name: r.name, kana: r.kana || '', email: r.email, tickets: r.tickets, note: r.note, locale: langOf(r) }); }, [r]);
  const cancelled = r.status === 'cancelled';
  const dirty = draft.name !== r.name || draft.kana !== (r.kana || '') || draft.email !== r.email || draft.tickets !== r.tickets || draft.note !== r.note || draft.locale !== langOf(r);
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  return (
    <section className="lu-resv-pane" aria-label={r.name}>
      <div className="lu-resv-pane-nav">
        <Link to={closeTo} className="lu-btn lu-btn-sm lu-btn-quiet lu-resv-back">← <span>{s.resvBack}</span></Link>
        <span className="lu-resv-pane-show">{showTitle}</span>
        <span className="lu-resv-pane-step">
          {prevTo ? <Link to={prevTo} className="lu-btn lu-btn-sm lu-btn-quiet" title={`${s.resvPrev} (↑)`} aria-label={s.resvPrev}>↑</Link> : <span className="lu-btn lu-btn-sm lu-btn-quiet is-off" aria-hidden="true">↑</span>}
          {nextTo ? <Link to={nextTo} className="lu-btn lu-btn-sm lu-btn-quiet" title={`${s.resvNext} (↓)`} aria-label={s.resvNext}>↓</Link> : <span className="lu-btn lu-btn-sm lu-btn-quiet is-off" aria-hidden="true">↓</span>}
          <Link to={closeTo} className="lu-btn lu-btn-sm lu-btn-quiet lu-resv-close" title={s.close} aria-label={s.close}>✕</Link>
        </span>
      </div>

      <header className="lu-resv-pane-head">
        <span className="lu-resv-count is-big">{ticketsOf(r)}</span>
        <div>
          <div className="lu-resv-pane-name">
            <h2>{r.name}</h2>
            {/* Where it stands, right by the name */}
            <span className="lu-list-tags"><BookingTags r={r} s={s} flag={flag} isNew={isNew} /></span>
          </div>
          {r.kana && <p className="lu-resv-kana">{r.kana}</p>}
          <p className="lu-hint">{[r.email, when(r.received_at, locale)].filter(Boolean).join(' · ')}</p>
        </div>
      </header>

      {r.note && (
        <blockquote className="lu-resv-note">
          <span className="lu-resv-note-label">💬 {s.resvTheirNote}</span>
          <p>{r.note}</p>
        </blockquote>
      )}
      {flag && <p className="lu-alert lu-filter-banner is-warn"><Icon name="warn" /> {flag.kind === 'filtered' ? s.resvFlagFilteredBody : s.resvFlagLookalikeBody.replace('{email}', flag.listed)}</p>}

      {((r.source === 'web' && !cancelled) || cancelled) && (
        <div className="lu-resv-pane-actions">
          {r.source === 'web' && !cancelled && (isNew ? (
            <button type="button" className="lu-btn lu-btn-ok" disabled={busy} onClick={() => run(() => onChange({ checked: 'TRUE' }))}>✓ {s.resvCheck}</button>
          ) : (
            <>
              {/* Checked: straight on to the next one nobody has looked at */}
              {nextNewTo && <Link to={nextNewTo} className="lu-btn lu-btn-ok">{s.resvNextNew} →</Link>}
              <button type="button" className="lu-btn lu-btn-quiet" disabled={busy} onClick={() => run(() => onChange({ checked: '' }))}>{s.resvUncheck}</button>
            </>
          ))}
          {cancelled && <button type="button" className="lu-btn" disabled={busy} onClick={() => run(() => onChange({ status: '' }))}>{s.resvRestore}</button>}
        </div>
      )}

      {r.email && flag?.kind !== 'filtered' && !cancelled && (
        <MailComposer r={r} s={s} onSent={onReplace} onError={onError} />
      )}

      <div className="lu-resv-pane-section">
        <h3>{s.resvLogTitle}</h3>
        <BookingLog r={r} s={s} locale={locale} onOpenMail={setViewing} />
        <p className="lu-hint">
          {r.source === 'form' ? s.resvFromFormTip : r.emailed === 'yes' ? '' : r.emailed === 'held' ? s.resvEmailHeld : r.emailed === 'no' ? s.resvNotEmailed : r.source === 'admin' ? s.resvByHand : ''}
        </p>
      </div>

      <div className="lu-resv-pane-section">
        <h3>{s.resvDetails}</h3>
        <div className="lu-resv-edit-grid">
          <label className="lu-field"><span>{s.resvName}</span><input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} /></label>
          <label className="lu-field"><span>{s.resvKana}</span><input lang="ja" value={draft.kana} placeholder={s.resvKanaHint} onChange={e => setDraft(d => ({ ...d, kana: e.target.value }))} onBlur={() => setDraft(d => ({ ...d, kana: toKatakana(d.kana) }))} /></label>
          <label className="lu-field lu-resv-edit-wide"><span>{s.resvEmail}</span><input type="email" value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} /></label>
          <label className="lu-field"><span>{s.resvMailLang}</span>
            <select value={draft.locale} onChange={e => setDraft(d => ({ ...d, locale: e.target.value as 'ja' | 'en' }))}>
              <option value="ja">日本語</option><option value="en">English</option>
            </select>
          </label>
          <label className="lu-field"><span>{s.resvCount}</span><input type="number" min={1} inputMode="numeric" value={draft.tickets} onChange={e => setDraft(d => ({ ...d, tickets: e.target.value }))} /></label>
          <label className="lu-field lu-resv-edit-wide"><span>{s.resvNote}</span><textarea rows={2} value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} /></label>
        </div>
        <p className="lu-hint">{s.resvMailLangHint}</p>
        <div className="lu-resv-edit-actions">
          <button type="button" className="lu-btn lu-btn-primary" disabled={!dirty || busy} onClick={() => run(() => onChange(draft))}>{s.save}</button>
          {/* Kept away from the everyday buttons up top, so it's never hit by mistake */}
          {!cancelled && <button type="button" className="lu-btn lu-btn-danger-quiet lu-resv-cancel" disabled={busy} onClick={() => setAskCancel(true)}>{s.resvCancel}</button>}
        </div>
        <ConfirmDialog s={s} open={askCancel} title={s.resvCancelTitle.replace('{name}', r.name)} body={s.resvCancelBody}
          confirmLabel={s.resvCancel} cancelLabel={s.resvKeep} onCancel={() => setAskCancel(false)}
          onConfirm={() => { setAskCancel(false); run(() => onChange({ status: 'cancelled' })); }} />
      </div>
      {viewing && <SentMailViewer mailId={viewing} s={s} locale={locale} onClose={() => setViewing(null)} />}
    </section>
  );
}

const DRAFT_KEY = (id: string) => `admin-resv-draft:${id}`;

/**
 * Writing to a fan: the confirmation email (their booking and the show), with a message of your own at the top
 * (a reply to their note, say) and the subject changed if you like. The preview is the real email, redrawn as you type.
 * An unsent draft is kept on this device until it's sent or cleared.
 */
function MailComposer({ r, s, onSent, onError }: { r: Reservation; s: AdminStrings; onSent: (r: Reservation) => void; onError: (msg: string) => void }) {
  const saved = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY(r.id)) || 'null') as { lang: 'ja' | 'en'; subject: string; message: string } | null; }
    catch { return null; }
  }, [r.id]);
  const [open, setOpen] = useState(!!saved);
  const [lang, setLang] = useState<'ja' | 'en'>(saved?.lang || langOf(r));
  const [subject, setSubject] = useState(saved?.subject || '');   // '' = the template's
  const [message, setMessage] = useState(saved?.message || '');
  const [preview, setPreview] = useState<{ subject: string; html: string; defaultSubject: string } | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);

  // Keep the draft (only once something's been written)
  useEffect(() => {
    try {
      if (open && (subject || message.trim() || lang !== langOf(r))) localStorage.setItem(DRAFT_KEY(r.id), JSON.stringify({ lang, subject, message }));
      else localStorage.removeItem(DRAFT_KEY(r.id));
    } catch { /* private mode */ }
  }, [open, lang, subject, message, r]);

  // Redraw the preview a moment after typing stops
  useEffect(() => {
    if (!open) return;
    let stale = false;
    const t = setTimeout(() => {
      setPreviewError('');
      previewReservationEmail(r.id, { lang, subject, message })
        .then(p => { if (!stale) setPreview(p); })
        .catch(err => { if (!stale) setPreviewError(errorText(err)); });
    }, preview ? 450 : 0);
    return () => { stale = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, r.id, lang, subject, message]);

  function clear() { setSubject(''); setMessage(''); setLang(langOf(r)); }
  async function send() {
    setAsking(false); setSending(true); onError('');
    try {
      onSent(await resendReservation(r.id, { lang, subject, message }));
      try { localStorage.removeItem(DRAFT_KEY(r.id)); } catch { /* private mode */ }
      setSubject(''); setMessage(''); setOpen(false); setPreview(null);
    } catch (err) { onError(errorText(err)); }
    finally { setSending(false); }
  }

  const sendLabel = message.trim() ? s.resvSendMail : r.emailed === 'yes' ? s.resvResend : s.resvSendConfirm;
  if (!open) {
    return (
      <div className="lu-resv-pane-section lu-resv-compose is-closed">
        <button type="button" className={`lu-btn${r.note ? ' lu-btn-primary' : ''}`} onClick={() => setOpen(true)}><Icon name="mail" /> {s.resvWrite}</button>
        <span className="lu-hint">{r.note ? s.resvWriteHintNote : s.resvWriteHint}</span>
      </div>
    );
  }
  return (
    <div className="lu-resv-pane-section lu-resv-compose">
      <h3><Icon name="mail" /> {s.resvWrite}</h3>
      <p className="lu-hint">{s.resvWriteHint}</p>
      <div className="lu-chips" role="group" aria-label={s.resvMailLang}>
        <span className="lu-hint">{s.resvMailLang}</span>
        {(['ja', 'en'] as const).map(l => (
          <button key={l} type="button" className={`lu-pill${lang === l ? ' is-on' : ''}`} aria-pressed={lang === l} onClick={() => setLang(l)}>
            {l === 'ja' ? '日本語' : 'English'}
          </button>
        ))}
      </div>
      <label className="lu-field">
        <span>{s.resvMessage}</span>
        <textarea rows={5} value={message} placeholder={lang === 'ja' ? s.resvMessagePhJa : s.resvMessagePhEn} onChange={e => setMessage(e.target.value)} autoFocus={!saved} />
      </label>
      <label className="lu-field">
        <span>{s.resvMailSubject}</span>
        <input value={subject || preview?.defaultSubject || ''} onChange={e => setSubject(e.target.value === preview?.defaultSubject ? '' : e.target.value)} />
      </label>
      <div className="lu-resv-edit-actions">
        <button type="button" className="lu-btn lu-btn-primary" disabled={sending || !preview} onClick={() => setAsking(true)}><Icon name="mail" /> {sending ? s.resvSending : sendLabel}</button>
        {(subject || message || lang !== langOf(r)) && <button type="button" className="lu-btn lu-btn-quiet" disabled={sending} onClick={clear}>{s.resvMailReset}</button>}
        <button type="button" className="lu-btn lu-btn-quiet" disabled={sending} onClick={() => { clear(); setOpen(false); }}>{s.cancel}</button>
      </div>
      <div className="lu-mail-preview">
        <p className="lu-hint">{s.resvPreviewLabel.replace('{email}', r.email)}</p>
        {preview ? <iframe title={preview.subject} sandbox="" srcDoc={preview.html} />
          : previewError ? <p className="lu-field-error">{previewError}</p> : <p className="lu-loading">{s.loading}</p>}
      </div>
      <ConfirmDialog s={s} open={asking}
        title={(message.trim() ? s.resvSendMailTitle : r.emailed === 'yes' ? s.resvSendAgainTitle : s.resvSendTitle).replace('{name}', r.name)}
        body={s.resvSendBody.replace('{email}', r.email).replace('{lang}', lang === 'en' ? 'English' : '日本語')}
        confirmLabel={sendLabel} tone="primary"
        onCancel={() => setAsking(false)} onConfirm={send} />
    </div>
  );
}

/** A copy of an email that went out, opened from the booking's history. */
function SentMailViewer({ mailId, s, locale, onClose }: { mailId: string; s: AdminStrings; locale: AdminLocale; onClose: () => void }) {
  const [mail, setMail] = useState<SentReservationMail | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { getSentReservationMail(mailId).then(setMail).catch(e => setErr(errorText(e))); }, [mailId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="lu-modal-overlay" onClick={onClose}>
      <div className="lu-modal lu-modal-wide" role="dialog" aria-modal="true" aria-label={mail?.subject || s.resvViewMail} onClick={e => e.stopPropagation()}>
        {mail ? (
          <div className="lu-mail-preview">
            <h3>{mail.subject}</h3>
            <p className="lu-hint">
              {s.resvMailTo} {mail.to} · {when(mail.sent_at, locale)}{mail.who ? ` · ${whoName(mail.who)}` : ''} · {mail.lang === 'en' ? 'English' : '日本語'}
            </p>
            <iframe title={mail.subject} sandbox="" srcDoc={mail.html} />
          </div>
        ) : err ? <p className="lu-field-error">{err}</p> : <p className="lu-loading">{s.loading}</p>}
        <div className="lu-modal-actions">
          <button type="button" className="lu-btn" onClick={onClose} autoFocus>{s.close}</button>
        </div>
      </div>
    </div>
  );
}

function AddForm({ s, eventId, onAdded, onCancel, onError }: {
  s: AdminStrings; eventId: string;
  onAdded: (r: Reservation) => void; onCancel: () => void; onError: (msg: string) => void;
}) {
  const [f, setF] = useState({ name: '', kana: '', email: '', tickets: '1', note: '', locale: 'ja' });
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
        <label className="lu-field"><span>{s.resvMailLang}</span>
          <select value={f.locale} onChange={e => setF(x => ({ ...x, locale: e.target.value }))}>
            <option value="ja">日本語</option><option value="en">English</option>
          </select>
        </label>
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
