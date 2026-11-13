/**
 * Old addresses: when a show's, venue's, song's or release's id changes
 * (functions/lib/rename.ts), the old id is kept in its `former_ids`. A page
 * opened at an old id forwards to the new one.
 */
export function movedTo<T extends { id: string; former_ids?: string }>(items: T[], id: string | undefined): string | undefined {
  if (!id || items.some(x => x.id === id)) return undefined;
  return items.find(x => (x.former_ids || '').split(',').map(t => t.trim()).includes(id))?.id;
}
