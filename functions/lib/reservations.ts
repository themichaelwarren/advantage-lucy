/**
 * Ticket reservations (取り置き) for shows, replacing the per-show Google Form.
 *
 * A show takes reservations when its "reserve" column is TRUE. Optional:
 *   reserve_cap    total tickets that can be reserved (blank = no limit)
 *   reserve_max    most tickets one person can reserve (blank = 4)
 *   reserve_until  when the form closes, Japan time (blank = 23:59 the day before the show)
 *
 * Bookings live in a private "Reservations" tab of the band's sheet (created
 * on first use), never in the public API. The fan gets a confirmation email
 * straight away, which is the "you're good to go" reply the band used to
 * send by hand; the band gets a short notification.
 *
 * The same request handlers run on Cloudflare (functions/api/reserve.ts,
 * functions/api/admin/reservations.ts) and on the local dev server
 * (server/vite-plugin-sheets.ts).
 *
 * Text from the public is written with valueInputOption=RAW, so it's never
 * read as a spreadsheet formula.
 */
import { getAccessToken } from './auth';
import { fetchSheet, rowsToObjects, fetchEvents } from './sheets';
import { verifyTurnstile } from './messages';
import { allowSubmission } from './attachments';
import { sendEmail, type NotifyEnv } from './notify';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
export const RESERVATIONS_TAB = 'Reservations';
export const RESERVATION_COLUMNS = [
  'id', 'event', 'received_at', 'locale', 'name', 'email', 'tickets', 'note',
  'status',   // '' = booked, 'cancelled'
  'emailed',  // 'yes' once the confirmation email went out, 'no' if it failed, '' if none was sent (added by hand)
  'arrived',  // 'TRUE' once checked in at the door
  'source',   // 'web', 'admin' or 'form' (imported from the old Google Form)
  'kana',     // フリガナ of a Japanese name (katakana), for sorting and the door list
] as const;
export type Reservation = Record<typeof RESERVATION_COLUMNS[number], string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface ReserveContext {
  sheetId: string;
  saEmail: string;
  saKey: string;
  env: NotifyEnv & { TURNSTILE_SECRET?: string };
  siteUrl: string;
}

type Show = Awaited<ReturnType<typeof fetchEvents>>[number] & {
  reserve?: boolean; reserve_cap?: string; reserve_max?: string; reserve_until?: string;
};

// The open/closed/full rules live in visibility.ts so the admin can use them too
export { reserveCloses, reserveState, DEFAULT_MAX_PER_BOOKING, type ReserveState } from './visibility';
import { reserveState } from './visibility';
import { loadFilters, matchSender, type SenderMatch } from './filters';
import { showPrice } from './price';
import { toKatakana, isKatakana, needsKana } from './kana';
export const ticketsOf = (r: Pick<Reservation, 'tickets'>) => Math.max(0, parseInt(r.tickets, 10) || 0);
export const isActive = (r: Pick<Reservation, 'status'>) => r.status !== 'cancelled';

export interface ReserveInput {
  event?: string;
  locale?: string;
  name?: string;
  kana?: string;
  email?: string;
  tickets?: number | string;
  note?: string;
  website?: string;       // honeypot
  started_at?: number;    // ms epoch when the form was shown
  turnstile_token?: string;
}

type Checked =
  | { ok: true; spam: true }
  | { ok: true; spam: false; value: { event: string; locale: 'en' | 'ja'; name: string; kana: string; email: string; tickets: number; note: string } }
  | { ok: false; error: string; field?: string };

export function checkReservation(input: ReserveInput, now = Date.now()): Checked {
  if (input.website) return { ok: true, spam: true };
  if (typeof input.started_at === 'number' && now - input.started_at < 3000) return { ok: true, spam: true };
  const clean = (v: unknown, max: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
  const event = clean(input.event, 120).replace(/[^a-z0-9-]/gi, '');
  const name = clean(input.name, 100);
  const email = clean(input.email, 254);
  const note = clean(input.note, 1000);
  const tickets = Number(input.tickets);
  if (!event) return { ok: false, error: 'required', field: 'event' };
  if (!name) return { ok: false, error: 'required', field: 'name' };
  // A Japanese name with kanji needs its reading (フリガナ), in katakana (hiragana is converted)
  const kana = toKatakana(clean(input.kana, 100));
  if (kana && !isKatakana(kana)) return { ok: false, error: 'kana', field: 'kana' };
  if (!kana && input.locale === 'ja' && needsKana(name)) return { ok: false, error: 'kana_required', field: 'kana' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'email', field: 'email' };
  if (!Number.isInteger(tickets) || tickets < 1) return { ok: false, error: 'tickets', field: 'tickets' };
  return { ok: true, spam: false, value: { event, locale: input.locale === 'ja' ? 'ja' : 'en', name, kana, email, tickets, note } };
}

// ── Sheet ────────────────────────────────────────────────────────────────

async function sheetsFetch(token: string, url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Sheets API error: ${res.status} ${await res.text()}`);
  return res.json() as Promise<any>;
}

const lastCol = String.fromCharCode(64 + RESERVATION_COLUMNS.length); // L

let headingChecked = false;
async function ensureTab(sheetId: string, token: string) {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
  const meta = await sheetsFetch(token, `${base}?fields=sheets.properties.title`);
  if (meta.sheets?.some((s: any) => s.properties?.title === RESERVATIONS_TAB)) {
    // Columns added since the tab was made (kana): write the full heading row once
    if (headingChecked) return;
    const head = await sheetsFetch(token, `${base}/values/${encodeURIComponent(`${RESERVATIONS_TAB}!1:1`)}`);
    const have: string[] = head.values?.[0] || [];
    if (have.length < RESERVATION_COLUMNS.length && RESERVATION_COLUMNS.slice(0, have.length).every((c, i) => have[i] === c)) {
      await sheetsFetch(token, `${base}/values/${encodeURIComponent(`${RESERVATIONS_TAB}!A1`)}?valueInputOption=RAW`, {
        method: 'PUT', body: JSON.stringify({ values: [[...RESERVATION_COLUMNS]] }),
      });
    }
    headingChecked = true;
    return;
  }
  await sheetsFetch(token, `${base}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: RESERVATIONS_TAB } } }] }),
  });
  await sheetsFetch(token, `${base}/values/${encodeURIComponent(`${RESERVATIONS_TAB}!A1`)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[...RESERVATION_COLUMNS]] }),
  });
}

/** Every booking (cancelled ones too), oldest first. [] before the first one. */
export async function listReservations(sheetId: string, saEmail: string, saKey: string): Promise<Reservation[]> {
  try {
    const rows = await fetchSheet(sheetId, `${RESERVATIONS_TAB}!A:${lastCol}`, saEmail, saKey);
    return (rowsToObjects(rows) as Reservation[])
      .filter(r => r.id)
      .map(r => Object.fromEntries(RESERVATION_COLUMNS.map(c => [c, r[c] ?? ''])) as Reservation)
      .sort((a, b) => a.received_at.localeCompare(b.received_at));
  } catch (err) {
    if (String(err).includes('Unable to parse range')) return [];
    throw err;
  }
}

async function appendReservation(sheetId: string, saEmail: string, saKey: string, r: Reservation) {
  const token = await getAccessToken(saEmail, saKey, SCOPE);
  await ensureTab(sheetId, token);
  const range = encodeURIComponent(`${RESERVATIONS_TAB}!A:A`);
  await sheetsFetch(token,
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: [RESERVATION_COLUMNS.map(c => r[c] ?? '')] }) });
}

/** Change some fields of one booking (found by id); the rest of its row is kept. */
export async function updateReservation(sheetId: string, saEmail: string, saKey: string, id: string, fields: Partial<Reservation>): Promise<Reservation> {
  if (!id?.trim()) throw new Error('Missing reservation id');
  const token = await getAccessToken(saEmail, saKey, SCOPE);
  await ensureTab(sheetId, token); // newer columns (kana) get their heading
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
  const data = await sheetsFetch(token, `${base}/values/${encodeURIComponent(`${RESERVATIONS_TAB}!A:${lastCol}`)}`);
  const rows = (data.values as string[][] | undefined) || [];
  const index = rows.findIndex((r, i) => i > 0 && r[0] === id);
  if (index < 1) throw new Error(`Reservation "${id}" not found`);
  const current = Object.fromEntries(RESERVATION_COLUMNS.map((c, i) => [c, rows[index][i] ?? ''])) as Reservation;
  const next: Reservation = { ...current };
  for (const c of RESERVATION_COLUMNS) {
    if (c !== 'id' && fields[c] !== undefined) next[c] = String(fields[c]);
  }
  const range = encodeURIComponent(`${RESERVATIONS_TAB}!A${index + 1}:${lastCol}${index + 1}`);
  await sheetsFetch(token, `${base}/values/${range}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [RESERVATION_COLUMNS.map(c => next[c])] }),
  });
  return next;
}

function newId(now = new Date()) {
  return `r${now.toISOString().slice(0, 19).replace(/[-:T]/g, '')}-${Math.random().toString(36).slice(2, 7)}`;
}

async function findShow(ctx: ReserveContext, id: string): Promise<Show | undefined> {
  const events = await fetchEvents(ctx.sheetId, ctx.saEmail, ctx.saKey) as Show[];
  return events.find(e => e.id === id);
}

const takenFor = (all: Reservation[], eventId: string, exceptId?: string) =>
  all.filter(r => r.event === eventId && isActive(r) && r.id !== exceptId).reduce((n, r) => n + ticketsOf(r), 0);

// ── Emails ───────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function showFacts(show: Show, locale: 'en' | 'ja') {
  const ja = locale === 'ja';
  const pick = (en?: string, j?: string) => (ja ? j || en : en || j) || '';
  const d = new Date(`${show.date}T00:00:00+09:00`);
  const date = new Intl.DateTimeFormat(ja ? 'ja-JP' : 'en-GB', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', weekday: ja ? 'short' : 'long',
  }).format(d);
  const times = [
    show.doors && `${ja ? '開場' : 'Doors'} ${show.doors}`,
    show.start && `${ja ? '開演' : 'Start'} ${show.start}`,
  ].filter(Boolean).join(' / ');
  const yen = (v?: string) => (v ? showPrice(v, '¥', ja ? '入場無料' : 'Free') : '');
  const price = [
    show.adv_price && `${ja ? '前売' : 'Advance'} ${yen(show.adv_price)}`,
    show.door_price && `${ja ? '当日' : 'Door'} ${yen(show.door_price)}`,
  ].filter(Boolean).join(' / ');
  const venue = pick(show.venue_en, show.venue_ja);
  const area = pick(show.city_en, show.city_ja);
  return {
    title: pick(show.title_en, show.title_ja) || venue,
    date, times, price,
    venue: area ? `${venue}${ja ? `（${area}）` : ` (${area})`}` : venue,
    shortDate: `${Number(show.date.slice(5, 7))}/${Number(show.date.slice(8, 10))}`,
    venueName: venue,
  };
}

const wrap = (inner: string) => `<div style="font-family:'Hiragino Sans','Noto Sans JP',system-ui,sans-serif;font-size:15px;line-height:1.7;color:#1d1b16">${inner}</div>`;
const table = (rows: [string, string][]) => `<table style="border-collapse:collapse;margin:0 0 16px;font-size:15px">
${rows.filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#6b665b;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join('\n')}
</table>`;
const button = (href: string, label: string) => `<a href="${esc(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:9px 16px;border:1.5px solid #1d1b16;border-radius:999px;background:#ffd43b;color:#1d1b16;font-weight:700;text-decoration:none">${esc(label)}</a>`;

/** The confirmation the fan gets: their booking and the show details. */
export function confirmationEmail(r: Reservation, show: Show, siteUrl: string) {
  const ja = r.locale === 'ja';
  const f = showFacts(show, ja ? 'ja' : 'en');
  const page = `${siteUrl.replace(/\/$/, '')}/${ja ? 'ja' : 'en'}/events/${encodeURIComponent(show.id)}`;
  const n = ticketsOf(r);
  const rows: [string, string][] = ja
    ? [['ライブ', f.title], ['日時', f.date], ['時間', f.times], ['会場', f.venue], ['料金', f.price], ['お名前', r.name], ['枚数', `${n}枚`]]
    : [['Show', f.title], ['Date', f.date], ['Time', f.times], ['Venue', f.venue], ['Price', f.price], ['Name', r.name], ['Tickets', String(n)]];
  const subject = ja
    ? `【ご予約ありがとうございます】${f.shortDate} ${f.venueName} — advantage Lucy`
    : `Your reservation: advantage Lucy, ${f.date} at ${f.venueName}`;
  const lines = ja ? [
    `${r.name} 様`,
    '',
    'advantage Lucy のライブのご予約ありがとうございます。以下の内容で承りました。',
    '',
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}：${v}`),
    '',
    '当日は受付で「advantage Lucy の予約」とお名前をお伝えください。お支払いは当日、受付でお願いします。',
    '枚数の変更やキャンセルは、このメールにご返信ください。',
    '',
    `ライブの詳細：${page}`,
    '',
    '当日お会いできるのを楽しみにしています！',
    'advantage Lucy',
  ] : [
    `Hi ${r.name},`,
    '',
    'Thanks for reserving tickets for advantage Lucy. You’re all set:',
    '',
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    '',
    'At the door, say you have a reservation for advantage Lucy and give your name. You pay at the door on the night.',
    'To change the number of tickets or cancel, just reply to this email.',
    '',
    `Show details: ${page}`,
    '',
    'See you there!',
    'advantage Lucy',
  ];
  const text = lines.join('\n');
  const html = wrap(ja ? `
<p style="margin:0 0 12px">${esc(r.name)} 様</p>
<p style="margin:0 0 16px">advantage Lucy のライブのご予約ありがとうございます。以下の内容で承りました。</p>
${table(rows)}
<p style="margin:0 0 8px">当日は受付で「advantage Lucy の予約」とお名前をお伝えください。お支払いは当日、受付でお願いします。</p>
<p style="margin:0 0 16px;color:#6b665b">枚数の変更やキャンセルは、このメールにご返信ください。</p>
<p style="margin:0 0 16px">${button(page, 'ライブの詳細を見る')}</p>
<p style="margin:0">当日お会いできるのを楽しみにしています！<br>advantage Lucy</p>` : `
<p style="margin:0 0 12px">Hi ${esc(r.name)},</p>
<p style="margin:0 0 16px">Thanks for reserving tickets for advantage Lucy. You’re all set:</p>
${table(rows)}
<p style="margin:0 0 8px">At the door, say you have a reservation for advantage Lucy and give your name. You pay at the door on the night.</p>
<p style="margin:0 0 16px;color:#6b665b">To change the number of tickets or cancel, just reply to this email.</p>
<p style="margin:0 0 16px">${button(page, 'Show details')}</p>
<p style="margin:0">See you there!<br>advantage Lucy</p>`);
  return { subject, text, html };
}

/** The short note to the band (in Japanese: the band reads these). */
export function bandEmail(r: Reservation, show: Show, totals: { taken: number; cap: number | null }, siteUrl: string, updated: boolean) {
  const f = showFacts(show, 'ja');
  const admin = `${siteUrl.replace(/\/$/, '')}/ja/admin/reservations/${encodeURIComponent(show.id)}`;
  const total = totals.cap ? `${totals.taken} / ${totals.cap}枚` : `${totals.taken}枚`;
  const subject = `🎫 ${updated ? '予約の変更' : '予約'}：${f.shortDate} ${f.venueName} — ${r.name}さん ${ticketsOf(r)}枚（合計 ${total}）`;
  const rows: [string, string][] = [['ライブ', `${f.title}（${f.date}）`], ['お名前', r.name], ['メール', r.email], ['枚数', `${ticketsOf(r)}枚`], ['メモ', r.note], ['合計', total]];
  const text = [
    updated ? '同じメールアドレスからの予約が変更されました。' : 'サイトから新しい予約が入りました。確認メールは自動で送信済みです。',
    '',
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}：${v}`),
    '',
    `予約一覧：${admin}`,
  ].join('\n');
  const html = wrap(`
<p style="margin:0 0 12px;color:#6b665b">${updated ? '同じメールアドレスからの予約が変更されました。' : 'サイトから新しい予約が入りました。確認メールは自動で送信済みです。'}</p>
${table(rows)}
<p style="margin:0">${button(admin, '予約一覧を開く')}</p>`);
  return { subject, text, html };
}

/** Is this booking's address filtered, or a lookalike of one? (null if the list can't be read) */
async function senderMatch(ctx: ReserveContext, email: string): Promise<SenderMatch> {
  if (!email) return null;
  const filters = await loadFilters({ sheetId: ctx.sheetId, saEmail: ctx.saEmail, saKey: ctx.saKey }).catch(() => null);
  return filters ? matchSender(email, filters.emails) : null;
}

/**
 * The confirmation email. Never to a filtered address, whoever asks; a
 * lookalike only when an admin sends it on purpose (after checking).
 */
async function sendConfirmation(ctx: ReserveContext, r: Reservation, show: Show, opts: { lookalikeOk?: boolean; match?: SenderMatch } = {}): Promise<boolean> {
  const match = opts.match !== undefined ? opts.match : await senderMatch(ctx, r.email);
  if (match?.kind === 'filtered' || (match?.kind === 'lookalike' && !opts.lookalikeOk)) return false;
  const mail = confirmationEmail(r, show, ctx.siteUrl);
  const bandTo = (ctx.env.CONTACT_NOTIFY_TO || '').split(',')[0]?.trim();
  try {
    return await sendEmail(ctx.env, { to: [r.email], ...mail, replyTo: bandTo || undefined });
  } catch (err) {
    console.error('[reserve] confirmation failed', err);
    return false;
  }
}

// ── Request handlers ─────────────────────────────────────────────────────

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** GET /api/reserve?event=<id>: is the form open, and up to how many tickets. */
export async function handleReserveGet(url: URL, ctx: ReserveContext): Promise<Response> {
  const id = (url.searchParams.get('event') || '').replace(/[^a-z0-9-]/gi, '');
  if (!id) return json({ state: 'off', max: 0 });
  // Every view of a show page asks this, and Google allows 60 sheet reads a
  // minute: keep the answer for a short while (bookings clear it at once)
  const cache = edgeCache();
  const hit = await cache?.match(stateKey(id));
  if (hit) return new Response(hit.body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

  // Just the Events tab (not the venue/area joins) and the bookings: two reads
  const [eventRows, all] = await Promise.all([
    fetchSheet(ctx.sheetId, 'Events', ctx.saEmail, ctx.saKey),
    listReservations(ctx.sheetId, ctx.saEmail, ctx.saKey),
  ]);
  const row = rowsToObjects(eventRows).find(r => r.id === id);
  const body = !row || !row.date || row.status === 'private'
    ? { state: 'off', max: 0 }
    : (({ state, max, closes }) => ({ state, max, closes }))(reserveState({
        date: row.date, status: row.status, reserve: row.reserve,
        reserve_cap: row.reserve_cap, reserve_max: row.reserve_max, reserve_until: row.reserve_until,
      }, takenFor(all, id)));
  await cache?.put(stateKey(id), new Response(JSON.stringify(body), { headers: { 'Cache-Control': `max-age=${STATE_TTL}` } }));
  return json(body);
}

const STATE_TTL = 30;
const stateKey = (eventId: string) => new Request(`https://reserve-state.internal/${encodeURIComponent(eventId)}`);
const edgeCache = () => (typeof caches === 'undefined' ? null : (caches as unknown as { default: Cache }).default);
/** A booking changed: the next visitor gets fresh numbers. */
async function forgetState(eventId: string) {
  try { await edgeCache()?.delete(stateKey(eventId)); } catch { /* best effort */ }
}

/** POST /api/reserve: book (or change the booking of the same email for the same show). */
export async function handleReservePost(request: Request, ctx: ReserveContext, ip: string | null): Promise<Response> {
  let input: ReserveInput;
  try { input = await request.json(); } catch { return json({ error: 'bad_request' }, 400); }
  const checked = checkReservation(input);
  if ('error' in checked) return json({ error: checked.error, field: checked.field }, 400);
  if (!('value' in checked)) return json({ ok: true, tickets: 0 });   // spam: look successful to bots
  if (!(await allowSubmission(ip))) return json({ error: 'slow_down' }, 429);
  if (!(await verifyTurnstile(ctx.env.TURNSTILE_SECRET, input.turnstile_token, ip))) return json({ error: 'verify' }, 400);

  const v = checked.value;
  try {
    const show = await findShow(ctx, v.event);
    if (!show || show.status === 'private') return json({ error: 'closed' }, 400);
    const all = await listReservations(ctx.sheetId, ctx.saEmail, ctx.saKey);
    // Same email, same show: this replaces their earlier booking instead of adding a second one
    const earlier = all.find(r => r.event === show.id && isActive(r) && r.email.toLowerCase() === v.email.toLowerCase());
    const taken = takenFor(all, show.id, earlier?.id);
    const { state, max, left } = reserveState(show, taken);
    if (state === 'closed' || state === 'off') return json({ error: 'closed' }, 400);
    if (state === 'full') return json({ error: 'full' }, 400);
    if (v.tickets > max) return json({ error: 'too_many', max }, 400);

    const now = new Date();
    const r: Reservation = {
      id: earlier?.id || newId(now),
      event: show.id,
      received_at: now.toISOString(),
      locale: v.locale,
      name: v.name,
      kana: v.kana,
      email: v.email,
      tickets: String(v.tickets),
      note: v.note,
      status: '',
      emailed: '',
      arrived: '',
      source: 'web',
    };
    // Save first: a fan must never get a confirmation for a booking that isn't in the sheet
    if (earlier) await updateReservation(ctx.sheetId, ctx.saEmail, ctx.saKey, earlier.id, { ...r, arrived: earlier.arrived });
    else await appendReservation(ctx.sheetId, ctx.saEmail, ctx.saKey, r);
    await forgetState(show.id);

    // A filtered (or lookalike) address: kept and flagged ⚠ for the band, but no
    // confirmation goes to it. The page looks the same to them as to anyone.
    const match = await senderMatch(ctx, r.email);
    const sent = await sendConfirmation(ctx, r, show, { match });
    await updateReservation(ctx.sheetId, ctx.saEmail, ctx.saKey, r.id, { emailed: match ? 'held' : sent ? 'yes' : 'no' }).catch(() => {});
    const cap = left === null ? null : taken + left;
    try {
      const note = bandEmail(r, show, { taken: taken + v.tickets, cap }, ctx.siteUrl, !!earlier);
      const flag = match?.kind === 'filtered' ? '⚠ フィルター中の送信者からの予約 — ' : match ? '⚠ フィルター中の送信者に似たアドレスからの予約 — ' : '';
      const to = (ctx.env.CONTACT_NOTIFY_TO || '').split(',').map(s => s.trim()).filter(Boolean);
      if (to.length) await sendEmail(ctx.env, { to, ...note, subject: flag + note.subject, ...(match?.kind === 'filtered' ? {} : { replyTo: r.email }) });
    } catch (err) { console.error('[reserve] band email failed', err); }
    return json({ ok: true, tickets: v.tickets, emailed: match ? true : sent, updated: !!earlier });
  } catch (err) {
    console.error('[reserve]', err);
    return json({ error: 'server' }, 500);
  }
}

/**
 * /api/admin/reservations (signed-in admins only)
 *   GET                         every booking
 *   POST  {fields, send_email}  add one by hand (e.g. a booking by DM)
 *   POST  {resend: id}          send the confirmation email again
 *   PATCH {id, fields}          change name, email, tickets, note, status or arrived
 */
export async function handleAdminReservations(request: Request, ctx: ReserveContext): Promise<Response> {
  const { sheetId, saEmail, saKey } = ctx;
  try {
    if (request.method === 'GET') return json({ reservations: await listReservations(sheetId, saEmail, saKey) });
    const body = await request.json() as { id?: string; resend?: string; fields?: Partial<Reservation>; send_email?: boolean };
    const allowed = (f: Partial<Reservation> = {}) => {
      const out: Partial<Reservation> = {};
      for (const c of ['name', 'kana', 'email', 'tickets', 'note', 'status', 'arrived', 'locale'] as const) {
        if (f[c] !== undefined) out[c] = String(f[c]).slice(0, c === 'note' ? 1000 : 254);
      }
      if (out.kana !== undefined) { out.kana = toKatakana(out.kana); if (out.kana && !isKatakana(out.kana)) throw new Error('フリガナ should be in katakana (カタカナ)'); }
      if (out.status !== undefined && !['', 'cancelled'].includes(out.status)) throw new Error(`Unknown status "${out.status}"`);
      if (out.tickets !== undefined && !(parseInt(out.tickets, 10) >= 1)) throw new Error('Tickets must be 1 or more');
      if (out.email && !EMAIL_RE.test(out.email)) throw new Error('That email address doesn’t look right');
      return out;
    };

    if (request.method === 'PATCH') {
      if (!body.id) return json({ error: 'Missing id' }, 400);
      const r = await updateReservation(sheetId, saEmail, saKey, body.id, allowed(body.fields));
      await forgetState(r.event);
      return json({ ok: true, reservation: r });
    }

    if (request.method === 'POST' && body.resend) {
      const all = await listReservations(sheetId, saEmail, saKey);
      const r = all.find(x => x.id === body.resend);
      if (!r) return json({ error: 'Not found' }, 404);
      if (!r.email) return json({ error: 'This booking has no email address' }, 400);
      const show = await findShow(ctx, r.event);
      if (!show) return json({ error: 'Show not found' }, 404);
      const match = await senderMatch(ctx, r.email);
      if (match?.kind === 'filtered') return json({ error: 'This address is on the filtered list, so no email is sent to it.' }, 400);
      const sent = await sendConfirmation(ctx, r, show, { match, lookalikeOk: true });
      const next = await updateReservation(sheetId, saEmail, saKey, r.id, { emailed: sent ? 'yes' : 'no' });
      if (!sent) return json({ error: 'The email couldn’t be sent. Is email set up (RESEND_API_KEY)?' }, 502);
      return json({ ok: true, reservation: next });
    }

    if (request.method === 'POST') {
      const f = allowed(body.fields);
      const event = String(body.fields?.event || '').replace(/[^a-z0-9-]/gi, '');
      if (!event || !f.name?.trim()) return json({ error: 'A show and a name are needed' }, 400);
      const show = await findShow(ctx, event);
      if (!show) return json({ error: 'Show not found' }, 404);
      const r: Reservation = {
        id: newId(), event, received_at: new Date().toISOString(),
        locale: f.locale === 'en' ? 'en' : 'ja',
        name: f.name.trim(), kana: f.kana || '', email: f.email || '', tickets: f.tickets || '1', note: f.note || '',
        status: '', emailed: '', arrived: '', source: 'admin',
      };
      await appendReservation(sheetId, saEmail, saKey, r);
      await forgetState(event);
      if (body.send_email && r.email) {
        r.emailed = (await sendConfirmation(ctx, r, show, { lookalikeOk: true })) ? 'yes' : 'no';
        await updateReservation(sheetId, saEmail, saKey, r.id, { emailed: r.emailed }).catch(() => {});
      }
      return json({ ok: true, reservation: r });
    }
    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
}
