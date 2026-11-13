/**
 * Arrangements (admin only): how a song is played, in a private
 * "Arrangements" tab. One row per item, in order, owned by the song id.
 *   kind "key"   value = a key like "G" or "F♯m", label e.g. "サビ"
 * (capo, tunings and notes can be added as more kinds later)
 */
import { listPrivate, replacePrivate, json, type SheetContext } from './privateTab';
import { KEYS } from './keys';

export const ARR_TAB = 'Arrangements';
export const ARR_COLUMNS = ['song', 'kind', 'value', 'label', 'note'] as const;
export type ArrangementRow = Record<typeof ARR_COLUMNS[number], string>;
const KINDS = new Set(['key']);

function clean(r: Partial<ArrangementRow>): Omit<ArrangementRow, 'song'> {
  const kind = String(r.kind || '');
  if (!KINDS.has(kind)) throw new Error(`Unknown arrangement kind "${kind}"`);
  const value = String(r.value || '').trim();
  if (kind === 'key' && !KEYS.includes(value)) throw new Error(`Unknown key "${value}"`);
  return { kind, value, label: String(r.label || '').trim().slice(0, 100), note: String(r.note || '').trim().slice(0, 500) };
}

/**
 * /api/admin/arrangements
 *   GET                  every row
 *   PUT {song, rows}     replace that song's rows (in this order)
 */
export async function handleAdminArrangements(request: Request, ctx: SheetContext): Promise<Response> {
  try {
    if (request.method === 'GET') return json({ arrangements: await listPrivate(ctx, ARR_TAB, ARR_COLUMNS) });
    if (request.method === 'PUT') {
      const body = await request.json() as { song?: string; rows?: Partial<ArrangementRow>[] };
      if (!body.song || !Array.isArray(body.rows)) return json({ error: 'Missing song or rows' }, 400);
      return json({ ok: true, arrangements: await replacePrivate(ctx, ARR_TAB, ARR_COLUMNS, body.song, body.rows.map(clean)) });
    }
    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    const msg = String((err as Error)?.message || err);
    const known = /Unknown|Missing/.test(msg);
    if (!known) console.error('[arrangements]', err);
    return json({ error: known ? msg : /Sheets API error: 429/.test(msg) ? 'busy' : 'server' }, known ? 400 : /Sheets API error: 429/.test(msg) ? 429 : 500);
  }
}
