/**
 * Admin-only sheet tabs (Media, Arrangements): never served by the public
 * /api/sheets/* routes. Each row belongs to an "owner" (a show, a song…),
 * and a save replaces everything one owner has, leaving other rows alone.
 */
import { getAccessToken } from './auth';
import { fetchSheet, rowsToObjects } from './sheets';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
export interface SheetContext { sheetId: string; saEmail: string; saKey: string }
type Row = Record<string, string>;

const col = (n: number) => String.fromCharCode(64 + n);

async function sheetsFetch(token: string, url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Sheets API error: ${res.status} ${await res.text()}`);
  return res.json() as Promise<any>;
}

/** Make the tab (with its headings) the first time it's needed. */
const known = new Set<string>();
async function ensureTab(sheetId: string, token: string, tab: string, columns: readonly string[]) {
  if (known.has(`${sheetId}/${tab}`)) return;
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
  const meta = await sheetsFetch(token, `${base}?fields=sheets.properties.title`);
  if (meta.sheets?.some((s: any) => s.properties?.title === tab)) { known.add(`${sheetId}/${tab}`); return; }
  await sheetsFetch(token, `${base}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }),
  });
  await sheetsFetch(token, `${base}/values/${encodeURIComponent(`${tab}!A1`)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[...columns]] }),
  });
  known.add(`${sheetId}/${tab}`);
}

/** Every row (trimmed, only the known columns). [] before the tab exists. */
export async function listPrivate(ctx: SheetContext, tab: string, columns: readonly string[]): Promise<Row[]> {
  try {
    const rows = await fetchSheet(ctx.sheetId, `${tab}!A:${col(columns.length)}`, ctx.saEmail, ctx.saKey);
    return rowsToObjects(rows)
      .filter(r => r[columns[0]])
      .map(r => Object.fromEntries(columns.map(c => [c, (r[c] ?? '').trim()])));
  } catch (err) {
    if (String(err).includes('Unable to parse range')) return [];
    throw err;
  }
}

/** Replace what one owner has (column A); the tab is small, so it's rewritten whole. */
export async function replacePrivate(ctx: SheetContext, tab: string, columns: readonly string[], owner: string, mine: Row[]): Promise<Row[]> {
  if (!owner.trim()) throw new Error('Missing owner');
  const token = await getAccessToken(ctx.saEmail, ctx.saKey, SCOPE);
  await ensureTab(ctx.sheetId, token, tab, columns);
  const ownerCol = columns[0];
  const rows = mine.map(r => ({ ...r, [ownerCol]: owner }));
  const all = [...(await listPrivate(ctx, tab, columns)).filter(r => r[ownerCol] !== owner), ...rows];
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${ctx.sheetId}`;
  const last = col(columns.length);
  const values = [[...columns], ...all.map(r => columns.map(c => r[c] ?? ''))];
  await sheetsFetch(token, `${base}/values/${encodeURIComponent(`${tab}!A1:${last}${values.length}`)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values }),
  });
  await sheetsFetch(token, `${base}/values/${encodeURIComponent(`${tab}!A${values.length + 1}:${last}`)}:clear`, { method: 'POST', body: '{}' });
  return rows;
}

/** Add one row at the end (for logs: nothing is ever rewritten). */
export async function appendPrivate(ctx: SheetContext, tab: string, columns: readonly string[], row: Row): Promise<void> {
  const token = await getAccessToken(ctx.saEmail, ctx.saKey, SCOPE);
  await ensureTab(ctx.sheetId, token, tab, columns);
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${ctx.sheetId}`;
  await sheetsFetch(token, `${base}/values/${encodeURIComponent(`${tab}!A:${col(columns.length)}`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values: [columns.map(c => row[c] ?? '')] }),
  });
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
