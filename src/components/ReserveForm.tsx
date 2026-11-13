import { useEffect, useRef, useState } from 'react';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import Turnstile, { type TurnstileHandle } from './Turnstile';
import { toKatakana, isKatakana, needsKana } from '../../functions/lib/kana';

export type ReserveFormState = 'loading' | 'off' | 'closed' | 'full' | 'open';

/** What the window shows about the show, already worded for the page's language. */
export interface ShowSummary {
  title: string;
  date: string;     // e.g. "2026.11.29（日曜日）"
  times: string;    // e.g. "開場 17:30 / 開演 18:00"
  venue: string;
  price: string;    // e.g. "前売 ¥3,000 / 当日 ¥3,300"
}

type Step = 'form' | 'confirm' | 'done';

/**
 * Ticket reservations (取り置き) for an upcoming show.
 *
 * On the page: a small card ("taking reservations until …" + a button).
 * The button opens a window with three steps: fill in → check → done.
 * The check step reads everything back (the email in large type, since a
 * typo there means no confirmation email) before anything is sent.
 *
 * Asks the server whether the show is still taking reservations (it closes
 * by itself at the cutoff or when tickets run out); books through
 * /api/reserve, which emails the fan and the band.
 */
export default function ReserveForm({ locale, eventId, show, open, onOpenChange, onState, preview }: {
  locale: Locale;
  eventId: string;
  show: ShowSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onState?: (state: ReserveFormState) => void;
  /** Local dev only (?preview-reserve): show the form open and pretend to book, writing nothing */
  preview?: boolean;
}) {
  const s = t(locale).reserve;
  const [state, setState] = useState<ReserveFormState>('loading');
  const [max, setMax] = useState(0);
  const [closes, setCloses] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState({ name: '', kana: '', email: '', tickets: 1, note: '', website: '' });
  // Japanese form: the name's reading (フリガナ), needed when the name has kanji
  const askKana = locale === 'ja';
  const kanaNeeded = askKana && needsKana(form.name);
  // Each problem is said right under its own field, which gets a red outline
  // (as soon as they leave the box, and on 次へ, which also jumps to the first one)
  type Field = 'name' | 'kana' | 'email' | 'tickets';
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const refs = { name: useRef<HTMLInputElement>(null), kana: useRef<HTMLInputElement>(null), email: useRef<HTMLInputElement>(null), tickets: useRef<HTMLDivElement>(null) };
  const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const problem = (f: Field, v = form): string => {
    if (f === 'name') return v.name.trim() ? '' : s.needName;
    if (f === 'kana') return !askKana ? '' : v.kana.trim() && !isKatakana(v.kana) ? s.badKana : needsKana(v.name) && !v.kana.trim() ? s.needKana : '';
    if (f === 'email') return EMAIL_OK.test(v.email.trim()) ? '' : s.badEmail;
    return '';
  };
  const setFieldError = (f: Field, msg: string) => setFieldErrors(e => ({ ...e, [f]: msg }));
  const clearFieldError = (f: Field) => setFieldErrors(e => (e[f] ? { ...e, [f]: '' } : e));
  const showFirst = (errs: Partial<Record<Field, string>>) => {
    const first = (['name', 'kana', 'email', 'tickets'] as Field[]).find(f => errs[f]);
    const el = first && refs[first].current;
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); (el as HTMLElement).focus?.({ preventScroll: true }); }
  };
  const errorFor = (f: Field) => fieldErrors[f]
    ? <span id={`reserve-${f}-error`} className="reserve-field-error" role="alert">{fieldErrors[f]}</span> : null;
  const invalid = (f: Field) => ({ 'aria-invalid': !!fieldErrors[f], 'aria-describedby': fieldErrors[f] ? `reserve-${f}-error` : undefined, className: fieldErrors[f] ? 'has-error' : undefined });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ tickets: number; email: string; emailed: boolean; updated: boolean } | null>(null);
  const startedAt = useRef(Date.now());
  const turnstile = useRef<TurnstileHandle>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (preview) { setState('open'); setMax(4); setCloses(''); return; }
    let alive = true;
    fetch(`/api/reserve?event=${encodeURIComponent(eventId)}`)
      .then(r => (r.ok ? r.json() : { state: 'off' }))
      .then(d => {
        if (!alive) return;
        setState(d.state || 'off');
        setMax(d.max || 0);
        setCloses(d.closes || '');
      })
      .catch(() => alive && setState('off'));
    return () => { alive = false; };
  }, [eventId, preview]);

  useEffect(() => { onState?.(state); }, [state, onState]);

  // The window: Esc closes it, the page behind doesn't scroll, focus goes in and comes back out
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      opener.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Each step starts at the top, with focus on its first field or its heading
  useEffect(() => {
    if (!open) return;
    const el = dialog.current;
    if (!el) return;
    el.scrollTop = 0;
    // With a mouse, straight into the first field. On phones the heading
    // instead: focusing a field would throw the keyboard up over the form
    const typing = step === 'form' && !form.name && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const target = typing ? el.querySelector<HTMLElement>('input') : el.querySelector<HTMLElement>('h2');
    target?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  function close() {
    onOpenChange(false);
    if (step === 'done') setStep('form');   // what was typed is kept otherwise, in case they come back
  }

  function toConfirm(e: React.FormEvent) {
    e.preventDefault();
    const errs = { name: problem('name'), kana: problem('kana'), email: problem('email') };
    setFieldErrors(errs);
    if (Object.values(errs).some(Boolean)) { showFirst(errs); return; }
    setError('');
    setStep('confirm');
  }

  async function submit() {
    setSending(true);
    setError('');
    if (preview) {
      await new Promise(r => setTimeout(r, 600));
      setDone({ tickets: form.tickets, email: form.email.trim(), emailed: true, updated: false });
      setStep('done');
      setSending(false);
      return;
    }
    try {
      const res = await fetch('/api/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: eventId, locale,
          name: form.name, kana: askKana ? toKatakana(form.kana) : '', email: form.email, tickets: form.tickets, note: form.note,
          website: form.website, started_at: startedAt.current,
          turnstile_token: turnstile.current?.token() || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        turnstile.current?.reset(); // tokens are single-use
        if (data.error === 'too_many' && data.max) {
          // Someone booked meanwhile: fewer tickets are left. Back to the form to pick again.
          setMax(data.max);
          setForm(f => ({ ...f, tickets: Math.min(f.tickets, data.max) }));
          setStep('form');
        }
        if (data.error === 'full') setState('full');
        if (data.error === 'closed') setState('closed');
        const fieldMsg: Partial<Record<Field, string>> | null =
          data.error === 'email' ? { email: s.badEmail }
          : data.error === 'kana_required' ? { kana: s.needKana }
          : data.error === 'kana' ? { kana: s.badKana }
          : data.error === 'too_many' ? { tickets: s.tooMany.replace('{n}', String(data.max || max)) }
          : data.error === 'required' && data.field === 'name' ? { name: s.needName }
          : null;
        if (fieldMsg) {
          setStep('form');
          setFieldErrors(fieldMsg);
          setTimeout(() => showFirst(fieldMsg), 50);
          setError('');
          return;
        }
        setError(data.error === 'too_many' ? s.tooMany.replace('{n}', String(data.max || max))
          : data.error === 'slow_down' ? s.slowDown
          : data.error === 'verify' ? s.verifyFailed
          : data.error === 'email' ? s.badEmail
          : data.error === 'kana_required' ? s.needKana
          : data.error === 'kana' ? s.badKana
          : data.error === 'full' ? s.full
          : data.error === 'closed' ? s.closed
          : s.failed);
        return;
      }
      setDone({ tickets: data.tickets || form.tickets, email: form.email.trim(), emailed: data.emailed !== false, updated: !!data.updated });
      setStep('done');
    } catch {
      setError(s.failed);
    } finally {
      setSending(false);
    }
  }

  if (state === 'loading' || state === 'off') return null;

  const closesText = closes
    ? new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-GB', {
        month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
      }).format(new Date(`${closes}:00Z`))
    : '';
  const ticketsText = (n: number) => s.ticketsN.replace('{n}', String(n));
  const stepNo = step === 'form' ? 1 : step === 'confirm' ? 2 : 3;

  return (
    <section className="evd-section" id="reserve">
      <h2 className="section-label">{s.title}</h2>

      {/* On the page: a small card */}
      <div className={`reserve-card${state !== 'open' && !done ? ' is-closed' : ''}${done ? ' is-done' : ''}`}>
        <span className="reserve-card-icon" aria-hidden="true">{done ? '✓' : '🎫'}</span>
        <div className="reserve-card-text">
          {done ? (
            <>
              <strong>{s.booked.replace('{n}', ticketsText(done.tickets))}</strong>
              <span>{s.bookedHint}</span>
            </>
          ) : state === 'open' ? (
            <>
              <strong>{s.cardOpen}</strong>
              <span>{closesText ? s.closes.replace('{at}', closesText) : s.intro}</span>
            </>
          ) : (
            <strong>{state === 'full' ? s.full : s.closed}</strong>
          )}
        </div>
        {state === 'open' && !done && (
          <button type="button" className="contact-submit reserve-card-btn" onClick={() => onOpenChange(true)}>
            {s.button} <span aria-hidden="true">→</span>
          </button>
        )}
      </div>

      {open && (
        <div className="reserve-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
          <div ref={dialog} className="reserve-dialog" role="dialog" aria-modal="true" aria-labelledby="reserve-step-title">
            <div className="reserve-dialog-top">
              <ol className="reserve-steps" aria-label={s.stepsLabel}>
                {[s.stepForm, s.stepConfirm, s.stepDone].map((label, i) => (
                  <li key={label} className={i + 1 === stepNo ? 'is-on' : i + 1 < stepNo ? 'is-past' : ''} aria-current={i + 1 === stepNo ? 'step' : undefined}>
                    <span>{i + 1 < stepNo ? '✓' : i + 1}</span>{label}
                  </li>
                ))}
              </ol>
              <button type="button" className="reserve-close" onClick={close} aria-label={s.close}>✕</button>
            </div>

            {/* The show, so nobody books the wrong night */}
            {step !== 'done' && (
              <div className="reserve-show">
                <strong>{show.title}</strong>
                <span>{show.date}{show.times && ` · ${show.times}`}</span>
                <span>{show.venue}</span>
                {show.price && <span>{show.price}</span>}
              </div>
            )}

            {step === 'form' && (
              <form className="reserve-form" onSubmit={toConfirm} noValidate>
                <h2 id="reserve-step-title" className="reserve-step-title" tabIndex={-1}>{s.title}</h2>
                <label className="reserve-field">
                  <span>{s.name}</span>
                  <input ref={refs.name} value={form.name} autoComplete="name" {...invalid('name')}
                    onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError(''); clearFieldError('name'); }} />
                  {errorFor('name')}
                </label>
                {askKana && (
                  <label className="reserve-field">
                    <span>{s.kana}{!kanaNeeded && <em className="reserve-optional"> {s.kanaOptional}</em>}</span>
                    {/* Hiragana is fine too: it becomes katakana when they leave the box */}
                    <input ref={refs.kana} value={form.kana} lang="ja" autoComplete="off" placeholder={s.kanaPlaceholder} {...invalid('kana')}
                      onChange={e => { setForm(f => ({ ...f, kana: e.target.value })); setError(''); clearFieldError('kana'); }}
                      onBlur={() => { const k = toKatakana(form.kana); setForm(f => ({ ...f, kana: k })); if (k && !isKatakana(k)) setFieldError('kana', s.badKana); }} />
                    {errorFor('kana')}
                  </label>
                )}
                <label className="reserve-field">
                  <span>{s.email}</span>
                  <input ref={refs.email} type="email" inputMode="email" autoComplete="email" value={form.email} {...invalid('email')}
                    onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setError(''); clearFieldError('email'); }}
                    onBlur={() => { if (form.email.trim() && !EMAIL_OK.test(form.email.trim())) setFieldError('email', s.badEmail); }} />
                  {errorFor('email') || <em>{s.emailHint}</em>}
                </label>
                <div ref={refs.tickets} tabIndex={-1} className={`reserve-tickets${fieldErrors.tickets ? ' has-error' : ''}`} role="radiogroup" aria-label={s.tickets}>
                  <span className="reserve-label">{s.tickets}</span>
                  <div className="reserve-counts">
                    {Array.from({ length: max }, (_, i) => i + 1).map(n => (
                      <button
                        key={n} type="button" role="radio" aria-checked={form.tickets === n}
                        className={`reserve-count${form.tickets === n ? ' is-on' : ''}`}
                        onClick={() => { setForm(f => ({ ...f, tickets: n })); setError(''); clearFieldError('tickets'); }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {errorFor('tickets')}
                </div>
                <label className="reserve-field">
                  <span>{s.note} <em>· {s.optional}</em></span>
                  <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                </label>
                {/* Honeypot: hidden from people, irresistible to bots */}
                <input className="contact-hp" tabIndex={-1} aria-hidden="true" autoComplete="off" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
                {error && <p className="contact-error" role="alert">{error}</p>}
                <div className="reserve-actions">
                  <button type="submit" className="contact-submit">{s.next} <span aria-hidden="true">→</span></button>
                </div>
              </form>
            )}

            {step === 'confirm' && (
              <div className="reserve-confirm">
                <h2 id="reserve-step-title" className="reserve-step-title" tabIndex={-1}>{s.confirmTitle}</h2>
                <dl className="reserve-review">
                  <dt>{s.name}</dt><dd>{form.name.trim()}{askKana && form.kana.trim() && <span className="reserve-review-kana">{toKatakana(form.kana)}</span>}</dd>
                  <dt>{s.tickets}</dt><dd className="reserve-review-big">{ticketsText(form.tickets)}</dd>
                  <dt>{s.email}</dt><dd className="reserve-review-big reserve-review-email">{form.email.trim()}</dd>
                  {form.note.trim() && (<><dt>{s.note}</dt><dd>{form.note.trim()}</dd></>)}
                </dl>
                <p className="reserve-pay">{s.payNote}</p>
                <Turnstile ref={turnstile} locale={locale} />
                {error && <p className="contact-error" role="alert">{error}</p>}
                <div className="reserve-actions">
                  <button type="button" className="contact-submit" onClick={submit} disabled={sending}>
                    {sending ? s.sending : <>{s.submit} <span aria-hidden="true">→</span></>}
                  </button>
                  <button type="button" className="contact-secondary" onClick={() => { setError(''); setStep('form'); }} disabled={sending}>← {s.back}</button>
                </div>
                <p className="reserve-fineprint">{s.sameEmail}</p>
              </div>
            )}

            {step === 'done' && done && (
              <div className="reserve-done">
                <h2 id="reserve-step-title" className="reserve-done-title" tabIndex={-1}>✓ {done.updated ? s.updated : s.thanks}</h2>
                <p>{s.doneTickets.replace('{n}', String(done.tickets))}</p>
                <div className="reserve-show is-done">
                  <strong>{show.title}</strong>
                  <span>{show.date}{show.times && ` · ${show.times}`}</span>
                  <span>{show.venue}</span>
                </div>
                <p className="reserve-done-hint">{done.emailed ? s.emailSent.replace('{email}', done.email) : s.emailLater}</p>
                <div className="reserve-actions">
                  <button type="button" className="contact-secondary" onClick={close}>{s.close}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
