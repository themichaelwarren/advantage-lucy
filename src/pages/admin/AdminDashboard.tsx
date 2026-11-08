import { Link } from 'react-router-dom';
import { useAllEvents, useAllSetlists } from '../../hooks/useSheetData';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminT } from '../../i18n/admin';

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
    { to: `${prefix}/events/new`, title: s.taskAddShow, hint: s.taskAddShowHint, icon: '♪', tone: 'sun' },
    { to: needsSetlist[0] ? `${prefix}/events/${needsSetlist[0].id}#setlist` : `${prefix}/events`, title: s.taskSetlist, hint: s.taskSetlistHint, icon: '☰', tone: 'mint' },
    { to: `${prefix}/news/new`, title: s.taskNews, hint: s.taskNewsHint, icon: '✎', tone: 'tomato' },
    { to: `${prefix}/blog/new`, title: s.taskBlog, hint: s.taskBlogHint, icon: '◎', tone: 'lilac' },
  ];

  const firstName = user?.name?.split(' ')[0];

  return (
    <>
      <div className="ad-page-head">
        <div>
          <p className="ad-eyebrow">{s.hello}{firstName ? `${locale === 'ja' ? '、' : ', '}${firstName}` : ''} 👋</p>
          <h1>{s.whatToDo}</h1>
        </div>
      </div>

      <div className="ad-tasks">
        {tasks.map(t => (
          <Link key={t.title} to={t.to} className={`ad-task is-${t.tone}`}>
            <span className="ad-task-icon" aria-hidden="true">{t.icon}</span>
            <strong>{t.title}</strong>
            <span>{t.hint}</span>
          </Link>
        ))}
      </div>

      {!loading && (
        <div className="ad-columns">
          <section className="ad-list-group">
            <h2>{s.upcomingShows}</h2>
            {upcoming.length === 0 ? <p className="ad-empty">{s.nothingUpcoming}</p> : (
              <ul className="ad-list">
                {upcoming.map(e => (
                  <li key={e.id}>
                    <Link to={`${prefix}/events/${e.id}`} className="ad-list-row">
                      <time>{e.date}</time>
                      <span className="ad-list-main"><strong>{name(e)}</strong></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="ad-list-group">
            <h2>{s.needsSetlist}</h2>
            {needsSetlist.length === 0 ? <p className="ad-empty">{s.allDone}</p> : (
              <ul className="ad-list">
                {needsSetlist.map(e => (
                  <li key={e.id}>
                    <Link to={`${prefix}/events/${e.id}#setlist`} className="ad-list-row">
                      <time>{e.date}</time>
                      <span className="ad-list-main"><strong>{name(e)}</strong></span>
                      <span className="ad-list-tags"><span className="ad-tag is-todo">+ {s.taskSetlist}</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
