/**
 * Links about a show, song or release (a fan's blog post, a setlist page,
 * an interview), in a "Links" tab of the sheet. Any number per item; each
 * is public (listed on the site) or band-only. The public /api/sheets/links
 * leaves the band-only ones out (lib/visibility.ts); /api/admin/links
 * (behind the admin sign-in) reads and writes them all.
 *
 * owner: "event:<id>", "song:<id>" or "album:<id>". A save replaces what
 * one owner has, like the Media tab.
 */
import { listPrivate, replacePrivate, json, type SheetContext } from './privateTab';

export const LINKS_TAB = 'Links';
export const LINK_COLUMNS = ['owner', 'url', 'title', 'note', 'status', 'added'] as const;
export type LinkRow = Record<typeof LINK_COLUMNS[number], string>;
const OWNER = /^(event|song|album):\S+$/;

/** Every link (public and band-only). [] before the tab exists. */
export async function fetchLinks(sheetId: string, email: string, key: string): Promise<LinkRow[]> {
  return (await listPrivate({ sheetId, saEmail: email, saKey: key }, LINKS_TAB, LINK_COLUMNS)).filter(r => r.url) as LinkRow[];
}

function clean(owner: string, r: Partial<LinkRow>): LinkRow {
  const url = String(r.url || '').trim();
  if (!/^https?:\/\/\S+$/i.test(url)) throw new Error('Links need to start with https://');
  return {
    owner, url: url.slice(0, 600),
    title: String(r.title || '').trim().slice(0, 200),
    note: String(r.note || '').trim().slice(0, 500),
    status: r.status === 'private' ? 'private' : '',
    added: String(r.added || '').slice(0, 10),
  };
}

/** A web page's title (og:title, else <title>), for a link just pasted. '' if unknown. */
export async function pageTitle(link: string): Promise<string> {
  if (!/^https?:\/\/\S+$/i.test(link)) return '';
  try {
    const res = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; advantage-lucy-admin)', Accept: 'text/html' }, redirect: 'follow' });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) return '';
    // Only the start of the page: the title is in <head>
    const reader = res.body?.getReader();
    let html = '';
    if (reader) {
      const dec = new TextDecoder();
      while (html.length < 200_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += dec.decode(value, { stream: true });
        if (/<\/head>/i.test(html)) break;
      }
      reader.cancel().catch(() => {});
    }
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    const t = og?.[1] || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '';
    return t.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 200);
  } catch {
    return '';
  }
}

/**
 * /api/admin/links
 *   GET                  every link
 *   GET ?title=<link>    that page's title
 *   PUT {owner, rows}    replace what one show / song / release has
 */
export async function handleAdminLinks(request: Request, ctx: SheetContext): Promise<Response> {
  try {
    if (request.method === 'GET') {
      const link = new URL(request.url).searchParams.get('title');
      if (link !== null) return json({ title: await pageTitle(link) });
      return json({ links: await fetchLinks(ctx.sheetId, ctx.saEmail, ctx.saKey) });
    }
    if (request.method === 'PUT') {
      const body = await request.json() as { owner?: string; rows?: Partial<LinkRow>[] };
      if (!body.owner || !OWNER.test(body.owner) || !Array.isArray(body.rows)) return json({ error: 'Missing owner or rows' }, 400);
      return json({ ok: true, links: await replacePrivate(ctx, LINKS_TAB, LINK_COLUMNS, body.owner, body.rows.map(r => clean(body.owner!, r))) });
    }
    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    const msg = String((err as Error)?.message || err);
    const known = /need|Missing/.test(msg);
    if (!known) console.error('[links]', err);
    return json({ error: known ? msg : /Sheets API error: 429/.test(msg) ? 'busy' : 'server' }, known ? 400 : /Sheets API error: 429/.test(msg) ? 429 : 500);
  }
}
