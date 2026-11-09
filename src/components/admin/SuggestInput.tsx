import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

export interface Suggestion {
  /** What goes into the field when picked. */
  value: string;
  /** Shown greyed next to it, e.g. the other language's name. */
  hint?: string;
  /** Extra text that should also match (IDs, readings…). */
  keywords?: string;
}

/** Lowercase, full-width → half-width, no spaces: "Ｋｉｃｈｉ ｊｏｊｉ" ≈ "kichijoji". */
export const normalize = (t: string) => t.normalize('NFKC').toLowerCase().replace(/[\s　·・]/g, '');

/** Starts-with matches first, then contains; same order as given otherwise. */
export function rankMatches<T>(items: T[], query: string, texts: (item: T) => (string | undefined)[]): T[] {
  const q = normalize(query);
  if (!q) return items;
  const scored: { item: T; score: number; i: number }[] = [];
  items.forEach((item, i) => {
    let best = -1;
    for (const t of texts(item)) {
      if (!t) continue;
      const n = normalize(t);
      if (n === q) best = Math.max(best, 3);
      else if (n.startsWith(q)) best = Math.max(best, 2);
      else if (n.includes(q)) best = Math.max(best, 1);
    }
    if (best >= 0) scored.push({ item, score: best, i });
  });
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).map(x => x.item);
}

/** Bold the part of `text` that matches what was typed. */
export function Highlight({ text, query }: { text: string; query: string }): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return text;
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + q.length)}</mark>{text.slice(at + q.length)}</>;
}

/**
 * A text field with a proper suggestion list (instead of the browser's
 * <datalist>). Free text is still allowed; the list just helps.
 * - Click in: shows everything (scrolls). Type: closest matches first.
 * - ↑/↓ to move, Enter to pick, Esc to close. Enter while converting
 *   Japanese input is left alone.
 * - Enter with the list closed calls onEnter (e.g. "add the next song").
 */
export default function SuggestInput({
  value, onChange, suggestions, onEnter, newLabel, wrapClassName, ...input
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions: Suggestion[];
  onEnter?: () => void;
  /** Shown when the typed text isn't in the list, e.g. 'New area'. */
  newLabel?: string;
  wrapClassName?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const matches = useMemo(
    () => rankMatches(suggestions, value, x => [x.value, x.hint, x.keywords]).slice(0, 60),
    [suggestions, value],
  );
  const exact = matches.some(m => normalize(m.value) === normalize(value) || (m.hint && normalize(m.hint) === normalize(value)));
  const showNew = !!newLabel && !!value.trim() && !exact;
  const visible = open && (matches.length > 0 || showNew);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function pick(s: Suggestion) {
    onChange(s.value);
    setOpen(false);
    setActive(-1);
  }

  return (
    <span className={`lu-combobox lu-suggest${wrapClassName ? ` ${wrapClassName}` : ''}`}>
      <input
        {...input}
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        onFocus={e => { setOpen(true); input.onFocus?.(e); }}
        onClick={() => setOpen(true)}
        onBlur={e => { setOpen(false); setActive(-1); input.onBlur?.(e); }}
        onChange={e => { onChange(e.target.value); setOpen(true); setActive(e.target.value.trim() ? 0 : -1); }}
        onKeyDown={e => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return; // Japanese IME converting
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive(i => Math.min(i + 1, matches.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive(i => Math.max(i - 1, -1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (visible && active >= 0 && matches[active]) pick(matches[active]);
            else { setOpen(false); onEnter?.(); }
          } else if (e.key === 'Escape') {
            if (visible) { e.preventDefault(); setOpen(false); }
          }
        }}
      />
      {visible && (
        <ul className="lu-options" role="listbox" id={listId} ref={listRef}>
          {matches.map((m, i) => (
            <li
              key={`${m.value}|${m.hint || ''}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : ''}
              onMouseDown={e => { e.preventDefault(); pick(m); }}
              onMouseEnter={() => setActive(i)}
            >
              <strong><Highlight text={m.value} query={value} /></strong>
              {m.hint && <> <span><Highlight text={m.hint} query={value} /></span></>}
            </li>
          ))}
          {showNew && (
            <li className="lu-option-new is-static" aria-disabled="true" onMouseDown={e => { e.preventDefault(); setOpen(false); }}>
              + {newLabel} “{value.trim()}”
            </li>
          )}
        </ul>
      )}
    </span>
  );
}
