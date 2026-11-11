/**
 * POST /api/contact: the site's own contact form, and fans' setlist info.
 * Accepts JSON, or multipart form data when photos are attached
 * ("payload" = the JSON fields, "files" = up to 3 images).
 * Validates, filters spam, rate-limits, stores photos privately, saves the
 * message to the private "Messages" sheet tab, and emails the band.
 * A filtered sender (functions/lib/filters.ts) sees the same "sent": the
 * message is saved and emailed only to the filter's forwarding address.
 */
import { type Env, getCredentials } from '../lib/sheets';
import { checkContact, saveMessage, verifyTurnstile, showForEmail, type ContactInput } from '../lib/messages';
import { checkFiles, attachmentNames, allowSubmission, SUBMISSIONS_PREFIX } from '../lib/attachments';
import { notifyBand, sendEmail, type NotifyEnv } from '../lib/notify';
import { notificationEmail } from '../lib/messages';
import { loadFilters, matchSender } from '../lib/filters';

interface ContactEnv extends Env, NotifyEnv {
  TURNSTILE_SECRET?: string;
  POSTERS: R2Bucket;
}

export const onRequestPost: PagesFunction<ContactEnv> = async ({ request, env }) => {
  let input: ContactInput;
  let files: File[] = [];
  try {
    if ((request.headers.get('Content-Type') || '').includes('multipart/form-data')) {
      const form = await request.formData();
      input = JSON.parse(String(form.get('payload') || '{}'));
      files = form.getAll('files').filter((f): f is File => typeof f !== 'string');
    } else {
      input = await request.json();
    }
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }

  const checked = checkContact(input);
  if (!checked.ok) return Response.json({ error: checked.error, field: checked.field }, { status: 400 });
  if (checked.spam) return Response.json({ ok: true }); // look successful to bots

  const ip = request.headers.get('CF-Connecting-IP');
  if (!(await allowSubmission(ip))) return Response.json({ error: 'slow_down' }, { status: 429 });
  if (!(await verifyTurnstile(env.TURNSTILE_SECRET, input.turnstile_token, ip))) {
    return Response.json({ error: 'verify' }, { status: 400 });
  }

  const fileCheck = await checkFiles(files);
  if (!fileCheck.ok) return Response.json({ error: fileCheck.error, field: 'files' }, { status: 400 });

  try {
    const { sheetId, email, privateKey } = getCredentials(env);
    const message = checked.message;
    if (fileCheck.files.length) {
      const names = attachmentNames(message.id, fileCheck.files);
      await Promise.all(fileCheck.files.map((f, i) =>
        env.POSTERS.put(SUBMISSIONS_PREFIX + names[i], f.bytes, { httpMetadata: { contentType: f.kind.type } })));
      message.attachments = names.join(',');
    }
    // Email first so the sheet records whether it went out; never lose the message if email fails
    let notified = false;
    const ctx = {
      siteUrl: env.SITE_URL || new URL(request.url).origin,
      show: message.topic === 'setlist' ? await showForEmail(sheetId, email, privateKey, message.event) : undefined,
    };
    // Filtered senders: never to the band, only to the forwarding address (if one is set).
    // Lookalikes go to the band as usual, flagged. If the list can't be read, carry on as normal.
    const filters = await loadFilters({ sheetId, saEmail: email, saKey: privateKey }).catch(() => null);
    const match = filters ? matchSender(message.email, filters.emails) : null;
    let notifiedAs = '';
    try {
      if (match?.kind === 'filtered') {
        const mail = notificationEmail(message, ctx);
        // No reply-to: replying from that inbox must never reach them
        notified = !!filters?.forwardTo && await sendEmail(env, { to: [filters.forwardTo], subject: `[フィルター] ${mail.subject}`, text: mail.text, html: mail.html });
        notifiedAs = notified ? 'filtered' : 'filtered (not sent)';
      } else if (match?.kind === 'lookalike') {
        const mail = notificationEmail(message, ctx);
        const to = (env.CONTACT_NOTIFY_TO || '').split(',').map(s => s.trim()).filter(Boolean);
        notified = await sendEmail(env, { to, subject: `⚠ フィルター中の送信者に似たアドレス — ${mail.subject}`, text: mail.text, html: mail.html, replyTo: mail.replyTo });
      } else {
        notified = await notifyBand(env, message, ctx);
      }
    } catch (err) { console.error('[contact] notify failed', err); }
    await saveMessage(sheetId, email, privateKey, message, notifiedAs || (notified ? 'yes' : 'no'));
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[contact]', err);
    return Response.json({ error: 'server' }, { status: 500 });
  }
};
