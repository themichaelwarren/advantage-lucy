import Icon from './Icon';
import { Link } from 'react-router-dom';
import type { AdminLocale, AdminStrings } from '../../i18n/admin';
import type { SenderMatch } from '../../../functions/lib/filters';

export type Message = Record<string, string>;

/** "2026年11月8日 19:00" / "8 Nov 2026, 19:00", Japan time. */
export const messageWhen = (iso: string, locale: AdminLocale) =>
  iso ? new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo' }).format(new Date(iso)) : '';

export const messageName = (m: Message, s: AdminStrings) => `${m.name_family || ''} ${m.name_given || ''}`.trim() || s.anonymous;

/** New / In progress / Done tag. */
export function StatusTag({ status, s }: { status?: string; s: AdminStrings }) {
  if (status === 'done') return <span className="lu-tag is-muted">✓ {s.msgDone}</span>;
  if (status === 'doing') return <span className="lu-tag is-doing">… {s.msgDoing}</span>;
  return <span className="lu-tag is-new">{s.msgNew}</span>;
}

/** One message in a list (Messages page and admin home): links to its own page. */
export default function MessageRow({ m, s, locale, prefix, flag }: { m: Message; s: AdminStrings; locale: AdminLocale; prefix: string; flag?: SenderMatch }) {
  const isSetlist = m.topic === 'setlist';
  const done = m.status === 'done';
  return (
    <li className={done ? 'is-done' : ''}>
      <Link to={`${prefix}/messages/${encodeURIComponent(m.id)}`} className="lu-list-row lu-message-head">
        <time>{messageWhen(m.received_at, locale)}</time>
        <span className="lu-list-main">
          <strong>{messageName(m, s)} {!isSetlist && m.greeting && <span className="lu-message-greeting">“{m.greeting}”</span>}</strong>
          <span className="lu-snippet">{m.message}</span>
        </span>
        <span className="lu-list-tags">
          {flag?.kind === 'lookalike' && <span className="lu-tag is-warn" title={s.filterLookalikeTip.replace('{email}', flag.listed)}><Icon name="warn" /> {s.filterLookalike}</span>}
          {flag?.kind !== 'filtered' && <StatusTag status={m.status} s={s} />}
          {isSetlist && <span className="lu-tag is-ok">♪ {s.setlistInfo}</span>}
          {m.attachments && <span className="lu-tag"><Icon name="attach" /> {m.attachments.split(',').filter(Boolean).length}</span>}
          {m.notified === 'no' && <span className="lu-tag is-muted">{s.notEmailed}</span>}
          {m.notified === 'filtered' && <span className="lu-tag is-muted">{s.filterForwarded}</span>}
        </span>
      </Link>
    </li>
  );
}
