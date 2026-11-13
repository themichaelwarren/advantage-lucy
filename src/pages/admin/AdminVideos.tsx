import Icon from '../../components/admin/Icon';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllEvents, useAllSongs, useAllSetlists, useVenues, useAreas } from '../../hooks/useSheetData';
import VideoIntake from '../../components/admin/VideoIntake';
import { useAdminT } from '../../i18n/admin';
import { getMedia, getLinkCheck, isDeadLink, type MediaRow, type LinkState, UNSORTED_VIDEOS } from '../../services/adminService';
import { normalize } from '../../components/admin/SuggestInput';
import ListToolbar, { useListPrefs } from '../../components/admin/ListToolbar';
import YouTubePlayer, { type PlayerHandle } from '../../components/admin/YouTubePlayer';
import { youTubeId, youTubeThumb, youTubeWatch, formatTime } from '../../utils/youtube';
import { songTitle, songSearchText, songQuery, hira } from '../../utils/songTitles';
import { errorText } from '../../components/admin/ui';
import type { Event, Song } from '../../types';
import CopyDownload from '../../components/admin/CopyDownload';

/**
 * Every video in one place (admin only): show videos with the songs marked
 * in them, and videos added on a song's own page. Search finds a video by
 * anything about it: its title, the show (either language, venue, city,
 * date) and the songs in it (any title or the reading).
 */
type Filter = 'all' | 'shows' | 'songs' | 'unmarked' | 'dead' | 'unsorted';
type Sort = 'newest' | 'oldest' | 'title' | 'marks';

interface Mark { song: string; songRow?: Song; start: number }
interface Video {
  key: string;
  url: string;
  ytId: string | null;
  title: string;
  kind: 'show' | 'song';
  event?: Event;
  song?: Song;          // for a song's own video
  marks: Mark[];
  date: string;
  /** Saved without a show (date unknown), waiting to be connected */
  unsorted?: boolean;
  search: string;
}

export default function AdminVideos() {
  const { s, locale, prefix } = useAdminT();
  const { events: loadedEvents } = useAllEvents();
  // Shows made from the add-a-video form, until the list is next loaded
  const [madeEvents, setMadeEvents] = useState<Event[]>([]);
  const events = useMemo(() => [...loadedEvents, ...madeEvents.filter(m => !loadedEvents.some(e => e.id === m.id))], [loadedEvents, madeEvents]);
  const { songs, refresh: refreshSongs } = useAllSongs();
  const { venues, refresh: refreshVenues } = useVenues();
  const { areas, refresh: refreshAreas } = useAreas();
  const [media, setMedia] = useState<MediaRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { getMedia().then(setMedia).catch(err => setError(errorText(err))); }, []);
  // Which videos no longer play (deleted or made private)
  const [state, setState] = useState<Record<string, LinkState>>({});
  useEffect(() => { getLinkCheck().then(r => setState(r.videos)).catch(() => {}); }, []);
  const dead = (v: { url: string }) => isDeadLink(state[v.url.trim()]);
  const ui = useListPrefs<Filter, Sort>('videos', { filter: 'all', sort: 'newest' });
  const [year, setYear] = useState('');
  const [open, setOpen] = useState<Video | null>(null);
  // The add-a-video window: new, or connecting a video saved without a show
  const [adding, setAdding] = useState<null | { start?: { url: string; title: string } }>(null);
  const { setlists, refresh: refreshSetlists } = useAllSetlists();

  const pick = (en?: string, ja?: string) => (locale === 'ja' ? ja || en : en || ja) || '';
  const showName = (e?: Event) => (e ? pick(e.title_en, e.title_ja) || pick(e.venue_en, e.venue_ja) : '');

  const videos = useMemo<Video[]>(() => {
    if (!media) return [];
    const eventBy = new Map(events.map(e => [e.id, e]));
    const songBy = new Map(songs.map(x => [normalize(x.title), x]));
    const songById = new Map(songs.map(x => [x.id, x]));
    const out = new Map<string, Video>();
    const add = (v: Omit<Video, 'search'>) => { if (!out.has(v.key)) out.set(v.key, { ...v, search: '' }); return out.get(v.key)!; };
    for (const r of media) {
      if (r.kind === 'show' || r.kind === 'part') {
        const e = eventBy.get(r.owner);
        const v = add({ key: `${r.owner}|${r.url}`, url: r.url, ytId: youTubeId(r.url), title: '', kind: 'show', event: e, marks: [], date: e?.date || '', unsorted: r.owner === UNSORTED_VIDEOS });
        if (r.kind === 'show' && r.title) v.title = r.title;
        if (r.kind === 'part' && r.start !== '') v.marks.push({ song: r.song, songRow: songBy.get(normalize(r.song)), start: Number(r.start) });
      } else if (r.kind === 'song') {
        const sg = songById.get(r.owner.replace(/^song:/, ''));
        add({ key: `${r.owner}|${r.url}`, url: r.url, ytId: youTubeId(r.url), title: r.title, kind: 'song', song: sg, marks: [], date: '' });
      }
    }
    // Everything a search can match, folded the same way as the query (case, width, kana)
    for (const v of out.values()) {
      v.marks.sort((a, b) => a.start - b.start);
      const e = v.event;
      v.search = hira(normalize([
        v.title, v.date, v.date.replace(/-/g, '/'), v.url,
        e?.title_en, e?.title_ja, e?.venue_en, e?.venue_ja, e?.city_en, e?.city_ja, e?.performers,
        ...v.marks.map(m => (m.songRow ? songSearchText(m.songRow) : m.song)),
        v.song ? songSearchText(v.song) : '',
      ].filter(Boolean).join(' ')));
    }
    return [...out.values()];
  }, [media, events, songs]);

  const years = useMemo(() => [...new Set(videos.map(v => v.date.slice(0, 4)).filter(Boolean))].sort().reverse(), [videos]);
  const list = useMemo(() => {
    // Every word must match somewhere ("めまい 2025"), each folded like the search text
    const words = ui.query.trim().split(/\s+/).map(songQuery).filter(Boolean);
    const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
    const label = (v: Video) => v.title || showName(v.event) || (v.song ? songTitle(v.song, locale) : v.url);
    return videos
      .filter(v => ui.filter === 'all' || (ui.filter === 'dead' ? dead(v) : ui.filter === 'unsorted' ? !!v.unsorted : ui.filter === 'shows' ? v.kind === 'show' && !v.unsorted : ui.filter === 'songs' ? v.kind === 'song' : v.kind === 'show' && !v.unsorted && v.marks.length === 0))
      .filter(v => !year || v.date.startsWith(year))
      .filter(v => words.every(w => v.search.includes(w)))
      .sort((a, b) => ui.sort === 'title' ? collator.compare(label(a), label(b))
        : ui.sort === 'marks' ? b.marks.length - a.marks.length || b.date.localeCompare(a.date)
        : ui.sort === 'oldest' ? (a.date || '9').localeCompare(b.date || '9')
        : (b.date || '').localeCompare(a.date || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos, ui.query, ui.filter, ui.sort, year, locale, state]);

  if (error) return <div className="lu-alert">{error}</div>;
  if (!media) return <p className="lu-loading">{s.loading}</p>;

  const count = (f: Filter) => videos.filter(v => f === 'unsorted' ? !!v.unsorted : f === 'shows' ? v.kind === 'show' && !v.unsorted : f === 'songs' ? v.kind === 'song' : v.kind === 'show' && !v.unsorted && v.marks.length === 0).length;
  const unmarked = count('unmarked');

  return (
    <div className="lu-videos-page">
      <div className="lu-page-head">
        <div>
          <h1>{s.videosTitle} <span className="lu-count">{videos.length}</span></h1>
          <p className="lu-hint lu-videos-intro"><Icon name="lock" /> <span className="is-long">{s.videosIndexHint}</span><span className="is-short">{s.videosIndexHintShort}</span></p>
        </div>
        <button type="button" className="lu-btn lu-btn-primary lu-btn-lg" onClick={() => setAdding({})}>+ {s.videoAdd}</button>
      </div>
      <ListToolbar
        s={s}
        query={ui.query} onQuery={ui.setQuery}
        filters={[
          { value: 'all', label: s.filterAll },
          // Only the kinds there are (no "Song videos · 0")
          ...(count('shows') ? [{ value: 'shows', label: `${s.vfShows} · ${count('shows')}` }] : []),
          ...(count('songs') ? [{ value: 'songs', label: `${s.vfSongs} · ${count('songs')}` }] : []),
          ...(unmarked ? [{ value: 'unmarked', label: `${s.vfUnmarked} · ${unmarked}` }] : []),
          ...(count('unsorted') ? [{ value: 'unsorted', label: <><Icon name="clock" /> {s.vfUnsorted} · {count('unsorted')}</> }] : []),
          ...(videos.some(dead) ? [{ value: 'dead', label: <><Icon name="warn" /> {s.vfDead} · {videos.filter(dead).length}</> }] : []),
        ]}
        filter={ui.filter} onFilter={v => ui.setFilter(v as Filter)}
        sorts={[
          { value: 'newest', label: s.sortNewest }, { value: 'oldest', label: s.sortOldest },
          { value: 'title', label: s.sortTitle }, { value: 'marks', label: s.vSortMarks },
        ]}
        sort={ui.sort} onSort={v => ui.setSort(v as Sort)}
        shown={list.length} total={videos.length}
      />
      {years.length > 1 && (
        <div className="lu-chips lu-video-years" role="group" aria-label={s.vYear}>
          <button type="button" className={`lu-pill${!year ? ' is-on' : ''}`} aria-pressed={!year} onClick={() => setYear('')}>{s.vYearAll}</button>
          {years.map(y => (
            <button key={y} type="button" className={`lu-pill${year === y ? ' is-on' : ''}`} aria-pressed={year === y} onClick={() => setYear(y)}>{y}</button>
          ))}
        </div>
      )}

      {videos.length === 0 ? <p className="lu-empty">{s.videosNone}</p> : list.length === 0 ? <p className="lu-empty">{s.noResults}</p> : (
        <ul className="lu-vgrid">
          {list.map(v => {
            const name = v.title || showName(v.event) || (v.song ? songTitle(v.song, locale) : v.url.replace(/^https?:\/\/(www\.)?/, ''));
            return (
              <li key={v.key} className="lu-vgrid-item">
                <button type="button" className="lu-vgrid-thumb" onClick={() => (v.ytId ? setOpen(v) : window.open(v.url, '_blank', 'noopener'))} aria-label={`${s.videoPlay}: ${name}`}>
                  {v.ytId ? <img src={youTubeThumb(v.ytId)} alt="" loading="lazy" /> : <span className="lu-vcard-link">↗</span>}
                  {dead(v) && <span className="lu-vgrid-dead"><Icon name="warn" /> {state[v.url.trim()] === 'private' ? s.videoPrivateNow : s.videoGone}</span>}
                  <span className="lu-vgrid-badge">{v.unsorted ? s.vfUnsorted : v.kind === 'song' ? `♫ ${s.vfSongs}` : v.marks.length ? `▶ ${s.videoSongsN.replace('{n}', String(v.marks.length))}` : `▶ ${s.vNoMarks}`}</span>
                </button>
                <div className="lu-vgrid-text">
                  <CopyDownload url={v.url} label={s.copyDownload}
                    parts={[v.event?.date || v.date, v.event ? pick(v.event.venue_en, v.event.venue_ja) : v.song ? songTitle(v.song, locale) : '', '–', name]} />
                  <strong className="lu-vgrid-title">{name}</strong>
                  {v.event && (
                    <Link to={`${prefix}/events/${v.event.id}`} className="lu-vgrid-show">
                      {/* The title is the show's name when the video has none: then just date and venue here */}
                      <time>{v.event.date}</time>
                      {[v.title ? showName(v.event) : '', pick(v.event.venue_en, v.event.venue_ja)].filter((x, i, all) => x && all.indexOf(x) === i).map(x => ` · ${x}`).join('')}
                    </Link>
                  )}
                  {v.song && <Link to={`${prefix}/songs/${v.song.id}`} className="lu-vgrid-show">♫ {songTitle(v.song, locale)}</Link>}
                  {v.unsorted && <button type="button" className="lu-btn lu-vgrid-connect" onClick={() => setAdding({ start: { url: v.url, title: v.title } })}><Icon name="shows" /> {s.vConnect} →</button>}
                  {v.marks.length > 0 && (
                    <ul className="lu-vgrid-songs">
                      {v.marks.slice(0, 5).map((m, i) => (
                        <li key={i}>{m.songRow ? <Link to={`${prefix}/songs/${m.songRow.id}`}>{songTitle(m.songRow, locale)}</Link> : m.song}</li>
                      ))}
                      {v.marks.length > 5 && <li className="is-more">+{v.marks.length - 5}</li>}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <VideoIntake s={s} locale={locale} media={media} events={events} songs={songs} setlists={setlists} start={adding.start}
          venues={venues} areas={areas} onVenuesChanged={() => { refreshVenues(); refreshAreas(); }}
          onClose={() => setAdding(null)}
          onSaved={(owner, rows, extra) => {
            if (extra.newEvent) setMadeEvents(m => [...m, extra.newEvent!]);
            if (extra.setlistChanged) refreshSetlists();
            if (extra.songsAdded) refreshSongs();
            // Show it straight away: newest first, nothing filtering it out
            setMedia(m => [...(m || []).filter(r => r.owner !== owner && (!extra.unsorted || r.owner !== UNSORTED_VIDEOS)), ...rows, ...(extra.unsorted || [])]);
            setAdding(null);
            ui.setQuery(''); ui.setFilter('all'); ui.setSort('newest'); setYear('');
          }} />
      )}
      {open && <VideoViewer v={open} onClose={() => setOpen(null)} s={s} locale={locale} prefix={prefix} showName={showName} />}
    </div>
  );
}

/** A video playing over the page, with its marked songs to jump between. */
function VideoViewer({ v, onClose, s, locale, prefix, showName }: {
  v: Video; onClose: () => void; s: ReturnType<typeof useAdminT>['s']; locale: 'en' | 'ja'; prefix: string; showName: (e?: Event) => string;
}) {
  const [player, setPlayer] = useState<PlayerHandle | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);
  const name = v.title || showName(v.event) || (v.song ? songTitle(v.song, locale) : '');
  return (
    <div className="lu-modal-overlay lu-vviewer-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lu-modal lu-vviewer" role="dialog" aria-modal="true" aria-label={name}>
        <header className="lu-edit-dialog-head">
          <div className="lu-vviewer-title">
            <strong>{name}</strong>
            {v.event && <Link to={`${prefix}/events/${v.event.id}`} onClick={onClose}>{v.event.date} · {showName(v.event)} →</Link>}
            {v.song && <Link to={`${prefix}/songs/${v.song.id}`} onClick={onClose}>♫ {songTitle(v.song, locale)} →</Link>}
          </div>
          <button type="button" className="lu-icon-btn" onClick={onClose} aria-label={s.close}><Icon name="close" /></button>
        </header>
        <div className="lu-vviewer-body">
          <YouTubePlayer videoId={v.ytId!} autoplay onReady={setPlayer} title={name} />
          {v.marks.length > 0 && (
            <ol className="lu-video-chapters">
              {v.marks.map((m, i) => (
                <li key={i}>
                  <button type="button" onClick={() => player?.seek(m.start)} disabled={!player}>
                    <span className="lu-video-song">{m.songRow ? songTitle(m.songRow, locale) : m.song}</span>
                    <span className="lu-video-at">{formatTime(m.start)}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
        <a className="lu-hint lu-vviewer-yt" href={youTubeWatch(v.ytId!)} target="_blank" rel="noopener noreferrer">{s.videoOpen} ↗</a>
      </div>
    </div>
  );
}
