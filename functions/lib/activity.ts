/**
 * The activity log (admin only): every save in the admin, with who made it,
 * when, and what changed, in a private "Activity" tab of the sheet. Nothing
 * here is served by the public /api/sheets/* routes; /api/admin/activity
 * (behind the admin sign-in) reads it.
 *
 * Shared by the admin middleware (functions/api/admin/_middleware.ts) and
 * the dev server (server/vite-plugin-sheets.ts): `planActivity` looks at a
 * write before it happens (reading the row as it was, for the diff), and
 * `recordActivity` appends the entry once the write has worked.
 *
 * One row per save:
 *   at       ISO time (UTC)
 *   who      the signed-in admin's email
 *   action   create | update | delete | replace | reorder | videos | arrangements | filters
 *   tab      the sheet tab (Events, Songs, Setlists…)
 *   item     the row's id (for Setlists/Tracklists/Media: the show, release or song it belongs to)
 *   label    the item's name at the time (so a deleted item still reads)
 *   changes  JSON: [{ f, from?, to? }] (see Change)
 */
import { fetchSheet, rowsToObjects } from './sheets';
import { listPrivate, appendPrivate, json, type SheetContext } from './privateTab';
import { MEDIA_TAB, MEDIA_COLUMNS } from './media';
import { ARR_TAB, ARR_COLUMNS } from './arrangements';
import { LINKS_TAB, LINK_COLUMNS } from './links';
import { NOTES_TAB, NOTE_COLUMNS } from './notes';

export const ACTIVITY_TAB = 'Activity';
export const ACTIVITY_COLUMNS = ['at', 'who', 'action', 'tab', 'item', 'label', 'changes'] as const;
export type ActivityRow = Record<typeof ACTIVITY_COLUMNS[number], string>;

/**
 * One change. A field edit is { f: 'title', from, to }; a long text that
 * changed is { f: 'body_en' } alone. A list (a setlist, a show's videos) is
 * { f: '+', to } per thing added, { f: '-', from } per thing removed, and
 * { f: 'order' } when only the order moved.
 */
export interface Change { f: string; from?: string; to?: string }
export interface Pending { action: string; tab: string; item: string; label: string; changes: Change[] }
export interface WriteInfo { method: string; path: string; query: URLSearchParams; body: any }

type Row = Record<string, string>;
const LONG = 120;
const MAX_CHANGES_JSON = 6000;

// ---------- reading the "before" ----------

async function tabRows(ctx: SheetContext, tab: string): Promise<{ headers: string[]; rows: Row[] }> {
  const raw = await fetchSheet(ctx.sheetId, tab, ctx.saEmail, ctx.saKey);
  return { headers: (raw[0] || []).map(h => String(h).trim()), rows: rowsToObjects(raw) };
}

/** A readable name for a row of any tab. */
export function rowLabel(r: Row | undefined): string {
  if (!r) return '';
  const person = [r.name_family_ja, r.name_given_ja].filter(Boolean).join(' ') || [r.name_given_en, r.name_family_en].filter(Boolean).join(' ');
  return (r.title || r.title_ja || r.title_en || r.name || r.name_ja || r.name_en || person || r.song || r.caption_ja || r.caption_en || r.instagram_url || '').trim().slice(0, 120);
}

/** What a list row is called in a diff (a setlist line, a video…). */
function lineLabel(r: Row): string {
  const t = (r.song || r.title || r.label || r.value || r.url || r.text || '').trim();
  return r.kind === 'part' && r.song ? `${r.song}${r.start ? ` @${fmtSeconds(r.start)}` : ''}` : t;
}
const fmtSeconds = (s: string) => {
  const n = Math.max(0, parseInt(s, 10) || 0);
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), sec = n % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
};

// ---------- diffing ----------

/** Values as the sheet shows them vs. as the admin sends them: compare loosely. */
function norm(v: unknown, field = ''): string {
  let s = String(v ?? '').replace(/\r\n/g, '\n').trim();
  if (/^(true|false)$/i.test(s)) s = s.toLowerCase();
  if (s === 'false') s = ''; // a blank switch is an off one
  if (field.endsWith('status') && s === 'published') s = ''; // blank status = on the site
  const d = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (d) s = `${d[1]}-${d[2].padStart(2, '0')}-${d[3].padStart(2, '0')}`;
  if (/^-?\d+(\.\d+)?$/.test(s)) s = String(Number(s));
  return s;
}

const short = (s: string) => (s.length > 80 ? `${s.slice(0, 79)}…` : s);

/** Field-by-field changes of one row (only the fields the save sent). */
export function diffFields(before: Row | undefined, fields: Row): Change[] {
  const out: Change[] = [];
  for (const [f, raw] of Object.entries(fields || {})) {
    if (f === 'id') continue;
    const from = norm(before?.[f], f), to = norm(raw, f);
    if (from === to) continue;
    if (from.length > LONG || to.length > LONG || from.includes('\n') || to.includes('\n')) out.push({ f });
    else out.push({ f, ...(from ? { from: short(from) } : {}), ...(to ? { to: short(to) } : {}) });
  }
  return out;
}

/** What was added to and removed from a list, or that only its order moved. */
export function diffLists(before: Row[], after: Row[]): Change[] {
  const a = before.map(lineLabel).filter(Boolean), b = after.map(lineLabel).filter(Boolean);
  const left = [...a];
  const added: string[] = [];
  for (const x of b) {
    const i = left.indexOf(x);
    if (i === -1) added.push(x); else left.splice(i, 1);
  }
  const out: Change[] = [
    ...added.map(to => ({ f: '+', to: short(to) })),
    ...left.map(from => ({ f: '-', from: short(from) })),
  ];
  if (!out.length && a.join('\u0000') !== b.join('\u0000')) out.push({ f: 'order' });
  // Same lines, same order, but something else changed (a note, a link)
  // (only the fields the save sends count: the sheet may have more columns)
  if (!out.length && after.some((r, i) => Object.keys(r).some(k => norm(r[k], k) !== norm(before[i]?.[k], k)))) out.push({ f: 'details' });
  return out;
}

// ---------- planning a write ----------

/**
 * What a write is about to do, read before it happens. Null for requests
 * that aren't logged (reads, reservations, messages, uploads…).
 */
export async function planActivity(ctx: SheetContext, w: WriteInfo): Promise<Pending | null> {
  if (w.method === 'GET') return null;
  const parts = w.path.replace(/^\/api\/admin\/?/, '').split('/').filter(Boolean);
  const [first, second] = parts;
  if (!first) return null;
  const body = w.body || {};

  if (first === 'media' && w.method === 'PUT' && body.owner) {
    const owner = String(body.owner);
    const before = (await listPrivate(ctx, MEDIA_TAB, MEDIA_COLUMNS)).filter(r => r.owner === owner);
    const song = owner.startsWith('song:');
    // Videos with no show yet (date unknown) aren't any one show's
    if (owner === 'unsorted') return { action: 'videos', tab: 'Videos', item: '', label: '', changes: diffLists(before, body.rows || []) };
    return { action: 'videos', tab: song ? 'Songs' : 'Events', item: song ? owner.slice(5) : owner, label: '', changes: diffLists(before, body.rows || []) };
  }
  if (first === 'arrangements' && w.method === 'PUT' && body.song) {
    const before = (await listPrivate(ctx, ARR_TAB, ARR_COLUMNS)).filter(r => r.song === body.song);
    return { action: 'arrangements', tab: 'Songs', item: String(body.song), label: '', changes: diffLists(before, body.rows || []) };
  }
  if ((first === 'links' || first === 'notes') && w.method === 'PUT' && body.owner) {
    // owner "event:<id>" / "song:<id>" / "album:<id>" → that show, song or release's history
    const owner = String(body.owner);
    const [kind, ...rest] = owner.split(':');
    const tab = kind === 'song' ? 'Songs' : kind === 'album' ? 'Albums' : 'Events';
    const before = first === 'links'
      ? (await listPrivate(ctx, LINKS_TAB, LINK_COLUMNS)).filter(r => r.owner === owner)
      : (await listPrivate(ctx, NOTES_TAB, NOTE_COLUMNS)).filter(r => r.owner === owner);
    return { action: first, tab, item: rest.join(':'), label: '', changes: diffLists(before, body.rows || []) };
  }
  if (first === 'rename' && w.method === 'POST' && body.kind && body.from) {
    const tab = ({ event: 'Events', venue: 'Venues', song: 'Songs', album: 'Albums' } as Record<string, string>)[String(body.kind)] || 'Events';
    return { action: 'rename', tab, item: String(body.to || ''), label: '', changes: [{ f: 'id', from: String(body.from), to: String(body.to || '') }] };
  }
  if (first === 'filters' && w.method !== 'GET') {
    // Who's filtered stays out of the log: just that the list changed
    return { action: 'filters', tab: 'Filters', item: '', label: '', changes: [] };
  }
  // Sheet tabs are capitalised (Events, Songs…); everything else isn't logged
  if (!/^[A-Z][A-Za-z]+$/.test(first) || first === ACTIVITY_TAB) return null;
  const tab = first;

  if (second === 'order' && w.method === 'POST') {
    return { action: 'reorder', tab, item: '', label: '', changes: [{ f: 'order', to: String((body.ids || []).length) }] };
  }
  if (second) return null;

  if (w.method === 'POST') {
    const fields: Row = body.fields || {};
    return { action: 'create', tab, item: String(fields.id || ''), label: rowLabel(fields), changes: [] };
  }
  if (w.method === 'PUT') {
    const id = String(body.id || '');
    const { rows } = await tabRows(ctx, tab);
    const before = rows.find(r => (r.id || '').trim() === id);
    const fields: Row = body.fields || {};
    return { action: 'update', tab, item: id, label: rowLabel({ ...before, ...fields }), changes: diffFields(before, fields) };
  }
  if (w.method === 'DELETE') {
    const id = w.query.get('id') || '';
    const { rows } = await tabRows(ctx, tab);
    return { action: 'delete', tab, item: id, label: rowLabel(rows.find(r => (r.id || '').trim() === id)), changes: [] };
  }
  if (w.method === 'PATCH') {
    // Replace every row whose first column is `key` (a show's setlist, a release's tracks)
    const key = String(body.key || '');
    const { headers, rows } = await tabRows(ctx, tab);
    const before = rows.filter(r => (r[headers[0]] || '').trim() === key);
    return { action: 'replace', tab, item: key, label: '', changes: diffLists(before, body.rows || []) };
  }
  return null;
}

/** Append the entry. An update that changed nothing isn't worth a line. */
export async function recordActivity(ctx: SheetContext, p: Pending, who: string, at = new Date()): Promise<void> {
  // A save that changed nothing (a show saved with its setlist untouched) isn't worth a line
  if (['update', 'replace', 'videos', 'arrangements', 'links', 'notes'].includes(p.action) && p.changes.length === 0) return;
  let changes = JSON.stringify(p.changes);
  if (changes.length > MAX_CHANGES_JSON) {
    const kept: Change[] = [];
    for (const c of p.changes) {
      if (JSON.stringify([...kept, c]).length > MAX_CHANGES_JSON - 40) break;
      kept.push(c);
    }
    changes = JSON.stringify([...kept, { f: 'more', to: String(p.changes.length - kept.length) }]);
  }
  await appendPrivate(ctx, ACTIVITY_TAB, ACTIVITY_COLUMNS, {
    at: at.toISOString(), who, action: p.action, tab: p.tab, item: p.item, label: p.label, changes,
  });
}

/** Plan, but never let the log get in the way of the save itself. */
export async function safePlan(ctx: SheetContext, w: WriteInfo): Promise<Pending | null> {
  try { return await planActivity(ctx, w); }
  catch (err) {
    console.error('[activity] plan', err);
    // Still log that something was saved, without the diff
    const first = w.path.replace(/^\/api\/admin\/?/, '').split('/')[0] || '';
    return /^[A-Z]/.test(first) ? { action: w.method.toLowerCase(), tab: first, item: String(w.body?.id || w.body?.fields?.id || w.body?.key || w.query.get('id') || ''), label: '', changes: [] } : null;
  }
}

// ---------- reading the log ----------

/**
 * GET /api/admin/activity
 *   ?for=Events:abc,Setlists:abc   only these items (tab:item pairs)
 *   ?limit=200                     newest first
 */
export async function handleAdminActivity(request: Request, ctx: SheetContext): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  try {
    const url = new URL(request.url);
    const want = (url.searchParams.get('for') || '').split(',').map(x => x.trim()).filter(Boolean);
    const pairs = new Set(want);
    const limit = Math.min(1000, Math.max(1, parseInt(url.searchParams.get('limit') || '300', 10) || 300));
    const rows = (await listPrivate(ctx, ACTIVITY_TAB, ACTIVITY_COLUMNS)) as ActivityRow[];
    const picked = (pairs.size ? rows.filter(r => pairs.has(`${r.tab}:${r.item}`)) : rows).reverse().slice(0, limit);
    return json({
      activity: picked.map(r => {
        let changes: Change[] = [];
        try { changes = JSON.parse(r.changes || '[]'); } catch { /* an old or hand-edited line */ }
        return { ...r, changes };
      }),
    });
  } catch (err) {
    console.error('[activity]', err);
    return json({ error: 'server' }, 500);
  }
}
