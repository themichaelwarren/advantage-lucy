/**
 * Contact form messages: validation, spam checks, storage in a private
 * "Messages" tab of the band's Google Sheet, and the email notification.
 *
 * Used by the live function (functions/api/contact.ts) and by the local dev
 * server (server/vite-plugin-sheets.ts), so both behave the same.
 *
 * Messages are written with valueInputOption=RAW: text from the public must
 * never be interpreted as a spreadsheet formula (e.g. a message starting
 * with "=").
 */
import { getAccessToken } from './auth';
import { fetchSheet, rowsToObjects, fetchEvents } from './sheets';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
export const MESSAGES_TAB = 'Messages';
export const MESSAGE_COLUMNS = [
  'id', 'received_at', 'locale', 'greeting', 'name_family', 'name_given', 'email', 'message', 'notified',
  'topic', 'event', 'attachments',
] as const;

// The "Say hello" options, kept from the original Tally form
export const GREETINGS = ['hi', 'hey', 'hello', 'hello again', 'ヤッホー', 'こんにちは', 'こんにづは', 'どうも'];

export interface ContactInput {
  locale?: string;
  greeting?: string;
  name_family?: string;
  name_given?: string;
  email?: string;
  message?: string;
  topic?: string;          // 'contact' (default) or 'setlist'
  event?: string;          // show id, for setlist info
  event_title?: string;    // show name, for the email subject
  website?: string;        // honeypot: real people never see or fill this
  started_at?: number;     // ms epoch when the form was shown
  turnstile_token?: string;
}

export interface ContactMessage {
  id: string;
  received_at: string;
  locale: 'en' | 'ja';
  greeting: string;
  name_family: string;
  name_given: string;
  email: string;
  message: string;
  topic: 'contact' | 'setlist';
  event: string;
  event_title: string;
  attachments?: string; // comma-separated private file names
}

export type Checked =
  | { ok: true; message: ContactMessage; spam: false }
  | { ok: true; spam: true }  // pretend success to bots; store nothing
  | { ok: false; error: string; field?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Validate and normalise a submission. Field errors use stable codes the form translates. */
export function checkContact(input: ContactInput, now = Date.now()): Checked {
  // Bots: filled the hidden field, or submitted faster than a person could
  if (input.website) return { ok: true, spam: true };
  if (typeof input.started_at === 'number' && now - input.started_at < 3000) return { ok: true, spam: true };

  const clean = (v: unknown, max: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
  const name_family = clean(input.name_family, 100);
  const name_given = clean(input.name_given, 100);
  const email = clean(input.email, 254);
  const message = clean(input.message, 5000);
  const greeting = GREETINGS.includes(String(input.greeting)) ? String(input.greeting) : 'hello';
  const locale = input.locale === 'ja' ? 'ja' : 'en';
  const topic = input.topic === 'setlist' ? 'setlist' : 'contact';
  const event = clean(input.event, 120).replace(/[^a-z0-9-]/gi, '');
  const event_title = clean(input.event_title, 200);

  if (topic === 'setlist') {
    // Setlist info: only the setlist is required; name and email are optional
    if (!event) return { ok: false, error: 'required', field: 'event' };
    if (!message) return { ok: false, error: 'required', field: 'message' };
    if (email && !EMAIL_RE.test(email)) return { ok: false, error: 'email', field: 'email' };
  } else {
    // Family name is optional (plenty of people give one name)
    if (!name_given) return { ok: false, error: 'required', field: 'name_given' };
    if (!EMAIL_RE.test(email)) return { ok: false, error: 'email', field: 'email' };
    if (!message) return { ok: false, error: 'required', field: 'message' };
  }

  const received_at = new Date(now).toISOString();
  const id = `${received_at.slice(0, 19).replace(/[-:T]/g, '')}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    ok: true, spam: false,
    message: { id, received_at, locale, greeting, name_family, name_given, email, message, topic, event, event_title },
  };
}

/** Optional Cloudflare Turnstile check; skipped when no secret is configured. */
export async function verifyTurnstile(secret: string | undefined, token: string | undefined, ip?: string | null): Promise<boolean> {
  if (!secret) return true;
  if (!token) return false;
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const data = await res.json() as { success?: boolean };
  return !!data.success;
}

async function sheetsFetch(token: string, url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Sheets API error: ${res.status} ${await res.text()}`);
  return res.json() as Promise<any>;
}

/** Create the Messages tab (with its header row) the first time it's needed. */
async function ensureMessagesTab(sheetId: string, token: string) {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
  const meta = await sheetsFetch(token, `${base}?fields=sheets.properties.title`);
  const exists = meta.sheets?.some((s: any) => s.properties?.title === MESSAGES_TAB);
  if (exists) {
    // Older tabs may predate newer columns: bring the header row up to date
    const head = await sheetsFetch(token, `${base}/values/${encodeURIComponent(`${MESSAGES_TAB}!1:1`)}`);
    if ((head.values?.[0]?.length || 0) < MESSAGE_COLUMNS.length) {
      await sheetsFetch(token, `${base}/values/${encodeURIComponent(`${MESSAGES_TAB}!A1`)}?valueInputOption=RAW`, {
        method: 'PUT',
        body: JSON.stringify({ values: [[...MESSAGE_COLUMNS]] }),
      });
    }
    return;
  }
  await sheetsFetch(token, `${base}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: MESSAGES_TAB } } }] }),
  });
  await sheetsFetch(token, `${base}/values/${encodeURIComponent(`${MESSAGES_TAB}!A1`)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[...MESSAGE_COLUMNS]] }),
  });
}

export async function saveMessage(sheetId: string, saEmail: string, saKey: string, m: ContactMessage, notified: string) {
  const token = await getAccessToken(saEmail, saKey, SCOPE);
  await ensureMessagesTab(sheetId, token);
  const row: Record<string, string> = { ...m, notified };
  delete row.event_title; // only used for the email subject
  const values = MESSAGE_COLUMNS.map(c => row[c] ?? '');
  const range = encodeURIComponent(`${MESSAGES_TAB}!A:A`);
  await sheetsFetch(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: [values] }) },
  );
}

/** Newest first. Returns [] if no message has arrived yet (tab not created). */
export async function listMessages(sheetId: string, saEmail: string, saKey: string): Promise<Record<string, string>[]> {
  try {
    const rows = await fetchSheet(sheetId, `${MESSAGES_TAB}!A:L`, saEmail, saKey);
    return rowsToObjects(rows).sort((a, b) => (b.received_at || '').localeCompare(a.received_at || ''));
  } catch (err) {
    if (String(err).includes('Unable to parse range')) return [];
    throw err;
  }
}

/** Extra context for the notification email: links and, for setlist info, the show. */
export interface EmailContext {
  siteUrl?: string; // e.g. https://new.advantagelucy.com (no trailing slash)
  show?: { date: string; end_date?: string; venue: string; area: string; title: string };
}

/** Look up a show's date, venue and area for the email (Japanese names first). */
export async function showForEmail(sheetId: string, saEmail: string, saKey: string, eventId: string): Promise<EmailContext['show']> {
  if (!eventId) return undefined;
  try {
    const events = await fetchEvents(sheetId, saEmail, saKey) as any[];
    const e = events.find(x => x.id === eventId);
    if (!e) return undefined;
    const area = [e.city_ja || e.city_en, e.prefecture_ja || e.prefecture_en].filter(Boolean).join('、');
    return {
      date: e.date,
      end_date: e.end_date,
      venue: e.venue_ja || e.venue_en || '',
      area,
      title: e.title_ja || e.title_en || '',
    };
  } catch {
    return undefined; // the email still goes out, just without the extra details
  }
}

function jaDate(iso: string) {
  const d = new Date(`${iso}T00:00:00+09:00`);
  return new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(d);
}

/** Plain-text and HTML bodies for the notification email to the band (in Japanese: the band reads these). */
export function notificationEmail(m: ContactMessage, ctx: EmailContext = {}) {
  const name = `${m.name_family} ${m.name_given}`.trim() || '匿名';
  const when = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(m.received_at));
  const pageLang = m.locale === 'ja' ? '日本語ページ' : '英語ページ';
  const photos = m.attachments ? m.attachments.split(',').filter(Boolean).length : 0;
  const isSetlist = m.topic === 'setlist';
  const show = ctx.show;
  const showName = show?.title || show?.venue || m.event_title || m.event;
  const showDate = show ? (show.end_date ? `${jaDate(show.date)}〜${jaDate(show.end_date)}` : jaDate(show.date)) : '';

  // Links (all to the Japanese pages: the band reads these)
  const base = (ctx.siteUrl || '').replace(/\/$/, '');
  const links = base ? {
    message: `${base}/ja/admin/messages?open=${encodeURIComponent(m.id)}`,
    showPage: isSetlist && m.event ? `${base}/ja/events/${encodeURIComponent(m.event)}` : '',
    setlistEditor: isSetlist && m.event ? `${base}/ja/admin/events/${encodeURIComponent(m.event)}#setlist` : '',
  } : null;

  const subject = isSetlist
    ? `♪ セットリスト情報：${showName}${show ? `（${show.date}）` : ''} — ${name}より`
    : `💌 ${m.greeting} — ${name}（サイトからのお問い合わせ）`;
  const heading = isSetlist
    ? `ライブ「${showName}」について、セットリスト情報が届きました。`
    : 'サイトのお問い合わせフォームから新しいメッセージが届きました。';
  const footer = m.email
    ? `このメールに返信すると、${name}さんに直接届きます。`
    : 'メールアドレスの入力はありませんでした。';
  const photoNote = photos ? `📎 写真${photos}枚が添付されています。` : '';

  const showLines = isSetlist ? [
    `ライブ：${showName}`,
    ...(showDate ? [`日付：${showDate}`] : []),
    ...(show?.venue ? [`会場：${show.venue}${show.area ? `（${show.area}）` : ''}`] : []),
  ] : [];

  const text = [
    heading,
    '',
    `お名前：${name}`,
    `メール：${m.email || '—'}`,
    ...(isSetlist ? showLines : [`あいさつ：${m.greeting}`]),
    `ページの言語：${pageLang}`,
    `受信日時：${when}`,
    '',
    m.message,
    '',
    ...(photoNote ? [photoNote + (links ? '' : ' 管理画面の「メッセージ」から見られます。'), ''] : []),
    ...(links ? [
      `管理画面でメッセージを開く：${links.message}`,
      ...(links.showPage ? [`サイトのライブページ：${links.showPage}`] : []),
      ...(links.setlistEditor ? [`セットリストを編集：${links.setlistEditor}`] : []),
      '',
    ] : []),
    `— ${footer}`,
  ].join('\n');

  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const a = (href: string, label: string) => `<a href="${esc(href)}" style="color:#1d1b16;font-weight:600;text-decoration:underline;text-decoration-color:#ffd43b;text-decoration-thickness:3px;text-underline-offset:3px">${esc(label)}</a>`;
  const button = (href: string, label: string) => `<a href="${esc(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:9px 16px;border:1.5px solid #1d1b16;border-radius:999px;background:#ffd43b;color:#1d1b16;font-weight:700;text-decoration:none">${esc(label)}</a>`;
  const showTable = isSetlist ? `<table style="border-collapse:collapse;margin:0 0 16px;font-size:14px">
${[['ライブ', showName], ['日付', showDate], ['会場', show?.venue ? `${show.venue}${show.area ? `（${show.area}）` : ''}` : '']]
  .filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#6b665b;white-space:nowrap">${k}</td><td style="padding:3px 0">${esc(v!)}</td></tr>`).join('\n')}
</table>` : '';

  const html = `<div style="font-family:'Hiragino Sans','Noto Sans JP',system-ui,sans-serif;font-size:15px;line-height:1.7;color:#1d1b16">
<p style="margin:0 0 12px;color:#6b665b">${esc(heading)}</p>
<p style="margin:0 0 4px"><strong>${esc(name)}</strong>${m.email ? ` &lt;${esc(m.email)}&gt;` : ''}</p>
<p style="margin:0 0 16px;color:#6b665b">${isSetlist ? '' : `「${esc(m.greeting)}」 · `}${pageLang} · ${esc(when)}</p>
${showTable}
<div style="white-space:pre-wrap;padding:14px 16px;border:1px solid #ddd6c8;border-radius:12px;background:#fffdf9">${esc(m.message)}</div>
${photoNote ? `<p style="margin:12px 0 0">${esc(photoNote)} ${links ? a(links.message, '管理画面の「メッセージ」で見る') : '管理画面の「メッセージ」から見られます。'}</p>` : ''}
${links ? `<p style="margin:18px 0 0">${button(links.message, '管理画面で開く')}${links.setlistEditor ? button(links.setlistEditor, 'セットリストを編集') : ''}${links.showPage ? button(links.showPage, 'ライブページを見る') : ''}</p>` : ''}
<p style="margin:16px 0 0;color:#6b665b;font-size:13px">${esc(footer)}</p>
</div>`;
  return { subject, text, html, replyTo: m.email || undefined };
}
