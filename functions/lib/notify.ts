/**
 * Emails the band about a new contact message or setlist info, via Resend
 * (https://resend.com). The domain's DNS is at Name.com, so Cloudflare's own
 * email sending isn't available; Resend only needs a few DNS records there.
 *
 * Settings (Cloudflare Pages → Settings → Variables and secrets, and .env locally):
 *   RESEND_API_KEY     secret, from Resend → API Keys (sending access)
 *   CONTACT_NOTIFY_TO  where messages go, e.g. advantagelucyofficial@gmail.com
 *   CONTACT_FROM       sender on the verified domain, e.g. "advantage Lucy website <website@advantagelucy.com>"
 *
 * Until these are set, messages are still saved (sheet + admin), just not emailed.
 */
import { notificationEmail, type ContactMessage, type EmailContext } from './messages';

export interface NotifyEnv {
  RESEND_API_KEY?: string;
  CONTACT_NOTIFY_TO?: string;
  CONTACT_FROM?: string;
  SITE_URL?: string; // optional: links in emails use this instead of the request's address
}

/** Returns true if an email was sent. */
export async function notifyBand(env: NotifyEnv, m: ContactMessage, ctx: EmailContext = {}): Promise<boolean> {
  const email = notificationEmail(m, ctx);
  if (!env.RESEND_API_KEY || !env.CONTACT_NOTIFY_TO || !env.CONTACT_FROM) {
    console.log('[contact] email not configured; saved only:', email.subject);
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.CONTACT_FROM,
      to: env.CONTACT_NOTIFY_TO.split(',').map(s => s.trim()).filter(Boolean),
      subject: email.subject,
      text: email.text,
      html: email.html,
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
  return true;
}
