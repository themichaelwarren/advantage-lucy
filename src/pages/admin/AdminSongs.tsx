import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSongs, usePeople, useAllSetlists, useAllEvents } from '../../hooks/useSheetData';
import { useAdminT } from '../../i18n/admin';
import { personName } from '../../components/admin/PeoplePicker';
import { normalize } from '../../components/admin/SuggestInput';
import { getArrangements, getMedia, type ArrangementRow, type MediaRow } from '../../services/adminService';
import { KEYS, parseKey } from '../../../functions/lib/keys';
import { keysText } from '../../components/admin/KeysEditor';
import { todayInJapan } from '../../utils/showDates';
import { songAltTitle, songSortKey, songSearchText, songQuery } from '../../utils/songTitles';

/**
 * Songs: one table to read, sort and filter (editing is on each song's
 * page). Click a column heading to sort by it, again to reverse. Quick
 * filters combine ("no lyrics" + "played live"), and there's a key picker.
 */
type SortKey = 'title' | 'key' | 'plays' | 'last' | 'videos';
type Flag = 'nolyrics' | 'nokey' | 'nocredits' | 'cover' | 'neverplayed' | 'played' | 'videos';
const FLAGS: Flag[] = ['nolyrics', 'nokey', 'nocredits', 'cover', 'neverplayed', 'played', 'videos'];
const PREFS = 'admin-songs-table';

interface Row {
  id: string;
  title: string;
  alt: string;              // the other language's title, if different
  sortTitle: string;        // 読み (ja) or English title (en)
  search: string;
  cover: string;
  keys: ArrangementRow[];
  keyText: string;
  keySort: number;          // first key: note position, minor after major; no key last
  lyrics: boolean;
  plays: number;
  last: string;             // date of the last show that's over
  videos: number;
  music: string;
  words: string;
}

function loadPrefs(): { sort: SortKey; desc: boolean; flags: Flag[]; key: string } {
  const d = { sort: 'title' as SortKey, desc: false, flags: [] as Flag[], key: '' };
  try { return { ...d, ...JSON.parse(localStorage.getItem(PREFS) || '{}') }; } catch { return d; }
}

export default function AdminSongs() {
  const { s, locale, prefix } = useAdminT();
  const navigate = useNavigate();
  const { songs, loading } = useSongs();
  const { people } = usePeople();
  const { setlists } = useAllSetlists();
  const { events } = useAllEvents();
  const [arr, setArr] = useState<ArrangementRow[]>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  useEffect(() => {
    getArrangements().then(setArr).catch(() => {});
    getMedia().then(setMedia).catch(() => {});
  }, []);

  const [query, setQuery] = useState('');
  const [prefs, setPrefs] = useState(loadPrefs);
  useEffect(() => { try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch { /* private mode */ } }, [prefs]);
  const toggleFlag = (f: Flag) => setPrefs(p => ({
    ...p,
    // "never played" and "played" can't both be on
    flags: p.flags.includes(f) ? p.flags.filter(x => x !== f)
      : [...p.flags.filter(x => !(f === 'played' && x === 'neverplayed') && !(f === 'neverplayed' && x === 'played')), f],
  }));
  const sortBy = (k: SortKey) => setPrefs(p => ({ ...p, sort: k, desc: p.sort === k ? !p.desc : k === 'plays' || k === 'last' || k === 'videos' }));

  const names = useMemo(() => {
    const m = new Map(people.map(p => [p.id, personName(p, locale)]));
    return (ids?: string) => (ids || '').split(',').map(x => m.get(x.trim()) || x.trim()).filter(Boolean).join('、');
  }, [people, locale]);

  const rows = useMemo<Row[]>(() => {
    const today = todayInJapan();
    const dateOf = new Map(events.map(e => [e.id, e.end_date || e.date]));
    const playsBy = new Map<string, { n: Set<string>; last: string }>();
    for (const r of setlists) {
      const k = normalize(r.song || '');
      const d = dateOf.get(r.event) || '';
      const cur = playsBy.get(k) || { n: new Set<string>(), last: '' };
      cur.n.add(r.event);
      if (d && d <= today && d > cur.last) cur.last = d;
      playsBy.set(k, cur);
    }
    const partsBy = new Map<string, number>();
    for (const m of media) if (m.kind === 'part') partsBy.set(normalize(m.song), (partsBy.get(normalize(m.song)) || 0) + 1);
    return songs.filter(x => x.id).map(x => {
      const k = normalize(x.title);
      const keys = arr.filter(a => a.song === x.id && a.kind === 'key');
      const first = keys[0] ? parseKey(keys[0].value) : null;
      const plays = playsBy.get(k);
      return {
        id: x.id, title: x.title, cover: x.original_artist || '',
        alt: songAltTitle(x, 'ja'),
        sortTitle: songSortKey(x, locale), search: songSearchText(x),
        keys, keyText: keysText(keys, locale),
        keySort: first ? first.pos * 2 + (first.minor ? 1 : 0) : 99,
        lyrics: !!x.lyrics_doc_id,
        plays: plays ? plays.n.size : 0,
        last: plays?.last || '',
        videos: (partsBy.get(k) || 0) + media.filter(m => m.owner === `song:${x.id}`).length,
        music: names(x.music_by), words: names(x.lyrics_by),
      };
    });
  }, [songs, setlists, events, arr, media, names, locale]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sq = songQuery(query);
    const has = (f: Flag) => prefs.flags.includes(f);
    const out = rows.filter(r =>
      (!has('nolyrics') || !r.lyrics) &&
      (!has('nokey') || r.keys.length === 0) &&
      (!has('nocredits') || (!r.music && !r.words)) &&
      (!has('cover') || !!r.cover) &&
      (!has('neverplayed') || r.plays === 0) &&
      (!has('played') || r.plays > 0) &&
      (!has('videos') || r.videos > 0) &&
      (!prefs.key
        || (prefs.key === 'major' ? r.keys.some(k => !k.value.endsWith('m'))
          : prefs.key === 'minor' ? r.keys.some(k => k.value.endsWith('m'))
          : r.keys.some(k => k.value === prefs.key))) &&
      (!q || r.search.includes(sq) || [r.music, r.words, r.keyText].some(t => t.toLowerCase().includes(q))),
    );
    const dir = prefs.desc ? -1 : 1;
    // 50音順 by 読み in Japanese, A–Z by the English title in English
    const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
    const byTitle = (a: Row, b: Row) => collator.compare(a.sortTitle, b.sortTitle);
    out.sort((a, b) => {
      switch (prefs.sort) {
        case 'key': return dir * (a.keySort - b.keySort) || byTitle(a, b);
        case 'plays': return dir * (a.plays - b.plays) || byTitle(a, b);
        case 'last': return dir * (a.last || '0').localeCompare(b.last || '0') || byTitle(a, b);
        case 'videos': return dir * (a.videos - b.videos) || byTitle(a, b);
        default: return dir * byTitle(a, b);
      }
    });
    return out;
  }, [rows, query, prefs, locale]);

  if (loading) return <p className="lu-loading">{s.loading}</p>;

  const flagLabel: Record<Flag, string> = {
    nolyrics: s.filterNoLyrics, nokey: s.filterNoKey, nocredits: s.filterNoCredits, cover: s.coverTag,
    neverplayed: s.filterNeverPlayed, played: s.filterPlayed, videos: s.filterHasVideos,
  };
  const head = (k: SortKey, label: string, className = '') => (
    <th className={className} aria-sort={prefs.sort === k ? (prefs.desc ? 'descending' : 'ascending') : undefined}>
      <button type="button" className={`lu-sort${prefs.sort === k ? ' is-on' : ''}`} onClick={() => sortBy(k)}>
        {label}<span aria-hidden="true">{prefs.sort === k ? (prefs.desc ? ' ↓' : ' ↑') : ''}</span>
      </button>
    </th>
  );
  const filtering = prefs.flags.length > 0 || !!prefs.key || !!query.trim();

  return (
    <>
      <div className="lu-page-head">
        <h1>{s.songsTitle} <span className="lu-count">{songs.length}</span></h1>
        <Link to={`${prefix}/songs/new`} className="lu-btn lu-btn-primary lu-btn-lg">+ {s.addSongItem}</Link>
      </div>

      <div className="lu-songs-tools">
        <input className="lu-search" type="search" placeholder={s.songsSearch} value={query} onChange={e => setQuery(e.target.value)} aria-label={s.search} />
        <div className="lu-songs-filters">
          <div className="lu-chips" role="group" aria-label={s.filterLabel}>
            {FLAGS.map(f => (
              <button key={f} type="button" aria-pressed={prefs.flags.includes(f)} className={`lu-pill${prefs.flags.includes(f) ? ' is-on' : ''}`} onClick={() => toggleFlag(f)}>
                {flagLabel[f]}
              </button>
            ))}
          </div>
          <select className="lu-key-filter" value={prefs.key} onChange={e => setPrefs(p => ({ ...p, key: e.target.value }))} aria-label={s.songKey}>
            <option value="">{s.songKey}: {s.filterAll}</option>
            <option value="major">{s.keyMajorAll}</option>
            <option value="minor">{s.keyMinorAll}</option>
            <optgroup label={s.keyMajorAll}>{KEYS.filter(k => !k.endsWith('m')).map(k => <option key={k} value={k}>{k}</option>)}</optgroup>
            <optgroup label={s.keyMinorAll}>{KEYS.filter(k => k.endsWith('m')).map(k => <option key={k} value={k}>{k}</option>)}</optgroup>
          </select>
        </div>
        <p className="lu-hint lu-songs-count" aria-live="polite">
          {s.showingCount} {list.length} / {rows.length}
          {filtering && <> · <button type="button" className="lu-link-btn" onClick={() => { setQuery(''); setPrefs(p => ({ ...p, flags: [], key: '' })); }}>{s.filterClear}</button></>}
        </p>
      </div>

      {list.length === 0 ? <p className="lu-empty">{s.noResults}</p> : (
        <div className="lu-table-wrap">
          <table className="lu-table lu-songs-grid">
            <thead>
              <tr>
                {head('title', s.colTitle)}
                {head('key', s.songKey)}
                <th className="lu-td-center">{s.secLyrics}</th>
                {head('plays', s.songStatLive, 'lu-td-num')}
                {head('last', s.songStatLast)}
                {head('videos', s.songVideos, 'lu-td-num')}
                <th>{s.creditsCol}</th>
              </tr>
            </thead>
            <tbody>
              {list.map(r => (
                <tr key={r.id} onClick={e => { if (!(e.target as HTMLElement).closest('a')) navigate(`${prefix}/songs/${r.id}`); }}>
                  <td className="lu-sg-title">
                    <Link to={`${prefix}/songs/${r.id}`}>{r.title}</Link>
                    {r.alt && <span className="lu-sg-alt" lang="en">{r.alt}</span>}
                    {r.cover && <span className="lu-sg-cover">{s.coverOf.replace('{artist}', r.cover)}</span>}
                  </td>
                  <td className="lu-sg-key">{r.keyText || <span className="lu-sg-none">—</span>}</td>
                  <td className="lu-td-center">{r.lyrics ? <span className="lu-sg-yes" aria-label={s.lyricsLinked}>✓</span> : <span className="lu-sg-none">—</span>}</td>
                  <td className="lu-td-num">{r.plays || <span className="lu-sg-none">0</span>}</td>
                  <td className="lu-sg-date">{r.last || <span className="lu-sg-none">—</span>}</td>
                  <td className="lu-td-num">{r.videos || <span className="lu-sg-none">0</span>}</td>
                  <td className="lu-sg-credits">{[r.music, r.words].filter(Boolean).join(' / ') || <span className="lu-sg-none">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
