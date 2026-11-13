import Icon from './Icon';
import { useRef, useState } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import type { AdminStrings } from '../../i18n/admin';
import { toSitePath } from '../../utils/siteLinks';

// A web address, or one of our own pages ("/songs/shiroi-asa")
const isUrl = (t: string) => /^(https?:\/\/|\/(?!\/))\S*$/.test(t.trim());
/** Our own pages are kept short ("/songs/shiroi-asa"), so they work in either language */
const linkTo = (url: string) => toSitePath(url) ?? url.trim();

/**
 * A textarea that makes links easy without a rich-text editor. Links are
 * stored as Markdown, [text](https://…), and the site shows them as links.
 * - "🔗 Link" button: link the selected words (or add a new link).
 * - Select some words and paste a web address: they become a link.
 * - "B" button or ⌘B / Ctrl+B: **bold** (press again to undo).
 */
export default function LinkTextarea({ s, value, onChange, ...rest }: {
  s: AdminStrings;
  value: string;
  onChange: (value: string) => void;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [form, setForm] = useState<{ text: string; url: string; start: number; end: number } | null>(null);

  function replace(start: number, end: number, insert: string) {
    onChange(value.slice(0, start) + insert + value.slice(end));
    const caret = start + insert.length;
    requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(caret, caret); });
  }

  function openForm() {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    setForm(isUrl(selected) ? { text: '', url: selected.trim(), start, end } : { text: selected, url: '', start, end });
  }

  /** Wrap the selection in **…**, or unwrap the bold part the cursor is in. */
  function toggleBold() {
    const el = ref.current;
    if (!el) return;
    let start = el.selectionStart, end = el.selectionEnd;
    // Already bold? (cursor or selection inside, or on, a **…** on this line)
    for (const m of value.matchAll(/\*\*([^*\n]+?)\*\*/g)) {
      const mStart = m.index ?? 0, mEnd = mStart + m[0].length;
      if (start >= mStart && end <= mEnd && !(start === mEnd && end === mEnd)) {
        onChange(value.slice(0, mStart) + m[1] + value.slice(mEnd));
        requestAnimationFrame(() => { el.focus(); el.setSelectionRange(mStart, mStart + m[1].length); });
        return;
      }
    }
    // Leave spaces outside the stars (double-click often selects one)
    while (start < end && /\s/.test(value[start])) start++;
    while (end > start && /\s/.test(value[end - 1])) end--;
    const word = value.slice(start, end).replace(/\*\*/g, '') || s.boldPlaceholder;
    onChange(value.slice(0, start) + `**${word}**` + value.slice(end));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + 2, start + 2 + word.length); });
  }

  function insertLink() {
    if (!form || !isUrl(form.url)) return;
    const text = form.text.trim().replace(/[[\]]/g, '');
    replace(form.start, form.end, text ? `[${text}](${linkTo(form.url)})` : form.url.trim());
    setForm(null);
  }

  return (
    <div className="lu-linkarea">
      <textarea
        {...rest}
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleBold(); }
          if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); openForm(); }
          rest.onKeyDown?.(e);
        }}
        onPaste={e => {
          const pasted = e.clipboardData.getData('text');
          const el = e.currentTarget;
          const selected = value.slice(el.selectionStart, el.selectionEnd);
          if (isUrl(pasted) && selected.trim() && !selected.includes('\n') && !isUrl(selected)) {
            e.preventDefault();
            replace(el.selectionStart, el.selectionEnd, `[${selected.replace(/[[\]]/g, '')}](${linkTo(pasted)})`);
          }
        }}
      />
      {form ? (
        <div className="lu-linkform">
          <input
            placeholder={s.linkText}
            aria-label={s.linkText}
            value={form.text}
            onChange={e => setForm({ ...form, text: e.target.value })}
            autoFocus={!form.text}
          />
          <input
            inputMode="url"
            placeholder="https://  /songs/…"
            aria-label={s.linkUrl}
            value={form.url}
            onChange={e => setForm({ ...form, url: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); insertLink(); } if (e.key === 'Escape') setForm(null); }}
            autoFocus={!!form.text}
          />
          <button type="button" className="lu-btn" onClick={() => setForm(null)}>{s.cancel}</button>
          <button type="button" className="lu-btn lu-btn-primary" disabled={!isUrl(form.url)} onClick={insertLink}>{s.linkInsert}</button>
        </div>
      ) : (
        <div className="lu-linkbar">
          <button type="button" className="lu-btn lu-btn-quiet lu-btn-bold" onMouseDown={e => e.preventDefault()} onClick={toggleBold} title={`${s.boldAdd} (⌘B)`} aria-label={s.boldAdd}>B</button>
          <button type="button" className="lu-btn lu-btn-quiet" onMouseDown={e => e.preventDefault()} onClick={openForm} title={`${s.linkAdd} (⌘K)`}><Icon name="link" /> {s.linkAdd}</button>
          <span className="lu-hint">{s.linkHint}</span>
        </div>
      )}
    </div>
  );
}
