/**
 * Filtered senders (admin only): people whose messages the band has chosen
 * not to see in the inbox. Kept in a private "Filters" tab, never public.
 *   kind "email"    value = an address (and its misspellings, one row each)
 *   kind "forward"  value = where a filtered sender's messages are emailed
 *
 * Nothing changes for the sender: the form says "sent" as usual. Their
 * messages are kept (a full record, should it ever be needed), shown only
 * in admin's Filtered tab, never emailed to the band, and no email is ever
 * sent to them (no reservation confirmations either).
 *
 * Matching ignores capitals, Gmail's dots and "+anything", so variations of
 * one inbox all match. Addresses a typo or two away are "lookalikes": not
 * filtered (a real fan might be caught), but flagged for the band to check.
 */
import { listPrivate, replacePrivate, json, type SheetContext } from './privateTab';

export const FILTER_TAB = 'Filters';
export const FILTER_COLUMNS = ['kind', 'value', 'note', 'added'] as const;
export type FilterRow = Record<typeof FILTER_COLUMNS[number], string>;
const KINDS = new Set(['email', 'forward']);

/** One inbox, however it's written: lower case; Gmail without dots or +tags; +tags off elsewhere. */
export function normalizeEmail(email: string): string {
  const e = (email || '').trim().toLowerCase().replace(/^mailto:/, '');
  const at = e.lastIndexOf('@');
  if (at < 1) return e;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  local = local.split('+')[0];
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}

/** Edit distance (insertions, deletions, swaps of one letter). */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

export type SenderMatch = { kind: 'filtered' | 'lookalike'; listed: string } | null;

/**
 * Is this address on the list ("filtered"), or a near miss of one
 * ("lookalike": the same name at another address, or a typo or two away)?
 */
export function matchSender(email: string, listed: string[]): SenderMatch {
  const e = normalizeEmail(email);
  if (!e.includes('@')) return null;
  const norm = listed.map(l => [l, normalizeEmail(l)] as const).filter(([, n]) => n.includes('@'));
  const exact = norm.find(([, n]) => n === e);
  if (exact) return { kind: 'filtered', listed: exact[0] };
  const [local, domain] = e.split('@');
  for (const [raw, n] of norm) {
    const [l2, d2] = n.split('@');
    const close = distance(e, n) <= Math.min(3, Math.floor(n.length / 6));
    // Names compared without dots (Gmail ignores them, so its addresses are stored without)
    const [n1, n2] = [local.replace(/\./g, ''), l2.replace(/\./g, '')];
    const sameName = n1.length >= 5 && n1 === n2 && domain !== d2;
    const nearName = n2.length >= 6 && distance(n1, n2) <= 1 && distance(domain, d2) <= 2;
    if (close || sameName || nearName) return { kind: 'lookalike', listed: raw };
  }
  return null;
}

export interface Filters { emails: string[]; forwardTo: string; rows: FilterRow[] }

export async function loadFilters(ctx: SheetContext): Promise<Filters> {
  const rows = await listPrivate(ctx, FILTER_TAB, FILTER_COLUMNS) as FilterRow[];
  return {
    rows,
    emails: rows.filter(r => r.kind === 'email' && r.value).map(r => r.value),
    forwardTo: rows.find(r => r.kind === 'forward')?.value || '',
  };
}

function clean(r: Partial<FilterRow>): Omit<FilterRow, 'kind'> {
  const value = String(r.value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) throw new Error(`Not an email address: "${value}"`);
  return {
    value,
    note: String(r.note || '').trim().slice(0, 300),
    added: String(r.added || '').trim() || new Date().toISOString().slice(0, 10),
  };
}

/**
 * /api/admin/filters
 *   GET                         the list and the forwarding address
 *   PUT {kind:"email", rows}    replace the list of addresses
 *   PUT {kind:"forward", value} set (or clear, with "") the forwarding address
 */
export async function handleAdminFilters(request: Request, ctx: SheetContext): Promise<Response> {
  try {
    if (request.method === 'GET') return json(await loadFilters(ctx));
    if (request.method === 'PUT') {
      const body = await request.json() as { kind?: string; rows?: Partial<FilterRow>[]; value?: string };
      if (!body.kind || !KINDS.has(body.kind)) return json({ error: 'Unknown kind' }, 400);
      if (body.kind === 'email') {
        if (!Array.isArray(body.rows)) return json({ error: 'Missing rows' }, 400);
        const seen = new Set<string>();
        const rows = body.rows.map(r => clean(r)).filter(r => !seen.has(r.value) && seen.add(r.value));
        await replacePrivate(ctx, FILTER_TAB, FILTER_COLUMNS, 'email', rows);
      } else {
        const value = String(body.value || '').trim();
        await replacePrivate(ctx, FILTER_TAB, FILTER_COLUMNS, 'forward', value ? [clean({ value })] : []);
      }
      return json(await loadFilters(ctx));
    }
    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    const msg = String((err as Error)?.message || err);
    const known = /Not an email|Unknown|Missing/.test(msg);
    if (!known) console.error('[filters]', err);
    return json({ error: known ? msg : /Sheets API error: 429/.test(msg) ? 'busy' : 'server' }, known ? 400 : /Sheets API error: 429/.test(msg) ? 429 : 500);
  }
}
