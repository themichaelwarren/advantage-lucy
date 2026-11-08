import { useRef, useState } from 'react';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import Turnstile, { type TurnstileHandle } from './Turnstile';

// The "Say hello" options from the original Tally form (mixing languages is half the charm)
const GREETINGS = ['hi', 'hey', 'hello', 'hello again', 'ヤッホー', 'こんにちは', 'こんにづは', 'どうも'];

type Field = 'name_family' | 'name_given' | 'email' | 'message';

/**
 * The site's own contact form (replaces the Tally embed): matches the site
 * in both themes and languages. Submissions go to /api/contact, which saves
 * them to the band's sheet and emails the band.
 */
export default function ContactForm({ locale }: { locale: Locale }) {
  const s = t(locale).contact;
  const [form, setForm] = useState({ greeting: 'hello', name_family: '', name_given: '', email: '', message: '', website: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [formError, setFormError] = useState('');
  const [sentName, setSentName] = useState('');
  const startedAt = useRef(Date.now());
  const turnstile = useRef<TurnstileHandle>(null);

  const set = (k: keyof typeof form, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problems: Partial<Record<Field, string>> = {};
    (['name_given', 'message'] as Field[]).forEach(f => { if (!form[f].trim()) problems[f] = s.required; });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) problems.email = form.email.trim() ? s.badEmail : s.required;
    setErrors(problems);
    if (Object.keys(problems).length) {
      document.querySelector<HTMLElement>('.contact-field.has-error input, .contact-field.has-error textarea')?.focus();
      return;
    }

    setStatus('sending');
    setFormError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, locale, started_at: startedAt.current, turnstile_token: turnstile.current?.token() || '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.field) setErrors({ [data.field]: data.error === 'email' ? s.badEmail : s.required });
        setFormError(data.error === 'verify' ? s.verifyFailed : data.field ? '' : s.failed);
        setStatus('error');
        turnstile.current?.reset();
        return;
      }
      // Japanese thanks use the family name (〇〇さん); fall back to the given name
      setSentName(locale === 'ja' ? form.name_family.trim() || form.name_given.trim() : form.name_given.trim());
      setStatus('sent');
    } catch {
      setFormError(s.failed);
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="contact-card contact-thanks" role="status">
        <span className="contact-thanks-mark" aria-hidden="true">✓</span>
        <h2>{s.thanksTitle.replace('{name}', sentName)}</h2>
        <p>{s.thanksBody}</p>
        <button
          type="button"
          className="contact-secondary"
          onClick={() => {
            setForm(f => ({ ...f, message: '' }));
            startedAt.current = Date.now();
            setStatus('idle');
          }}
        >
          {s.another}
        </button>
      </div>
    );
  }

  const mark = (required: boolean) => required
    ? <span className="contact-required">{s.requiredMark}</span>
    : <span className="contact-optional">· {s.optionalMark}</span>;

  const field = (k: Field, label: string, input: React.ReactNode, required = true) => (
    <div className={`contact-field${errors[k] ? ' has-error' : ''}`}>
      <label htmlFor={`contact-${k}`}>{label} {mark(required)}</label>
      {input}
      {errors[k] && <p className="contact-error" id={`contact-${k}-error`}>{errors[k]}</p>}
    </div>
  );
  const describe = (k: Field) => (errors[k] ? { 'aria-invalid': true, 'aria-describedby': `contact-${k}-error` } : {});

  // Japanese order is family name first; English shows given name first
  const nameFields = [
    field('name_family', s.familyName,
      <input id="contact-name_family" autoComplete="family-name" value={form.name_family} onChange={e => set('name_family', e.target.value)} {...describe('name_family')} />, false),
    field('name_given', s.givenName,
      <input id="contact-name_given" autoComplete="given-name" required aria-required="true" value={form.name_given} onChange={e => set('name_given', e.target.value)} {...describe('name_given')} />),
  ];

  return (
    <form className="contact-card contact-form" onSubmit={submit} noValidate>
      <div className="contact-field contact-greeting">
        <label htmlFor="contact-greeting">{s.sayHello}</label>
        <div className="contact-select">
          <select id="contact-greeting" value={form.greeting} onChange={e => set('greeting', e.target.value)}>
            {GREETINGS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      <fieldset className="contact-names">
        <legend>{s.name}</legend>
        <div className="contact-row">{locale === 'ja' ? nameFields : [...nameFields].reverse()}</div>
      </fieldset>

      {field('email', s.email,
        <input id="contact-email" required aria-required="true" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={e => set('email', e.target.value)} {...describe('email')} />)}

      {field('message', s.message,
        <textarea id="contact-message" required aria-required="true" rows={7} value={form.message} onChange={e => set('message', e.target.value)} {...describe('message')} />)}

      {/* Honeypot: hidden from people, irresistible to bots */}
      <div className="contact-hp" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={e => set('website', e.target.value)} />
      </div>

      <Turnstile ref={turnstile} locale={locale} />

      {formError && <p className="contact-error contact-form-error" role="alert">{formError}</p>}

      <button type="submit" className="contact-submit" disabled={status === 'sending'}>
        {status === 'sending' ? s.sending : <>{s.send} <span aria-hidden="true">→</span></>}
      </button>
    </form>
  );
}
