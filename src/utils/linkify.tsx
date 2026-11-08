import type { ReactNode } from 'react';

/** Turn bare web addresses in plain text into links (opens in a new tab). */
export function linkify(text: string, keyPrefix = ''): ReactNode[] {
  return text.split(/(https?:\/\/[^\s<>（）「」、。]+)/g).map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={`${keyPrefix}${i}`} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
      : part
  );
}
