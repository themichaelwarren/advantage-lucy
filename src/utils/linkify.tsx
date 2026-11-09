import type { ReactNode } from 'react';

/** [text](https://…) or a bare https://… address. */
const LINK_RE = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<>（）「」、。]+)/g;

/**
 * Turn links in plain text into <a> tags (opening in a new tab):
 * Markdown-style [text](url) shows "text", and bare addresses show as is.
 */
export function linkify(text: string, keyPrefix = ''): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const href = m[2] || m[3];
    out.push(
      <a key={`${keyPrefix}${at}`} href={href} target="_blank" rel="noopener noreferrer">{m[1] || href}</a>
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
