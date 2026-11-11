import Icon, { type IconName } from '../../components/admin/Icon';
import { Link } from 'react-router-dom';
import { useAllEvents, useAllSetlists } from '../../hooks/useSheetData';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminT } from '../../i18n/admin';
import NeedsLook from '../../components/admin/NeedsLook';
import NewMessages from '../../components/admin/NewMessages';
import UpcomingReservations from '../../components/admin/UpcomingReservations';

/** Admin home: the four everyday jobs as big buttons, plus what needs doing. */
export default function AdminDashboard() {
  const { s, locale, prefix } = useAdminT();
  const { user } = useAuth();
  const { events, loading } = useAllEvents();
  const { setlists } = useAllSetlists();

  const today = new Date().toISOString().slice(0, 10);
  const withSetlist = new Set(setlists.map(x => x.event));
  const upcoming = events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const needsSetlist = events
    .filter(e => e.date < today && !withSetlist.has(e.id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const name = (e: typeof events[number]) =>
    (locale === 'ja' ? e.title_ja || e.title_en || e.venue_ja || e.venue_en : e.title_en || e.title_ja || e.venue_en || e.venue_ja);

  const tasks = [
    { to: `${prefix}/events/new`, title: s.taskAddShow, short: s.taskAddShowShort, hint: s.taskAddShowHint, icon: 'shows' as IconName, tone: 'sun' },
    { to: `${prefix}/events?filter=nosetlist`, title: s.taskSetlist, short: s.taskSetlistShort, hint: s.taskSetlistHint, icon: 'setlist' as IconName, tone: 'mint' },
    { to: `${prefix}/news/new`, title: s.taskNews, short: s.taskNewsShort, hint: s.taskNewsHint, icon: 'news' as IconName, tone: 'tomato' },
    { to: `${prefix}/blog/new`, title: s.taskBlog, short: s.taskBlogShort, hint: s.taskBlogHint, icon: 'blog' as IconName, tone: 'lilac' },
  ];

  const firstName = user?.name?.split(' ')[0];

  return (
    <>
      <div className="lu-page-head">
        <div>
          <p className="lu-eyebrow">{s.hello}{firstName ? `${locale === 'ja' ? '、' : ', '}${firstName}` : ''} 👋</p>
          <h1>{s.whatToDo}</h1>
        </div>
      </div>

      <div className="lu-tasks">
        {tasks.map(t => (
          <Link key={t.title} to={t.to} className={`lu-task is-${t.tone}`}>
            <span className="lu-task-icon" aria-hidden="true"><Icon name={t.icon} /></span>
            <strong className="lu-task-title">{t.title}</strong>
            <strong className="lu-task-short" aria-hidden="true">{t.short}</strong>
            <span>{t.hint}</span>
          </Link>
        ))}
      </div>

      <NewMessages />

      {!loading && <UpcomingReservations events={events} />}

      {!loading && (
        <div className="lu-columns">
          <section className="lu-list-group">
            <h2>{s.upcomingShows}</h2>
            {upcoming.length === 0 ? <p className="lu-empty">{s.nothingUpcoming}</p> : (
              <ul className="lu-list">
                {upcoming.map(e => (
                  <li key={e.id}>
                    <Link to={`${prefix}/events/${e.id}`} className="lu-list-row">
                      <time>{e.date}</time>
                      <span className="lu-list-main"><strong>{name(e)}</strong></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="lu-list-group">
            <h2>{s.needsSetlist}</h2>
            {needsSetlist.length === 0 ? <p className="lu-empty">{s.allDone}</p> : (
              <ul className="lu-list">
                {needsSetlist.map(e => (
                  <li key={e.id}>
                    <Link to={`${prefix}/events/${e.id}#setlist`} className="lu-list-row">
                      <time>{e.date}</time>
                      <span className="lu-list-main"><strong>{name(e)}</strong></span>
                      <span className="lu-row-cta">+ {s.taskSetlist} <span className="lu-row-cta-arrow" aria-hidden="true">→</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <NeedsLook />
    </>
  );
}
