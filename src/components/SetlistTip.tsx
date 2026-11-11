import { useRef, useState } from 'react';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { shrinkImage } from '../utils/shrinkImage';
import Turnstile, { type TurnstileHandle } from './Turnstile';

const MAX_PHOTOS = 3;

/**
 * Crowdsourcing old setlists: a button that opens a small form where fans
 * can share what was played. Goes through /api/contact (topic "setlist"),
 * so it's emailed to the band and listed in the admin's Messages; nothing
 * is published until the band adds it.
 *
 * variant "empty": the big prompt inside the "no setlist yet" card.
 * variant "fix": a small link under an existing setlist.
 */
export default function SetlistTip({ locale, eventId, eventTitle, variant }: {
  locale: Locale;
  eventId: string;
  eventTitle: string;
  variant: 'empty' | 'fix';
}) {
  const s = t(locale).setlist;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ message: '', name: '', email: '', website: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const startedAt = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  // Photos are shrunk (and stripped of location data) as soon as they're picked
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [preparing, setPreparing] = useState(false);

  async function addPhotos(list: FileList | null) {
    if (!list?.length) return;
    if (photos.length + list.length > MAX_PHOTOS) { setError(s.tooMany); return; }
    setPreparing(true);
    setError('');
    try {
      const shrunk = await Promise.all([...list].map(f => shrinkImage(f)));
      setPhotos(p => [...p, ...shrunk.map(file => ({ file, url: URL.createObjectURL(file) }))]);
    } catch {
      setError(s.badPhoto);
    } finally {
      setPreparing(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.message.trim()) { setError(s.required); return; }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) { setError(s.badEmail); return; }
    setStatus('sending');
    setError('');
    try {
      const payload = {
          topic: 'setlist',
          event: eventId,
          event_title: eventTitle,
          locale,
          name_given: form.name,
          email: form.email,
          message: form.message,
          website: form.website,
          started_at: startedAt.current,
          turnstile_token: turnstile.current?.token() || '',
      };
      // With photos: multipart (payload + files); without: plain JSON
      let res: Response;
      if (photos.length) {
        const body = new FormData();
        body.append('payload', JSON.stringify(payload));
        photos.forEach(p => body.append('files', p.file));
        res = await fetch('/api/contact', { method: 'POST', body });
      } else {
        res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        turnstile.current?.reset(); // tokens are single-use
        setError(data.error === 'slow_down' ? s.slowDown
          : data.error === 'verify' ? s.verifyFailed
          : data.error === 'too_many_files' ? s.tooMany
          : ['file_type', 'file_too_big'].includes(data.error) ? s.badPhoto
          : s.failed);
        setStatus('idle');
        return;
      }
      photos.forEach(p => URL.revokeObjectURL(p.url));
      setStatus('sent');
    } catch {
      setError(s.failed);
      setStatus('idle');
    }
  }

  if (status === 'sent') {
    return <p className="setlist-tip-thanks" role="status">✓ {s.thanks}</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        className={variant === 'empty' ? 'setlist-tip-cta' : 'setlist-tip-link'}
        onClick={() => { startedAt.current = Date.now(); setOpen(true); }}
      >
        {variant === 'empty' ? s.share : s.fix}
      </button>
    );
  }

  return (
    <form className="setlist-tip-form" onSubmit={submit} noValidate>
      <label htmlFor={`tip-${eventId}`} className="setlist-tip-title">{s.formTitle}</label>
      <p className="setlist-tip-hint">{s.formHint}</p>
      <textarea
        id={`tip-${eventId}`}
        rows={8}
        // Phones: no keyboard until they tap the box
        autoFocus={typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches}
        value={form.message}
        onChange={e => { setForm(f => ({ ...f, message: e.target.value })); setError(''); }}
      />
      <div className="setlist-tip-photos">
        {photos.map((p, i) => (
          <span key={p.url} className="setlist-tip-photo">
            <img src={p.url} alt="" />
            <button type="button" aria-label={s.removePhoto} onClick={() => { URL.revokeObjectURL(p.url); setPhotos(ps => ps.filter((_, j) => j !== i)); }}>✕</button>
          </span>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button type="button" className="setlist-tip-add" onClick={() => fileInput.current?.click()} disabled={preparing}>
            <span aria-hidden="true">📷</span> {preparing ? s.sending : s.addPhotos}
          </button>
        )}
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={e => addPhotos(e.target.files)} />
        <span className="setlist-tip-photos-hint">{s.photosHint}</span>
      </div>
      <div className="setlist-tip-row">
        <label>
          <span>{s.yourName} <em>· {s.optional}</em></span>
          <input value={form.name} autoComplete="name" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </label>
        <label>
          <span>{s.yourEmail} <em>· {s.optional}</em></span>
          <input type="email" inputMode="email" autoComplete="email" value={form.email} onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setError(''); }} />
        </label>
      </div>
      {/* Honeypot: hidden from people, irresistible to bots */}
      <input className="contact-hp" tabIndex={-1} aria-hidden="true" autoComplete="off" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
      <Turnstile ref={turnstile} locale={locale} />
      {error && <p className="contact-error" role="alert">{error}</p>}
      <div className="setlist-tip-actions">
        <button type="submit" className="contact-submit" disabled={status === 'sending' || preparing}>
          {status === 'sending' ? s.sending : <>{s.send} <span aria-hidden="true">→</span></>}
        </button>
        <button type="button" className="contact-secondary" onClick={() => setOpen(false)}>{s.cancel}</button>
      </div>
    </form>
  );
}
