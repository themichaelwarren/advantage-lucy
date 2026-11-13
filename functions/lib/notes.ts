/**
 * Band notes on a show, song or release ("capo 2 since the 2019 tour",
 * "masters are on Max's drive"): a private "Notes" tab of the sheet,
 * never served by the public /api/sheets/* routes. Only /api/admin/notes
 * (behind the admin sign-in) reads or writes it.
 *
 * owner: "event:<id>", "song:<id>" or "album:<id>"; each note has its own
 * id, when it was written and by whom. A save replaces one owner's notes.
 */
import { listPrivate, replacePrivate, json, type SheetContext } from './privateTab';

export const NOTES_TAB = 'Notes';
export const NOTE_COLUMNS = ['owner', 'id', 'at', 'who', 'text'] as const;
export type NoteRow = Record<typeof NOTE_COLUMNS[number], string>;
const OWNER = /^(event|song|album):\S+$/;

function clean(owner: string, r: Partial<NoteRow>): NoteRow {
  const text = String(r.text || '').trim();
  if (!text) throw new Error('A note needs some text');
  return {
    owner, id: String(r.id || '').slice(0, 40) || Math.random().toString(36).slice(2, 10),
    at: String(r.at || new Date().toISOString()).slice(0, 30),
    who: String(r.who || '').slice(0, 120),
    text: text.slice(0, 4000),
  };
}

/**
 * /api/admin/notes
 *   GET                  every note
 *   PUT {owner, rows}    replace one show's / song's / release's notes
 */
export async function handleAdminNotes(request: Request, ctx: SheetContext): Promise<Response> {
  try {
    if (request.method === 'GET') return json({ notes: (await listPrivate(ctx, NOTES_TAB, NOTE_COLUMNS)).filter(r => r.text) });
    if (request.method === 'PUT') {
      const body = await request.json() as { owner?: string; rows?: Partial<NoteRow>[] };
      if (!body.owner || !OWNER.test(body.owner) || !Array.isArray(body.rows)) return json({ error: 'Missing owner or rows' }, 400);
      return json({ ok: true, notes: await replacePrivate(ctx, NOTES_TAB, NOTE_COLUMNS, body.owner, body.rows.map(r => clean(body.owner!, r))) });
    }
    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    const msg = String((err as Error)?.message || err);
    const known = /needs|Missing/.test(msg);
    if (!known) console.error('[notes]', err);
    return json({ error: known ? msg : /Sheets API error: 429/.test(msg) ? 'busy' : 'server' }, known ? 400 : /Sheets API error: 429/.test(msg) ? 429 : 500);
  }
}
