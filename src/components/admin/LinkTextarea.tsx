import { useRef, useState } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import type { AdminStrings } from '../../i18n/admin';

const isUrl = (t: string) => /^https?:\/\/\S+$/.test(t.trim());

/**
 * A textarea that makes links easy without a rich-text editor. Links are
 * stored as Markdown, [text](https://…), and the site shows them as links.
 * - "🔗 Link" button: link the selected words (or add a new link).
 * - Select some words and paste a web address: they become a link.
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

  function insertLink() {
    if (!form || !isUrl(form.url)) return;
    const text = form.text.trim().replace(/[[\]]/g, '');
    replace(form.start, form.end, text ? `[${text}](${form.url.trim()})` : form.url.trim());
    setForm(null);
  }

  return (
    <div className="lu-linkarea">
      <textarea
        {...rest}
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onPaste={e => {
          const pasted = e.clipboardData.getData('text');
          const el = e.currentTarget;
          const selected = value.slice(el.selectionStart, el.selectionEnd);
          if (isUrl(pasted) && selected.trim() && !selected.includes('\n') && !isUrl(selected)) {
            e.preventDefault();
            replace(el.selectionStart, el.selectionEnd, `[${selected.replace(/[[\]]/g, '')}](${pasted.trim()})`);
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
            type="url"
            inputMode="url"
            placeholder="https://"
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
          <button type="button" className="lu-btn lu-btn-quiet" onMouseDown={e => e.preventDefault()} onClick={openForm}>🔗 {s.linkAdd}</button>
          <span className="lu-hint">{s.linkHint}</span>
        </div>
      )}
    </div>
  );
}
