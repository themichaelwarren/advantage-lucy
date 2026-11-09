import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getMessages, getAttachmentUrl, setMessageStatus, type MessageStatus } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import { errorText } from '../../components/admin/ui';
import { messageName, messageWhen, StatusTag, type Message } from '../../components/admin/MessageRow';

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
  // Next message still to deal with (newest first, after this one, else from the top)
  const fresh = messages.filter(x => x.status !== 'done' && x.id !== m.id);
  const idx = messages.indexOf(m);
  const next = fresh.find(x => messages.indexOf(x) > idx) || fresh[0];

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
      <p className="lu-eyebrow"><Link to={`${prefix}/messages`}>← {s.messagesTitle}</Link></p>
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
        {m.email && (
          <a className="lu-btn" href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent('Re: advantage Lucy')}`}>✉ {s.reply}</a>
        )}
      </div>

      {next && (
        <p className="lu-message-next">
          <Link to={`${prefix}/messages/${encodeURIComponent(next.id)}`} className="lu-btn lu-btn-quiet">{s.nextNew}: {messageName(next, s)} →</Link>
        </p>
      )}
    </article>
  );
}
