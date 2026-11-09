import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMessages } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';

/** Admin home: messages nobody has marked done yet, newest first. */
export default function NewMessages() {
  const { s, locale, prefix } = useAdminT();
  const [messages, setMessages] = useState<Record<string, string>[] | null>(null);

  useEffect(() => {
    getMessages().then(setMessages).catch(() => setMessages([]));
  }, []);

  if (!messages) return null;
  const fresh = messages.filter(m => m.status !== 'done');
  const when = (iso: string) =>
    iso ? new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-GB', { month: 'short', day: 'numeric', timeZone: 'Asia/Tokyo' }).format(new Date(iso)) : '';

  return (
    <section className="lu-list-group lu-new-messages">
      <h2>
        ✉ {s.newMessages}{fresh.length > 0 && <span className="lu-badge">{fresh.length}</span>}
        <Link to={`${prefix}/messages`} className="lu-section-link">{s.allMessagesLink} →</Link>
      </h2>
      {fresh.length === 0 ? <p className="lu-empty">{s.noNewMessages}</p> : (
        <ul className="lu-list">
          {fresh.slice(0, 5).map(m => (
            <li key={m.id}>
              <Link to={`${prefix}/messages?open=${encodeURIComponent(m.id)}`} className="lu-list-row">
                <time>{when(m.received_at)}</time>
                <span className="lu-list-main">
                  <strong>{`${m.name_family} ${m.name_given}`.trim() || s.anonymous}{m.topic === 'setlist' && ' · ♪'}</strong>
                  <span className="lu-snippet">{m.message}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
