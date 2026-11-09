import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getMessages, getAttachmentUrl, setMessageStatus } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import { errorText } from '../../components/admin/ui';
import ListToolbar, { useListPrefs } from '../../components/admin/ListToolbar';

type Filter = 'new' | 'done' | 'all' | 'setlist';
type Sort = 'newest' | 'oldest';

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

/** Contact form messages, newest first. Mark each one done once it's dealt with; replies happen by email. */
export default function AdminMessages() {
  const { s, locale, prefix } = useAdminT();
  const [messages, setMessages] = useState<Record<string, string>[] | null>(null);
  const [error, setError] = useState('');
  // Links in notification emails use ?open=<message id>: open and show that one
  const [params] = useSearchParams();
  const [open, setOpen] = useState<string | null>(params.get('open'));
  const ui = useListPrefs<Filter, Sort>('messages', { filter: 'new', sort: 'newest' });
  const [busy, setBusy] = useState<string | null>(null);

  // Optimistic: flip it straight away, put it back if the save fails
  async function mark(id: string, status: '' | 'done') {
    const before = messages;
    setMessages(list => (list || []).map(m => (m.id === id ? { ...m, status } : m)));
    setBusy(id);
    try { await setMessageStatus(id, status); }
    catch (err) { setMessages(before); setError(errorText(err)); }
    finally { setBusy(null); }
  }

  useEffect(() => {
    getMessages().then(setMessages).catch(err => setError(errorText(err)));
  }, []);
  useEffect(() => {
    const id = params.get('open');
    if (!id || !messages) return;
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [messages, params]);

  const q = ui.query.trim().toLowerCase();
  const shown = (messages || [])
    .filter(m => ui.filter === 'all' ? true
      : ui.filter === 'setlist' ? m.topic === 'setlist'
      : ui.filter === 'done' ? m.status === 'done'
      : m.status !== 'done' || m.id === open)   // the one you just marked stays until you close it
    .filter(m => !q || [m.name_family, m.name_given, m.email, m.message, m.event].some(t => t?.toLowerCase().includes(q)))
    .sort((a, b) => (ui.sort === 'oldest' ? 1 : -1) * (a.received_at || '').localeCompare(b.received_at || ''));

  const when = (iso: string) =>
    iso ? new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo' }).format(new Date(iso)) : '';

  return (
    <>
      <div className="lu-page-head">
        <div>
          <h1>{s.messagesTitle} {messages && <span className="lu-count">{messages.length}</span>}</h1>
          <p className="lu-hint">{s.messagesHint}</p>
        </div>
      </div>
      {error && <div className="lu-alert">{error}</div>}
      {!messages && !error && <p className="lu-loading">{s.loading}</p>}
      {messages && messages.length > 0 && (
        <ListToolbar
          s={s}
          query={ui.query} onQuery={ui.setQuery}
          filters={[
            { value: 'new', label: `${s.msgNew} · ${messages.filter(m => m.status !== 'done').length}` },
            { value: 'done', label: s.msgDone },
            { value: 'all', label: s.filterAll },
            { value: 'setlist', label: `♪ ${s.setlistInfo}` },
          ]}
          filter={ui.filter} onFilter={v => ui.setFilter(v as Filter)}
          sorts={[{ value: 'newest', label: s.sortNewest }, { value: 'oldest', label: s.sortOldest }]}
          sort={ui.sort} onSort={v => ui.setSort(v as Sort)}
          shown={shown.length} total={messages.length}
        />
      )}
      {messages && messages.length === 0 && <p className="lu-empty">{s.messagesEmpty}</p>}
      {messages && messages.length > 0 && shown.length === 0 && <p className="lu-empty">{s.noResults}</p>}
      {shown.length > 0 && (
        <ul className="lu-list lu-messages">
          {shown.map(m => {
            const name = `${m.name_family} ${m.name_given}`.trim() || s.anonymous;
            const isSetlist = m.topic === 'setlist';
            const isOpen = open === m.id;
            return (
              <li key={m.id} id={`msg-${m.id}`} className={`${isOpen ? 'is-open' : ''}${m.status === 'done' ? ' is-done' : ''}`}>
                <button type="button" className="lu-list-row lu-message-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : m.id)}>
                  <time>{when(m.received_at)}</time>
                  <span className="lu-list-main">
                    <strong>{name} {!isSetlist && <span className="lu-message-greeting">“{m.greeting}”</span>}</strong>
                    <span>{m.message}</span>
                  </span>
                  <span className="lu-list-tags">
                    {m.status === 'done' ? <span className="lu-tag is-muted">✓ {s.msgDone}</span> : <span className="lu-tag is-new">{s.msgNew}</span>}
                    {isSetlist && <span className="lu-tag is-ok">♪ {s.setlistInfo}</span>}
                    {m.attachments && <span className="lu-tag">📎 {m.attachments.split(',').length}</span>}
                    {m.notified === 'no' && <span className="lu-tag is-muted">{s.notEmailed}</span>}
                  </span>
                </button>
                {isOpen && (
                  <div className="lu-message-body">
                    {isSetlist && m.event && (
                      <p className="lu-hint">
                        <a href={`/${locale}/events/${m.event}`} target="_blank" rel="noopener noreferrer">♪ {m.event} ↗</a>
                      </p>
                    )}
                    {m.email && <p className="lu-hint">{m.email}</p>}
                    <p className="lu-message-text">{m.message}</p>
                    {m.attachments && <Attachments names={m.attachments.split(',').filter(Boolean)} />}
                    <div className="lu-row">
                      {m.status === 'done'
                        ? <button type="button" className="lu-btn" disabled={busy === m.id} onClick={() => mark(m.id, '')}>↺ {s.markNew}</button>
                        : <button type="button" className="lu-btn lu-btn-done" disabled={busy === m.id} onClick={() => mark(m.id, 'done')}>✓ {s.markDone}</button>}
                      {isSetlist && m.event && (
                        <Link className="lu-btn lu-btn-primary" to={`${prefix}/events/${m.event}#setlist`}>♪ {s.openSetlist}</Link>
                      )}
                      {isSetlist && m.event && (
                        <a className="lu-btn" href={`/${locale}/events/${m.event}`} target="_blank" rel="noopener noreferrer">{s.viewOnSite} ↗</a>
                      )}
                      {m.email && (
                        <a className={`lu-btn${isSetlist ? '' : ' lu-btn-primary'}`} href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent('Re: advantage Lucy')}`}>
                          ✉ {s.reply}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
