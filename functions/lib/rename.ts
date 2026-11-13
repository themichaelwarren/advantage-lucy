/**
 * Change the id (the URL slug) of a show, venue, song or release, and
 * everything that points at it:
 *
 *   show     Events.id  ← Setlists.event, Media.owner, Reservations.event, Links/Notes "event:<id>"
 *   venue    Venues.id  ← Events.venue
 *   song     Songs.id   ← Media.owner "song:<id>", Arrangements.song, Links/Notes "song:<id>"
 *   release  Albums.id  ← Links/Notes "album:<id>"
 *
 * The old id goes into the row's `former_ids` column (comma-separated), so
 * old addresses (a shared link, a "/songs/…" link in a note) still find
 * the page and move to the new one.
 *
 * POST /api/admin/rename {kind, from, to}. Admin only (api/admin/_middleware.ts).
 */
import { getAccessToken } from './auth';
import { fetchSheet, rowsToObjects, updateRow } from './sheets';
import { json, type SheetContext } from './privateTab';

export type RenameKind = 'event' | 'venue' | 'song' | 'album';
export const RENAME_TABS: Record<RenameKind, string> = { event: 'Events', venue: 'Venues', song: 'Songs', album: 'Albums' };
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
export const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

const col = (n: number) => { let s = ''; for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s; return s; };

/** Rewrite one column of a tab, cell by cell (only the cells that change). 0 if the tab or column isn't there. */
async function rewriteColumn(ctx: SheetContext, token: string, tab: string, column: string, change: (v: string) => string | null): Promise<number> {
  let rows: string[][];
  try { rows = await fetchSheet(ctx.sheetId, tab, ctx.saEmail, ctx.saKey); }
  catch (err) { if (String(err).includes('Unable to parse range')) return 0; throw err; }
  const c = (rows[0] || []).map(h => String(h).trim()).indexOf(column);
  if (c < 0) return 0;
  const data: { range: string; values: string[][] }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const v = String(rows[i][c] ?? '').trim();
    const next = change(v);
    if (next !== null && next !== v) data.push({ range: `${tab}!${col(c + 1)}${i + 1}`, values: [[next]] });
  }
  if (!data.length) return 0;
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ctx.sheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ valueInputOption: 'RAW', data }),
  });
  if (!res.ok) throw new Error(`Sheets API error: ${res.status} ${await res.text()}`);
  return data.length;
}

export async function renameItem(ctx: SheetContext, kind: RenameKind, from: string, to: string): Promise<Record<string, number>> {
  const tab = RENAME_TABS[kind];
  if (!tab) throw new Error('Unknown kind');
  if (!SLUG.test(to)) throw new Error('Use lower-case letters, numbers and hyphens (e.g. shiroi-asa)');
  const rows = rowsToObjects(await fetchSheet(ctx.sheetId, tab, ctx.saEmail, ctx.saKey));
  const row = rows.find(r => (r.id || '').trim() === from);
  if (!row) throw new Error(`Not found: ${from}`);
  if (from === to) return {};
  const taken = rows.find(r => (r.id || '').trim() === to || (r.former_ids || '').split(',').map(x => x.trim()).includes(to) && (r.id || '').trim() !== from);
  if (taken) throw new Error(`That address is already used by “${taken.title || taken.title_ja || taken.name_ja || taken.name_en || taken.id}”`);

  // 1. The row itself: new id, the old one kept for redirects
  const former = [...new Set([...(row.former_ids || '').split(','), from].map(x => x.trim()).filter(x => x && x !== to))].join(', ');
  await updateRow(ctx.sheetId, tab, from, { ...row, id: to, former_ids: former }, ctx.saEmail, ctx.saKey);

  // 2. Everything that points at it
  const token = await getAccessToken(ctx.saEmail, ctx.saKey, SCOPE);
  const same = (v: string) => (v === from ? to : null);
  const owned = (prefix: string) => (v: string) => (v === `${prefix}:${from}` ? `${prefix}:${to}` : null);
  const n: Record<string, number> = {};
  if (kind === 'event') {
    n.setlists = await rewriteColumn(ctx, token, 'Setlists', 'event', same);
    n.videos = await rewriteColumn(ctx, token, 'Media', 'owner', same);
    n.reservations = await rewriteColumn(ctx, token, 'Reservations', 'event', same);
  }
  if (kind === 'venue') n.shows = await rewriteColumn(ctx, token, 'Events', 'venue', same);
  if (kind === 'song') {
    n.videos = await rewriteColumn(ctx, token, 'Media', 'owner', owned('song'));
    n.keys = await rewriteColumn(ctx, token, 'Arrangements', 'song', same);
  }
  if (kind !== 'venue') {
    n.links = await rewriteColumn(ctx, token, 'Links', 'owner', owned(kind));
    n.notes = await rewriteColumn(ctx, token, 'Notes', 'owner', owned(kind));
  }
  return n;
}

export async function handleAdminRename(request: Request, ctx: SheetContext): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const body = await request.json() as { kind?: RenameKind; from?: string; to?: string };
    const to = String(body.to || '').trim().toLowerCase();
    if (!body.kind || !RENAME_TABS[body.kind] || !body.from) return json({ error: 'Missing kind or id' }, 400);
    return json({ ok: true, id: to, moved: await renameItem(ctx, body.kind, String(body.from), to) });
  } catch (err) {
    const msg = String((err as Error)?.message || err);
    const known = /Use lower-case|already used|Not found|Unknown kind/.test(msg);
    if (!known) console.error('[rename]', err);
    return json({ error: known ? msg : /Sheets API error: 429/.test(msg) ? 'busy' : 'server' }, known ? 400 : /Sheets API error: 429/.test(msg) ? 429 : 500);
  }
}
