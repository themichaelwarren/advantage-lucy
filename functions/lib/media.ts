/**
 * Media (admin only): videos of shows and songs, kept in a private
 * "Media" tab of the sheet. Nothing here is ever served by the public
 * /api/sheets/* routes; only /api/admin/media (behind the admin sign-in)
 * reads or writes it.
 *
 * One row per item. `owner` says what it belongs to, and is what a save
 * replaces (a show's videos are saved together, as are a song's):
 *   kind "show"  owner = event id      a video of the show (url, title)
 *   kind "part"  owner = event id      where one song starts in a show video
 *                                     (url, song title, start in seconds)
 *   kind "song"  owner = "song:<id>"   a video of one song (url, title)
 */
import { listPrivate, replacePrivate, json, type SheetContext } from './privateTab';

export const MEDIA_TAB = 'Media';
export const MEDIA_COLUMNS = ['owner', 'kind', 'url', 'song', 'start', 'title', 'note'] as const;
export type MediaRow = Record<typeof MEDIA_COLUMNS[number], string>;
const KINDS = new Set(['show', 'part', 'song']);

export type MediaContext = SheetContext;

/** Every media row. [] before the tab exists. */
export async function listMedia(sheetId: string, saEmail: string, saKey: string): Promise<MediaRow[]> {
  return (await listPrivate({ sheetId, saEmail, saKey }, MEDIA_TAB, MEDIA_COLUMNS)).filter(r => r.url) as MediaRow[];
}

/** Clean one row from the admin: known kinds, an http(s) link, a whole-second start. */
function clean(owner: string, r: Partial<MediaRow>): MediaRow {
  const kind = String(r.kind || '');
  if (!KINDS.has(kind)) throw new Error(`Unknown media kind "${kind}"`);
  const url = String(r.url || '').trim();
  if (!/^https?:\/\/\S+$/i.test(url)) throw new Error('Video links need to start with https://');
  const start = r.start === undefined || r.start === '' ? '' : String(Math.max(0, Math.round(Number(r.start))));
  if (start === 'NaN') throw new Error('Start time must be in seconds');
  return {
    owner, kind, url: url.slice(0, 500),
    song: String(r.song || '').slice(0, 200), start,
    title: String(r.title || '').slice(0, 200), note: String(r.note || '').slice(0, 500),
  };
}

/** Replace everything one show or song owns; other rows stay as they were. */
export async function replaceMedia(ctx: MediaContext, owner: string, rows: Partial<MediaRow>[]): Promise<MediaRow[]> {
  if (!owner.trim()) throw new Error('Missing owner');
  return await replacePrivate(ctx, MEDIA_TAB, MEDIA_COLUMNS, owner, rows.map(r => clean(owner, r))) as MediaRow[];
}

/** A YouTube video's title, via YouTube's public oEmbed (no key needed). '' if unknown. */
async function videoTitle(link: string): Promise<string> {
  if (!/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(link)) return '';
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(link)}`);
    if (!res.ok) return '';
    const data = await res.json() as { title?: string };
    // Joined-up kana (ト + ゛ → ド) and single spaces, as typed text would be
    return String(data.title || '').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 200);
  } catch {
    return '';
  }
}

/**
 * /api/admin/media
 *   GET                     every row
 *   GET ?title=<link>       that YouTube video's title
 *   PUT {owner, rows}       replace what that show ("<event id>") or song ("song:<id>") owns
 */
export async function handleAdminMedia(request: Request, ctx: MediaContext): Promise<Response> {
  try {
    if (request.method === 'GET') {
      // ?title=<link>: the video's title from YouTube (browsers can't ask YouTube directly)
      const link = new URL(request.url).searchParams.get('title');
      if (link !== null) return json({ title: await videoTitle(link) });
      return json({ media: await listMedia(ctx.sheetId, ctx.saEmail, ctx.saKey) });
    }
    if (request.method === 'PUT') {
      const body = await request.json() as { owner?: string; rows?: Partial<MediaRow>[] };
      if (!body.owner || !Array.isArray(body.rows)) return json({ error: 'Missing owner or rows' }, 400);
      return json({ ok: true, media: await replaceMedia(ctx, body.owner, body.rows) });
    }
    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    const msg = String((err as Error)?.message || err);
    const known = /need|Unknown media|Start time|Missing owner/.test(msg);
    if (!known) console.error('[media]', err);
    return json({ error: known ? msg : 'server' }, known ? 400 : 500);
  }
}
