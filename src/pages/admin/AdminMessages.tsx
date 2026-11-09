import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { getMessages } from '../../services/adminService';
import MessageRow from '../../components/admin/MessageRow';
import { useAdminT } from '../../i18n/admin';
import { errorText } from '../../components/admin/ui';
import ListToolbar, { useListPrefs } from '../../components/admin/ListToolbar';

type Filter = 'new' | 'doing' | 'done' | 'all' | 'setlist';
type Sort = 'newest' | 'oldest';

/** Contact form messages, newest first. Mark each one done once it's dealt with; replies happen by email. */
export default function AdminMessages() {
  const { s, locale, prefix } = useAdminT();
  const [messages, setMessages] = useState<Record<string, string>[] | null>(null);
  const [error, setError] = useState('');
  // Older notification emails link to ?open=<message id>: go to that message's page
  const [params] = useSearchParams();
  const openId = params.get('open');
  const ui = useListPrefs<Filter, Sort>('messages', { filter: 'new', sort: 'newest' });

  useEffect(() => {
    if (!openId) getMessages().then(setMessages).catch(err => setError(errorText(err)));
  }, [openId]);
  if (openId) return <Navigate to={`${prefix}/messages/${encodeURIComponent(openId)}`} replace />;

  const q = ui.query.trim().toLowerCase();
  const shown = (messages || [])
    .filter(m => ui.filter === 'all' ? true
      : ui.filter === 'setlist' ? m.topic === 'setlist'
      : ui.filter === 'done' ? m.status === 'done'
      : ui.filter === 'doing' ? m.status === 'doing'
      : !m.status)
    .filter(m => !q || [m.name_family, m.name_given, m.email, m.message, m.event].some(t => t?.toLowerCase().includes(q)))
    .sort((a, b) => (ui.sort === 'oldest' ? 1 : -1) * (a.received_at || '').localeCompare(b.received_at || ''));

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
            { value: 'new', label: `${s.msgNew} · ${messages.filter(m => !m.status).length}` },
            { value: 'doing', label: `${s.msgDoing} · ${messages.filter(m => m.status === 'doing').length}` },
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
          {shown.map(m => <MessageRow key={m.id} m={m} s={s} locale={locale} prefix={prefix} />)}
        </ul>
      )}
    </>
  );
}
