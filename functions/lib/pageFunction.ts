/**
 * Pages Function for the site's pages (/en/*, /ja/*): serves the app as
 * usual, with this page's title, description and preview image put into
 * the HTML for link previews (see meta.ts). Anything that isn't an HTML
 * page, and the admin, passes straight through.
 */
import type { Env } from './sheets';
import { pageMeta, injectMeta } from './meta';
import { readPublicTab } from './publicData';

// Not named onRequest*: files under functions/ that export those become routes themselves
export const handlePage: PagesFunction<Env> = async ({ request, env, next, waitUntil }) => {
  const url = new URL(request.url);
  if (/^\/(en|ja)\/admin(\/|$)/.test(url.pathname)) return next();
  const res = await next();
  if (!(res.headers.get('Content-Type') || '').includes('text/html')) return res;
  try {
    // Each tab is read at most once per request
    const memo = new Map<string, Promise<Record<string, any>[]>>();
    const load = (tab: Parameters<typeof readPublicTab>[0]) => {
      if (!memo.has(tab)) memo.set(tab, readPublicTab(tab, url.origin, env, waitUntil));
      return memo.get(tab)!;
    };
    const meta = await pageMeta(url.pathname, url.origin, load);
    if (!meta) return res;
    const html = injectMeta(await res.text(), meta);
    const headers = new Headers(res.headers);
    headers.delete('Content-Length');
    return new Response(html, { status: res.status, headers });
  } catch {
    return res;
  }
};
