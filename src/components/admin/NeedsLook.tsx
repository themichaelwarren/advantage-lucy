import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSongs, useAllSetlists, useTracklists, useAllEvents, useAlbums } from '../../hooks/useSheetData';
import { useAdminT } from '../../i18n/admin';
import SuggestInput, { normalize } from './SuggestInput';
import { addMissingSongs, isPlaceholderTitle, retitleEverywhere } from './songs';
import { errorText } from './ui';

interface Mismatch {
  title: string;
  events: string[];    // event IDs
  releases: string[];  // release titles
}

/**
 * Admin home card: song titles used in setlists or tracklists that don't
 * match any song in Songs (e.g. a typo, or a title changed directly in the
 * sheet). Each one can be added to Songs, or pointed at the right song,
 * which retitles it everywhere it's used.
 */
export default function NeedsLook() {
  const { s, prefix } = useAdminT();
  const { songs, loading: songsLoading, refresh: refreshSongs } = useSongs();
  const { setlists, loading: setlistsLoading, refresh: refreshSetlists } = useAllSetlists();
  const { tracklists, loading: tracklistsLoading, refresh: refreshTracklists } = useTracklists();
  const { events } = useAllEvents();
  const { albums } = useAlbums();
  const [fixing, setFixing] = useState<string | null>(null);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { real, placeholders } = useMemo(() => {
    const known = new Set(songs.map(x => normalize(x.title || '')).filter(Boolean));
    const byKey = new Map<string, Mismatch>();
    const add = (raw: string, kind: 'events' | 'releases', ref: string) => {
      const title = (raw || '').trim();
      const key = normalize(title);
      if (!key || known.has(key)) return;
      const m = byKey.get(key) ?? { title, events: [], releases: [] };
      if (!m[kind].includes(ref)) m[kind].push(ref);
      byKey.set(key, m);
    };
    setlists.forEach(r => add(r.song, 'events', r.event));
    tracklists.forEach(t => add(t.title, 'releases', t.release));
    const all = [...byKey.values()].sort((a, b) => (b.events.length + b.releases.length) - (a.events.length + a.releases.length));
    return { real: all.filter(m => !isPlaceholderTitle(m.title)), placeholders: all.filter(m => isPlaceholderTitle(m.title)) };
  }, [songs, setlists, tracklists]);

  const eventById = useMemo(() => new Map(events.map(e => [e.id, e])), [events]);
  const albumByTitle = useMemo(() => new Map(albums.map(a => [a.title, a])), [albums]);
  const songOptions = useMemo(
    () => songs.filter(x => x.title).map(x => ({ value: x.title })).sort((a, b) => a.value.localeCompare(b.value, 'ja')),
    [songs],
  );

  if (songsLoading || setlistsLoading || tracklistsLoading) return null;

  async function run(key: string, job: () => Promise<unknown>) {
    setBusy(key);
    setError('');
    try {
      await job();
      refreshSongs(); refreshSetlists(); refreshTracklists();
      setFixing(null);
      setChoice('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  const where = (m: Mismatch) => [
    ...m.events.slice(0, 3).map(id => (
      <Link key={id} to={`${prefix}/events/${id}#setlist`}>{eventById.get(id)?.date || id}</Link>
    )),
    ...m.releases.slice(0, 2).map(r => {
      const a = albumByTitle.get(r);
      return a ? <Link key={r} to={`${prefix}/releases/${a.id}`}>{r}</Link> : <span key={r}>{r}</span>;
    }),
  ];

  return (
    <section className="lu-list-group lu-needs-look">
      <h2>{s.needsLook}{real.length > 0 && <span className="lu-count"> {real.length}</span>}</h2>
      {real.length === 0 ? <p className="lu-empty">{s.allMatched}</p> : (
        <>
          <p className="lu-hint">{s.needsLookHint}</p>
          {error && <p className="lu-alert">{error}</p>}
          <ul className="lu-list">
            {real.map(m => {
              const key = normalize(m.title);
              const count = m.events.length + m.releases.length;
              const links = where(m);
              return (
                <li key={key} className="lu-mismatch">
                  <div className="lu-mismatch-main">
                    <strong>{m.title}</strong>
                    <span className="lu-hint">
                      {s.usedInN.replace('{n}', String(count))}:{' '}
                      {links.map((l, i) => <span key={i}>{i > 0 && ', '}{l}</span>)}
                      {count > links.length && ' …'}
                    </span>
                  </div>
                  {fixing === key ? (
                    <div className="lu-mismatch-fix">
                      <SuggestInput
                        value={choice}
                        onChange={setChoice}
                        suggestions={songOptions}
                        placeholder={s.pickSong}
                        aria-label={s.pickSong}
                        autoFocus
                      />
                      <button type="button" className="lu-btn" onClick={() => { setFixing(null); setChoice(''); }}>{s.cancel}</button>
                      <button
                        type="button"
                        className="lu-btn lu-btn-primary"
                        disabled={busy === key || !songs.some(x => x.title === choice)}
                        onClick={() => run(key, () => retitleEverywhere(m.title, choice, setlists, tracklists))}
                      >
                        {busy === key ? s.saving : s.fixIt}
                      </button>
                    </div>
                  ) : (
                    <div className="lu-mismatch-actions">
                      <button type="button" className="lu-btn" disabled={!!busy} onClick={() => { setFixing(key); setChoice(''); }}>{s.itsActually}</button>
                      <button type="button" className="lu-btn lu-btn-primary" disabled={!!busy} onClick={() => run(key, () => addMissingSongs([m.title], songs))}>
                        {busy === key ? s.saving : `+ ${s.addToSongs}`}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {placeholders.length > 0 && (
        <details className="lu-placeholders">
          <summary>{s.placeholdersN.replace('{n}', String(placeholders.length))}</summary>
          <ul>
            {placeholders.map(m => (
              <li key={m.title}>
                <strong>{m.title}</strong>{' '}
                <span className="lu-hint">{where(m).map((l, i) => <span key={i}>{i > 0 && ', '}{l}</span>)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
