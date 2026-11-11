import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminT } from '../../i18n/admin';
import { useAllEvents, useAllSongs, useAllAlbums } from '../../hooks/useSheetData';
import ListToolbar from '../../components/admin/ListToolbar';
import Icon from '../../components/admin/Icon';
import { useActivity, groupActivity, ActivityGroupView, thingLink, whoName, dayOf, type ActivityGroup } from '../../components/admin/Activity';
import { songTitle } from '../../utils/songTitles';
import { getEventTitle } from '../../utils/format';

const PAGE = 300;

/**
 * 最近の変更: every save in the admin, newest first, by day. Each line is
 * one save (a show with its setlist and videos reads as one), with who
 * made it and what changed. Filter by kind of thing, by person, or search.
 */
export default function AdminActivity() {
  const { s, locale, prefix } = useAdminT();
  const [limit, setLimit] = useState(PAGE);
  const { entries, error } = useActivity([], limit);
  const { events } = useAllEvents();
  const { songs } = useAllSongs();
  const { albums } = useAllAlbums();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [who, setWho] = useState('');

  const albumIdByTitle = useMemo(() => new Map(albums.map(a => [a.title, a.id])), [albums]);
  const groups = useMemo(() => groupActivity(entries || [], albumIdByTitle), [entries, albumIdByTitle]);

  /** What a thing is called now (or was, if it's gone). */
  const nameOf = useMemo(() => {
    const ev = new Map(events.map(e => [e.id, e]));
    const so = new Map(songs.map(x => [x.id, x]));
    const al = new Map(albums.map(a => [a.id, a]));
    return (g: ActivityGroup): { name: string; gone: boolean } => {
      const [tab, ...rest] = g.thing.split(':');
      const id = rest.join(':');
      const stored = g.entries.find(e => e.label)?.label || '';
      const gone = g.entries.some(e => e.action === 'delete');
      if (tab === 'Events' && ev.get(id)) { const e = ev.get(id)!; return { name: `${e.date.replace(/-/g, '.')} · ${getEventTitle(e, locale)}`, gone }; }
      if (tab === 'Songs' && so.get(id)) return { name: songTitle(so.get(id)!, locale), gone };
      if (tab === 'Albums' && al.get(id)) return { name: (locale === 'en' && al.get(id)!.title_en) || al.get(id)!.title, gone };
      return { name: stored || id, gone };
    };
  }, [events, songs, albums, locale]);

  const people = useMemo(() => [...new Set(groups.map(g => g.who))], [groups]);
  const kindOf = (g: ActivityGroup) => {
    const tab = g.thing.split(':')[0];
    return tab === 'Events' ? 'shows' : tab === 'Songs' ? 'songs' : tab === 'Albums' ? 'releases' : 'other';
  };
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter(g =>
      (kind === 'all' || kindOf(g) === kind) &&
      (!who || g.who === who) &&
      (!q || `${nameOf(g).name} ${g.who} ${g.entries.map(e => e.changes.map(c => `${c.from || ''} ${c.to || ''}`).join(' ')).join(' ')}`.toLowerCase().includes(q)));
  }, [groups, kind, who, query, nameOf]);

  const days = useMemo(() => {
    const out: { day: string; groups: ActivityGroup[] }[] = [];
    for (const g of shown) {
      const d = dayOf(g.at);
      if (out[out.length - 1]?.day !== d) out.push({ day: d, groups: [] });
      out[out.length - 1].groups.push(g);
    }
    return out;
  }, [shown]);

  const count = (k: string) => groups.filter(g => kindOf(g) === k).length;
  const filters = [
    { value: 'all', label: s.actAll },
    { value: 'shows', label: <><Icon name="shows" /> {s.shows}</>, n: count('shows') },
    { value: 'songs', label: <><Icon name="songs" /> {s.songs}</>, n: count('songs') },
    { value: 'releases', label: <><Icon name="releases" /> {s.releases}</>, n: count('releases') },
    { value: 'other', label: s.actOther, n: count('other') },
  ].filter(f => f.value === 'all' || f.n);

  return (
    <div className="lu-activity-page">
      <div className="lu-page-head">
        <div>
          <h1>{s.actTitle}</h1>
          <p className="lu-hint"><Icon name="lock" /> {s.actLead}</p>
        </div>
      </div>
      <ListToolbar s={s} query={query} onQuery={setQuery} filters={filters} filter={kind} onFilter={setKind} shown={shown.length} total={groups.length} />
      {people.length > 1 && (
        <div className="lu-chips lu-act-people" role="group" aria-label={s.actWho}>
          <button type="button" className={`lu-pill${!who ? ' is-on' : ''}`} aria-pressed={!who} onClick={() => setWho('')}>{s.actWho}</button>
          {people.map(p => (
            <button key={p} type="button" className={`lu-pill${who === p ? ' is-on' : ''}`} aria-pressed={who === p} onClick={() => setWho(p)} title={p}>{whoName(p)}</button>
          ))}
        </div>
      )}

      {entries === null && !error && <p className="lu-loading">{s.loading}</p>}
      {error && <p className="lu-error">{s.actLoadError}</p>}
      {entries !== null && groups.length === 0 && <p className="lu-empty">{s.actNone}</p>}
      {entries !== null && groups.length > 0 && shown.length === 0 && <p className="lu-empty">{s.noResults}</p>}

      {days.map(d => (
        <section key={d.day} className="lu-act-day">
          <h2 className="lu-act-date">{d.day.replace(/-/g, '.')}</h2>
          <ol className="lu-acts">
            {d.groups.map(g => {
              const { name, gone } = nameOf(g);
              const to = gone ? null : thingLink(g.thing, prefix);
              const tab = g.thing.split(':')[0];
              const title = tab === 'Filters' ? undefined : (
                <span className="lu-act-thing">
                  <span className="lu-tag is-muted lu-act-kind">{s.actTabs[tab] || tab}</span>
                  {to ? <Link to={to}>{name}</Link> : <span className={gone ? 'lu-act-gone' : ''}>{name}</span>}
                </span>
              );
              return <ActivityGroupView key={g.key} g={g} s={s} locale={locale} title={title} />;
            })}
          </ol>
        </section>
      ))}

      {entries !== null && entries.length >= limit && (
        <button type="button" className="lu-btn lu-act-more" onClick={() => setLimit(l => l + PAGE)}>{s.actMore}</button>
      )}
    </div>
  );
}
