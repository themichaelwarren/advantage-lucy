/**
 * Links to our own pages inside notes and posts. A copied address of any
 * of our pages (the live site, a preview, localhost, or the admin page of
 * the same thing) is stored as a short site path, "/songs/shiroi-asa", so
 * it works on any domain and in either language: the page shows it in the
 * reader's language (/ja/… or /en/…).
 */
const OURS = /(^|\.)advantagelucy\.com$|\.pages\.dev$|^localhost$|^127\.0\.0\.1$/i;

/** "https://advantagelucy.com/ja/admin/songs/shiroi-asa" → "/songs/shiroi-asa"; null for other sites. */
export function toSitePath(url: string): string | null {
  const t = url.trim();
  if (/^\/(?!\/)\S*$/.test(t)) return t.replace(/^\/(en|ja)(?=\/|$)/, '').replace(/^\/admin(?=\/)/, '') || '/';
  try {
    const u = new URL(t);
    if (!OURS.test(u.hostname)) return null;
    const path = u.pathname.replace(/^\/(en|ja)(?=\/|$)/, '').replace(/^\/admin(?=\/)/, '') || '/';
    return path + u.search.replace(/[?&]preview-admin\b/, '') + u.hash;
  } catch {
    return null;
  }
}

/** The language of the page being viewed, for "/songs/x" → "/ja/songs/x". */
export const currentLang = () => (typeof window !== 'undefined' && window.location.pathname.split('/')[1] === 'en' ? 'en' : 'ja');
