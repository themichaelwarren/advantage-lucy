import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { Locale } from '../i18n/translations';

// Cloudflare Turnstile ("are you human" check). Off until a site key is set.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

export interface TurnstileHandle {
  /** The latest token ('' until the check passes). */
  token: () => string;
  /** Get a fresh token after a failed submit (tokens are single-use). */
  reset: () => void;
}

/**
 * Renders the Turnstile widget where it's placed. Every public form that
 * posts to /api/contact needs one once TURNSTILE_SECRET is set on the
 * server, otherwise the server refuses the submission.
 */
const Turnstile = forwardRef<TurnstileHandle, { locale: Locale }>(function Turnstile({ locale }, ref) {
  const el = useRef<HTMLDivElement>(null);
  const id = useRef<string | undefined>(undefined);
  const token = useRef('');

  useImperativeHandle(ref, () => ({
    token: () => token.current,
    reset: () => { token.current = ''; if (id.current) window.turnstile?.reset(id.current); },
  }), []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const render = () => {
      if (!window.turnstile || !el.current || id.current) return;
      id.current = window.turnstile.render(el.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
        language: locale,
        callback: (t: string) => { token.current = t; },
        'expired-callback': () => { token.current = ''; },
      });
    };
    if (window.turnstile) render();
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', render);
    return () => {
      script?.removeEventListener('load', render);
      if (id.current) { window.turnstile?.remove(id.current); id.current = undefined; }
    };
  }, [locale]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={el} className="contact-turnstile" />;
});

export default Turnstile;
