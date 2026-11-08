/**
 * Small building blocks shared by the admin forms, so every screen looks and
 * behaves the same: labelled fields with hints, sections, a sticky save bar,
 * an image drop zone, an on/off switch and a delete confirmation.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { uploadFile, AuthExpiredError } from '../../services/adminService';
import type { AdminStrings } from '../../i18n/admin';

export function Section({ title, children, aside, id }: { title: string; children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <section className="lu-section" id={id}>
      <header className="lu-section-head">
        <h2>{title}</h2>
        {aside}
      </header>
      <div className="lu-section-body">{children}</div>
    </section>
  );
}

/** Label + control + optional hint/error. Pass the control as a render prop to get the id. */
export function Field({ label, hint, error, optional, s, children, wide }: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  s?: AdminStrings;
  wide?: boolean;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={`lu-field${error ? ' has-error' : ''}${wide ? ' is-wide' : ''}`}>
      <label htmlFor={id}>
        {label}
        {optional && s && <span className="lu-optional"> · {s.optional}</span>}
      </label>
      {children(id)}
      {error ? <p className="lu-field-error">{error}</p> : hint ? <p className="lu-hint">{hint}</p> : null}
    </div>
  );
}

/** English / 日本語 side by side (stacked on phones). */
export function BilingualRow({ children }: { children: ReactNode }) {
  return <div className="lu-bilingual">{children}</div>;
}

export function Switch({ checked, onChange, label, hint }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="lu-switch-row">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className="lu-switch"
        onClick={() => onChange(!checked)}
      >
        <span className="lu-switch-knob" />
      </button>
      <label htmlFor={id}>
        <span className="lu-switch-label">{label}</span>
        {hint && <span className="lu-hint">{hint}</span>}
      </label>
    </div>
  );
}

/** Bottom bar with the one Save button and what happened. */
export function SaveBar({ s, saving, savedAt, error, dirty, viewHref, onCancel }: {
  s: AdminStrings;
  saving: boolean;
  savedAt: number | null;
  error: string;
  dirty: boolean;
  viewHref?: string;
  onCancel?: () => void;
}) {
  // Show "Saved ✓" for a few seconds after each save
  const [showSaved, setShowSaved] = useState(false);
  useEffect(() => {
    if (!savedAt) return;
    setShowSaved(true);
    const t = window.setTimeout(() => setShowSaved(false), 4000);
    return () => window.clearTimeout(t);
  }, [savedAt]);

  return (
    <div className={`lu-savebar${error ? ' has-error' : ''}`} role="region" aria-label={s.save}>
      <div className="lu-savebar-status" aria-live="polite">
        {error ? (
          <span className="lu-status-error">{s.errorPrefix} {error}</span>
        ) : saving ? (
          <span>{s.saving}</span>
        ) : showSaved ? (
          <span className="lu-status-ok">✓ {s.saved}{viewHref && <> · <Link to={viewHref}>{s.viewOnSite} →</Link></>}</span>
        ) : dirty ? (
          <span className="lu-status-dirty">● {s.unsaved}</span>
        ) : viewHref ? (
          <Link to={viewHref}>{s.viewOnSite} →</Link>
        ) : null}
      </div>
      <div className="lu-savebar-actions">
        {onCancel && <button type="button" className="lu-btn" onClick={onCancel}>{s.back}</button>}
        <button type="submit" className="lu-btn lu-btn-primary lu-btn-lg" disabled={saving}>
          {saving ? s.saving : s.save}
        </button>
      </div>
    </div>
  );
}

/** Drag-and-drop or click-to-choose image upload, with preview and paste-a-link fallback. */
export function ImageField({ s, value, onChange, onError }: {
  s: AdminStrings;
  value: string;
  onChange: (url: string) => void;
  onError: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [over, setOver] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      onChange(await uploadFile(file));
    } catch (err) {
      onError(err instanceof AuthExpiredError ? err.message : `${err}`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="lu-image">
      <button
        type="button"
        className={`lu-dropzone${over ? ' is-over' : ''}${value ? ' has-image' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files?.[0]); }}
        disabled={uploading}
      >
        {value ? <img src={value} alt="" /> : null}
        <span className="lu-dropzone-label">
          {uploading ? s.imageUploading : value ? s.imageReplace : s.imageDrop}
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={e => upload(e.target.files?.[0])} />
      <div className="lu-image-row">
        <input
          type="url"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={s.imagePasteUrl}
        />
        {value && <button type="button" className="lu-btn lu-btn-quiet" onClick={() => onChange('')}>{s.remove}</button>}
      </div>
    </div>
  );
}

/** Delete button that opens a type-"delete" confirmation. */
export function DeleteButton({ s, onConfirm, label }: { s: AdminStrings; onConfirm: () => Promise<void>; label?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  return (
    <>
      <button type="button" className="lu-btn lu-btn-danger-quiet" onClick={() => { setText(''); setOpen(true); }}>
        {label || s.delete}
      </button>
      {open && (
        <div className="lu-modal-overlay" onClick={() => !busy && setOpen(false)}>
          <div className="lu-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <h3>{s.confirmDeleteTitle}</h3>
            <p>{s.confirmDeleteBody}</p>
            <label className="lu-hint" htmlFor="lu-confirm-delete">{s.confirmDeleteType}</label>
            <input
              id="lu-confirm-delete"
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="delete"
              autoComplete="off"
            />
            <div className="lu-modal-actions">
              <button type="button" className="lu-btn" onClick={() => setOpen(false)} disabled={busy}>{s.cancel}</button>
              <button
                type="button"
                className="lu-btn lu-btn-danger"
                disabled={text.trim().toLowerCase() !== 'delete' || busy}
                onClick={async () => {
                  setBusy(true);
                  try { await onConfirm(); setOpen(false); } finally { setBusy(false); }
                }}
              >
                {busy ? s.deleting : s.deleteForever}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Warn before leaving a page with unsaved edits. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}

/** "2025-11-30" + "Shimokitazawa" → "2025-11-30-shimokitazawa"; adds -2, -3… if taken. */
export function makeId(parts: (string | undefined)[], taken: Set<string>): string {
  const base = parts
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
