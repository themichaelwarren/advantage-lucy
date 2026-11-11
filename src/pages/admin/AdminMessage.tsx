import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getMessages, getAttachmentUrl, setMessageStatus, type MessageStatus } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import { errorText, ConfirmDialog } from '../../components/admin/ui';
import { messageName, messageWhen, StatusTag, type Message } from '../../components/admin/MessageRow';
import { useFilters, setFilters } from '../../hooks/useFilters';
import { saveFilterEmails } from '../../services/adminService';

/** Private photos attached to a message: fetched with the admin sign-in. */
function Attachments({ names }: { names: string[] }) {
  const [urls, setUrls] = useState<(string | null)[]>([]);
  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    Promise.all(names.map(n => getAttachmentUrl(n).then(u => { made.push(u); return u; }).catch(() => null)))
      .then(list => { if (alive) setUrls(list); });
    return () => { alive = false; made.forEach(u => URL.revokeObjectURL(u)); };
  }, [names.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="lu-attachments">
      {names.map((n, i) => urls[i]
        ? <a key={n} href={urls[i]!} target="_blank" rel="noopener noreferrer"><img src={urls[i]!} alt="" /></a>
        : <span key={n} className="lu-attachment-loading">📎</span>)}
    </div>
  );
}

/** One message: who, when, what, photos, and what to do with it. */
export default function AdminMessage() {
  const { id } = useParams<{ id: string }>();
  const { s, locale, prefix } = useAdminT();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { filters, match } = useFilters();
  const [confirm, setConfirm] = useState<'' | 'add' | 'remove'>('');

  useEffect(() => {
    getMessages().then(setMessages).catch(err => setError(errorText(err)));
  }, []);

  if (error) return <div className="lu-alert">{error}</div>;
  if (!messages) return <p className="lu-loading">{s.loading}</p>;
  const m = messages.find(x => x.id === id);
  if (!m) return (
    <>
      <p className="lu-empty">{s.messageNotFound}</p>
      <Link to={`${prefix}/messages`} className="lu-btn">← {s.allMessagesLink}</Link>
    </>
  );

  const isSetlist = m.topic === 'setlist';
  const flag = match(m.email);
  // Next message still to deal with (newest first, after this one, else from the top); never a filtered one
  const fresh = messages.filter(x => x.status !== 'done' && x.id !== m.id && match(x.email)?.kind !== 'filtered');
  const idx = messages.indexOf(m);
  const next = fresh.find(x => messages.indexOf(x) > idx) || fresh[0];

  /** Add this sender to the filtered list, or take the address it matched off it. */
  async function changeFilter(how: 'add' | 'remove') {
    if (!filters) return;
    const emails = filters.rows.filter(r => r.kind === 'email');
    const next = how === 'add'
      ? [...emails, { value: m!.email.trim().toLowerCase(), note: messageName(m!, s), added: '' }]
      : emails.filter(r => r.value !== flag?.listed);
    setBusy(true);
    try { setFilters(await saveFilterEmails(next)); }
    catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }

  async function mark(status: MessageStatus) {
    const before = messages;
    setMessages(list => (list || []).map(x => (x.id === m!.id ? { ...x, status } : x)));
    setBusy(true);
    try { await setMessageStatus(m!.id, status); }
    catch (err) { setMessages(before); setError(errorText(err)); }
    finally { setBusy(false); }
  }

  return (
    <article className="lu-message-page">
      <ConfirmDialog
        s={s} open={!!confirm}
        title={confirm === 'remove' ? s.filterRemoveTitle : s.filterSenderTitle}
        body={(confirm === 'remove' ? s.filterRemoveBody : s.filterSenderBody).replace('{email}', confirm === 'remove' ? flag?.listed || '' : m.email)}
        confirmLabel={confirm === 'remove' ? s.filterRemoveYes : s.filterSenderYes}
        onCancel={() => setConfirm('')}
        onConfirm={() => { const how = confirm; setConfirm(''); if (how) changeFilter(how); }}
      />
      <p className="lu-eyebrow"><Link to={`${prefix}/messages`}>← {s.messagesTitle}</Link></p>
      {flag?.kind === 'filtered' && (
        <div className="lu-alert lu-filter-banner">
          <strong>🔒 {s.filterBanner}</strong>
          <span>{s.filterBannerBody}</span>
        </div>
      )}
      {flag?.kind === 'lookalike' && (
        <div className="lu-alert lu-filter-banner is-warn">
          <strong>⚠ {s.filterLookalike}</strong>
          <span>{s.filterLookalikeTip.replace('{email}', flag.listed)}</span>
          <button type="button" className="lu-btn" disabled={busy || !filters} onClick={() => setConfirm('add')}>🔒 {s.filterSender}</button>
        </div>
      )}
      <div className="lu-page-head">
        <div>
          <h1>{messageName(m, s)}</h1>
          <p className="lu-hint">
            <StatusTag status={m.status} s={s} />
            {' '}{isSetlist && <span className="lu-tag is-ok">♪ {s.setlistInfo}</span>}
          </p>
        </div>
      </div>

      <dl className="lu-message-facts">
        <dt>{s.received}</dt><dd>{messageWhen(m.received_at, locale)}</dd>
        {m.email && (<><dt>{s.emailLabel}</dt><dd>{m.email}</dd></>)}
        {!isSetlist && m.greeting && (<><dt>{s.greetingLabel}</dt><dd>{m.greeting}</dd></>)}
        {m.locale && (<><dt>{s.languageLabel}</dt><dd>{m.locale === 'ja' ? '日本語' : 'English'}</dd></>)}
        {isSetlist && m.event && (<><dt>{s.showLabel}</dt><dd><Link to={`${prefix}/events/${m.event}`}>{m.event}</Link></dd></>)}
        {m.notified === 'no' && (<><dt>✉</dt><dd>{s.notEmailed}</dd></>)}
        {m.notified?.startsWith('filtered') && (<><dt>✉</dt><dd>{m.notified === 'filtered' ? s.filterForwarded : s.filterNotForwarded}</dd></>)}
      </dl>

      <p className="lu-message-text">{m.message}</p>
      {m.attachments && <Attachments names={m.attachments.split(',').filter(Boolean)} />}

      <div className="lu-row lu-message-actions">
        <div className="lu-status-switch" role="radiogroup" aria-label={s.statusLabel}>
          {([['', s.msgNew], ['doing', s.msgDoing], ['done', s.msgDone]] as [MessageStatus, string][]).map(([v, label]) => (
            <button
              key={v || 'new'} type="button" role="radio" aria-checked={(m.status || '') === v}
              className={`lu-pill${(m.status || '') === v ? ` is-on is-${v || 'new'}` : ''}`}
              disabled={busy} onClick={() => mark(v)}
            >
              {v === 'done' ? '✓ ' : v === 'doing' ? '… ' : ''}{label}
            </button>
          ))}
        </div>
        {isSetlist && m.event && <Link className="lu-btn lu-btn-primary" to={`${prefix}/events/${m.event}#setlist`}>♪ {s.openSetlist}</Link>}
        {isSetlist && m.event && <a className="lu-btn" href={`/${locale}/events/${m.event}`} target="_blank" rel="noopener noreferrer">{s.viewOnSite} ↗</a>}
        {/* No reply button for a filtered sender: replying is exactly what to avoid */}
        {m.email && flag?.kind !== 'filtered' && (
          <a className="lu-btn" href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent('Re: advantage Lucy')}`}>✉ {s.reply}</a>
        )}
        {m.email && !flag && <button type="button" className="lu-btn lu-btn-quiet" disabled={busy || !filters} onClick={() => setConfirm('add')}>🔒 {s.filterSender}</button>}
        {flag?.kind === 'filtered' && <button type="button" className="lu-btn lu-btn-quiet" disabled={busy || !filters} onClick={() => setConfirm('remove')}>{s.filterUnfilter}</button>}
      </div>

      {next && (
        <p className="lu-message-next">
          <Link to={`${prefix}/messages/${encodeURIComponent(next.id)}`} className="lu-btn lu-btn-quiet">{s.nextNew}: {messageName(next, s)} →</Link>
        </p>
      )}
    </article>
  );
}
