/**
 * When a show, song or release is deleted, what belonged to it goes too,
 * so nothing is left pointing at a page that isn't there (a song's video
 * list showing a deleted show, say):
 *
 *   show     its setlist, its videos (and their song times), links, band notes
 *   song     its own videos, keys, links, band notes
 *   release  links, band notes (the admin clears its tracklist itself)
 *
 * Reservations are kept: they're a record of who booked. Called by the
 * admin DELETE (functions/api/admin/[tab].ts, and the dev server) after the
 * row itself is gone.
 */
import { listPrivate, replacePrivate, type SheetContext } from './privateTab';
import { replaceRows } from './sheets';
import { MEDIA_TAB, MEDIA_COLUMNS } from './media';
import { ARR_TAB, ARR_COLUMNS } from './arrangements';
import { LINKS_TAB, LINK_COLUMNS } from './links';
import { NOTES_TAB, NOTE_COLUMNS } from './notes';

/** Remove one owner's rows from a private tab (only if it has any: no tab is created). */
async function clear(ctx: SheetContext, tab: string, columns: readonly string[], owner: string): Promise<number> {
  const mine = (await listPrivate(ctx, tab, columns)).filter(r => r[columns[0]] === owner).length;
  if (mine) await replacePrivate(ctx, tab, columns, owner, []);
  return mine;
}

export async function afterDelete(ctx: SheetContext, tab: string, id: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!id) return out;
  if (tab === 'Events') {
    await replaceRows(ctx.sheetId, 'Setlists', id, [], ctx.saEmail, ctx.saKey);
    out.videos = await clear(ctx, MEDIA_TAB, MEDIA_COLUMNS, id);
    out.links = await clear(ctx, LINKS_TAB, LINK_COLUMNS, `event:${id}`);
    out.notes = await clear(ctx, NOTES_TAB, NOTE_COLUMNS, `event:${id}`);
  } else if (tab === 'Songs') {
    out.videos = await clear(ctx, MEDIA_TAB, MEDIA_COLUMNS, `song:${id}`);
    out.keys = await clear(ctx, ARR_TAB, ARR_COLUMNS, id);
    out.links = await clear(ctx, LINKS_TAB, LINK_COLUMNS, `song:${id}`);
    out.notes = await clear(ctx, NOTES_TAB, NOTE_COLUMNS, `song:${id}`);
  } else if (tab === 'Albums') {
    out.links = await clear(ctx, LINKS_TAB, LINK_COLUMNS, `album:${id}`);
    out.notes = await clear(ctx, NOTES_TAB, NOTE_COLUMNS, `album:${id}`);
  }
  return out;
}
