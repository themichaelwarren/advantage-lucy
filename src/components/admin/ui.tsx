/**
 * Small building blocks shared by the admin forms, so every screen looks and
 * behaves the same: labelled fields with hints, sections, a sticky save bar,
 * an image drop zone, an on/off switch and a delete confirmation.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { uploadFile, AuthExpiredError } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import type { AdminStrings } from '../../i18n/admin';

export function Section({ title, children, aside, id, badge }: {
  title: string; children: ReactNode; aside?: ReactNode; id?: string;
  /** Small extra beside the title, e.g. a LockHint */
  badge?: ReactNode;
}) {
  return (
    <section className="lu-section" id={id}>
      <header className="lu-section-head">
        <h2>{title}{badge}</h2>
        {aside}
      </header>
      <div className="lu-section-body">{children}</div>
    </section>
  );
}

/**
 * Label + control + error. Pass the control as a render prop to get the id.
 * Most fields are optional, so only `required` ones are marked. A hint
 * sits behind an ⓘ beside the label (hover, focus or tap) instead of a
 * line of text under every field.
 */
export function Field({ label, hint, error, required, s, children, wide }: {
  label: string;
  hint?: string;
  error?: string;
  /** Kept for old call sites; optional is the default now and isn't shown */
  optional?: boolean;
  required?: boolean;
  s?: AdminStrings;
  wide?: boolean;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={`lu-field${error ? ' has-error' : ''}${wide ? ' is-wide' : ''}`}>
      <span className="lu-field-label">
        <label htmlFor={id}>{label}</label>
        {required && s && <span className="lu-required">{s.required}</span>}
        {hint && <InfoHint text={hint} />}
      </span>
      {children(id)}
      {error && <p className="lu-field-error">{error}</p>}
    </div>
  );
}

/** ⓘ with a short explanation on hover, keyboard focus or tap. */
export function InfoHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  return (
    <span ref={ref} className={`lu-lock lu-info${open ? ' is-open' : ''}`}>
      <button type="button" className="lu-lock-btn" aria-label={text} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
        </svg>
      </button>
      <span className="lu-lock-tip" role="tooltip">{text}</span>
    </span>
  );
}

/** A small heading over related fields inside a form or edit window. */
export function FieldGroup({ title, children }: { title?: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="lu-fieldgroup" role="group" aria-labelledby={title ? id : undefined}>
      {title && <p className="lu-fieldgroup-title" id={id}>{title}</p>}
      <div className="lu-fieldgroup-body">{children}</div>
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
export function SaveBar({ s, saving, savedAt, error, dirty, viewHref, backHref }: {
  s: AdminStrings;
  saving: boolean;
  savedAt: number | null;
  error: string;
  dirty: boolean;
  viewHref?: string;
  /** Where Back goes (a link, so unsaved edits are guarded). */
  backHref?: string;
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
        {backHref && <Link to={backHref} className="lu-btn">{s.back}</Link>}
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

/**
 * 🔒 with a short explanation that shows on hover, keyboard focus or tap
 * (e.g. "only the band sees this"). Tap again or tap elsewhere to hide it.
 */
export function LockHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  return (
    <span ref={ref} className={`lu-lock${open ? ' is-open' : ''}`}>
      <button type="button" className="lu-lock-btn" aria-label={text} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </button>
      <span className="lu-lock-tip" role="tooltip">{text}</span>
    </span>
  );
}

/**
 * "Are you sure?" before removing something. Esc or Cancel keeps it.
 */
export function ConfirmDialog({ s, open, title, body, confirmLabel, onConfirm, onCancel }: {
  s: AdminStrings;
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="lu-modal-overlay" onClick={onCancel}>
      <div className="lu-modal" role="alertdialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        {body && <p>{body}</p>}
        <div className="lu-modal-actions">
          <button ref={cancelRef} type="button" className="lu-btn" onClick={onCancel}>{s.cancel}</button>
          <button type="button" className="lu-btn lu-btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * A small window for editing one section of a read-mode page. Esc or a
 * click outside cancels; the form inside submits with Save (or Enter).
 */
export function EditDialog({ s, title, open, onClose, onSave, saving, error, children, footer, dirty = true }: {
  s: AdminStrings;
  title: string;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
  error?: string;
  children: ReactNode;
  /** Left side of the buttons row, e.g. Delete */
  footer?: ReactNode;
  /** Save only lights up once something has changed */
  dirty?: boolean;
}) {
  const box = useRef<HTMLFormElement>(null);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  // Focus the first field once, when the window opens (not on every change)
  useEffect(() => {
    if (open) box.current?.querySelector<HTMLElement>('.lu-edit-dialog-body :is(input, select, textarea)')?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
      // ⌘↵ / Ctrl+↵ saves from anywhere in the window
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !saving && dirty) { e.preventDefault(); onSave(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, saving, onClose, onSave, dirty]);
  // The page behind doesn't scroll while the window is open
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="lu-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <form
        ref={box}
        className="lu-modal lu-edit-dialog"
        role="dialog" aria-modal="true" aria-label={title}
        onSubmit={e => { e.preventDefault(); if (dirty) onSave(); }}
        noValidate
      >
        <header className="lu-edit-dialog-head">
          <h3>{title}</h3>
          <button type="button" className="lu-icon-btn" onClick={onClose} disabled={saving} aria-label={s.close}>✕</button>
        </header>
        <div className="lu-edit-dialog-body">{children}</div>
        <footer className="lu-edit-dialog-foot">
          {error && <p className="lu-field-error lu-edit-dialog-error">{s.errorPrefix} {error}</p>}
          <div className="lu-modal-actions">
            {footer && <span className="lu-edit-dialog-footer">{footer}</span>}
            <button type="button" className="lu-btn" onClick={onClose} disabled={saving}>{s.cancel}</button>
            <button type="submit" className="lu-btn lu-btn-primary" disabled={saving || !dirty} title={isMac ? '⌘↵' : 'Ctrl+Enter'}>
              {saving ? s.saving : s.save}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

/**
 * Don't lose unsaved edits.
 * - Closing or reloading the tab: the browser's own "Leave site?" warning.
 * - Clicking a link inside the admin (sidebar, Back, links on the page):
 *   asks "Save and go", "Leave without saving" or "Stay". "Save and go"
 *   submits the page's form and only moves on if the save worked.
 * Render the returned element anywhere in the page.
 */
export function useUnsavedWarning(dirty: boolean, saving = false): ReactNode {
  const { s } = useAdminT();
  const navigate = useNavigate();
  const [target, setTarget] = useState<string | null>(null);
  const pending = useRef<string | null>(null);
  const sawSaving = useRef(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    // Capture phase on document runs before React Router's link handler
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setTarget(url.pathname + url.search + url.hash);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  // "Save and go": move on once the save finishes, if nothing is left unsaved
  useEffect(() => {
    if (saving) { sawSaving.current = true; return; }
    if (sawSaving.current && pending.current) {
      const to = pending.current;
      pending.current = null;
      if (!dirtyRef.current) navigate(to);
    }
    sawSaving.current = false;
  }, [saving, navigate]);

  function saveAndGo(to: string) {
    setTarget(null);
    pending.current = to;
    sawSaving.current = false;
    document.querySelector<HTMLFormElement>('form.lu-form')?.requestSubmit();
    // Save didn't start (e.g. a required field is empty): stay and show why
    window.setTimeout(() => { if (!sawSaving.current) pending.current = null; }, 300);
  }

  if (!target) return null;
  return (
    <div className="lu-modal-overlay" onClick={() => setTarget(null)}>
      <div className="lu-modal" role="dialog" aria-modal="true" aria-labelledby="lu-leave-title" onClick={e => e.stopPropagation()}>
        <h3 id="lu-leave-title">{s.leaveTitle}</h3>
        <p>{s.leaveBody}</p>
        <div className="lu-modal-actions lu-leave-actions">
          <button type="button" className="lu-btn" onClick={() => setTarget(null)}>{s.leaveStay}</button>
          <button type="button" className="lu-btn lu-btn-danger-quiet" onClick={() => { const to = target; setTarget(null); navigate(to); }}>{s.leaveDiscard}</button>
          <button type="button" className="lu-btn lu-btn-primary" autoFocus onClick={() => saveAndGo(target)}>{s.leaveSave}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * "2025-11-30" + "Shimokitazawa" → "2025-11-30-shimokitazawa"; adds -2, -3… if taken.
 * Names with no letters or digits we can use (e.g. only Japanese) get a short
 * unique code instead, like "id-mw8o1mgv".
 */
export function makeId(parts: (string | undefined)[], taken: Set<string>): string {
  const base = parts
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `id-${Date.now().toString(36)}`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
