import Icon from './Icon';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMessages } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import MessageRow from './MessageRow';
import { withoutFiltered } from '../../hooks/useFilters';

/** Admin home: messages nobody has marked done yet, newest first. */
export default function NewMessages() {
  const { s, locale, prefix } = useAdminT();
  const [messages, setMessages] = useState<Record<string, string>[] | null>(null);

  useEffect(() => {
    getMessages().then(withoutFiltered).then(setMessages).catch(() => setMessages([]));
  }, []);

  if (!messages) return null;
  const fresh = messages.filter(m => m.status !== 'done');
  return (
    <section className="lu-list-group lu-new-messages">
      <h2>
        <Icon name="mail" /> {s.newMessages}{fresh.length > 0 && <span className="lu-badge">{fresh.length}</span>}
        <Link to={`${prefix}/messages`} className="lu-section-link">{s.allMessagesLink} →</Link>
      </h2>
      {fresh.length === 0 ? <p className="lu-empty">{s.noNewMessages}</p> : (
        <ul className="lu-list lu-messages">
          {fresh.slice(0, 5).map(m => <MessageRow key={m.id} m={m} s={s} locale={locale} prefix={prefix} />)}
        </ul>
      )}
    </section>
  );
}
