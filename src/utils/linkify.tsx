import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { currentLang } from './siteLinks';

/** [text](https://…) or a bare https://… address. */
const LINK_RE = /\[([^\]\n]+)\]\(((?:https?:\/\/|\/(?!\/))[^)\s]*)\)|(https?:\/\/[^\s<>（）「」、。]+)/g;

const BOLD_RE = /\*\*([^*\n]+?)\*\*/g;

/** **bold** → <strong>, everything else as plain text. */
function bold(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(BOLD_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(<strong key={`${keyPrefix}b${at}`}>{m[1]}</strong>);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * Light formatting for plain text from the sheet:
 * - [text](url) shows "text" as a link; bare https://… addresses are links too
 *   (both open in a new tab)
 * - [text](/songs/shiroi-asa): one of our own pages, opened in the site
 *   in the reader's language (utils/siteLinks.ts)
 * - **text** is bold
 */
export function linkify(text: string, keyPrefix = ''): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(...bold(text.slice(last, at), `${keyPrefix}${last}`));
    const href = m[2] || m[3];
    // Our own pages ("/songs/shiroi-asa"): a link within the site, in the reader's language
    out.push(href.startsWith('/')
      ? <Link key={`${keyPrefix}${at}`} to={`/${currentLang()}${href === '/' ? '' : href}`}>{m[1] || href}</Link>
      : <a key={`${keyPrefix}${at}`} href={href} target="_blank" rel="noopener noreferrer">{m[1] || href}</a>
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(...bold(text.slice(last), `${keyPrefix}${last}`));
  return out;
}
