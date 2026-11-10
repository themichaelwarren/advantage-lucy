import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminStrings } from '../../i18n/admin';
import type { Event } from '../../types';
import { saveMedia, getVideoTitle, type MediaRow } from '../../services/adminService';
import YouTubePlayer, { type PlayerHandle } from './YouTubePlayer';
import { youTubeId, youTubeStart, youTubeThumb, youTubeWatch, formatTime } from '../../utils/youtube';
import { normalize } from './SuggestInput';
import { errorText } from './ui';

/**
 * Every video of one song (admin only): live performances gathered from
 * show videos (where a start time was marked, or the whole show if it was
 * played there), plus videos of the song on its own, added here.
 */
interface Item { key: string; url: string; start: number | null; label: string; sub?: string; href?: string; whole?: boolean }

export default function SongVideos({ s, locale, prefix, songId, title, media, played, events, onSaved }: {
  s: AdminStrings;
  locale: 'en' | 'ja';
  prefix: string;
  songId: string;
  title: string;
  media: MediaRow[];
  /** Ids of shows the song is in the setlist of */
  played: string[];
  events: Event[];
  onSaved: (owner: string, rows: MediaRow[]) => void;
}) {
  const owner = `song:${songId}`;
  const [playing, setPlaying] = useState<{ id: string; start: number | null } | null>(null);
  const handle = useRef<PlayerHandle | null>(null);

  const showName = (ev?: Event) => ev
    ? (locale === 'ja' ? ev.title_ja || ev.venue_ja || ev.title_en || ev.venue_en : ev.title_en || ev.venue_en || ev.title_ja || ev.venue_ja)
    : '';

  // Live: marked starts first; shows it was played at with a video but no mark, as "whole show"
  const live = useMemo<Item[]>(() => {
    const key = normalize(title);
    const byEvent = new Map(events.map(e => [e.id, e]));
    const parts = media.filter(r => r.kind === 'part' && normalize(r.song) === key);
    const out: Item[] = parts.map((r, i) => {
      const ev = byEvent.get(r.owner);
      return { key: `p${i}`, url: r.url, start: r.start === '' ? null : Number(r.start), label: ev?.date || r.owner, sub: showName(ev), href: `${prefix}/events/${r.owner}` };
    });
    const marked = new Set(parts.map(r => `${r.owner}|${r.url}`));
    media.filter(r => r.kind === 'show' && played.includes(r.owner) && !marked.has(`${r.owner}|${r.url}`)).forEach((r, i) => {
      const ev = byEvent.get(r.owner);
      out.push({ key: `w${i}`, url: r.url, start: null, label: ev?.date || r.owner, sub: [showName(ev), r.title].filter(Boolean).join(' · '), href: `${prefix}/events/${r.owner}`, whole: true });
    });
    return out.sort((a, b) => b.label.localeCompare(a.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media, title, played, events, locale, prefix]);

  // Other videos of the song: edited here, saved with their own button
  const own = media.filter(r => r.owner === owner);
  type Draft = { url: string; title: string; show: string };
  // Rows being edited: new videos, plus the saved ones once ✎ is pressed
  const [editingOwn, setEditingOwn] = useState(false);
  const [rows, setRows] = useState<Draft[]>([]);
  const startEditOwn = () => { setRows(rs => [...own.map(r => ({ url: r.url, title: r.title, show: '' })), ...rs.filter(r => !own.some(o => o.url === r.url))]); setEditingOwn(true); };
  const playedShows = useMemo(
    () => events.filter(e => played.includes(e.id)).sort((a, b) => b.date.localeCompare(a.date)),
    [events, played],
  );
  const setRow = (i: number, patch: Partial<Draft>) => setRows(rs => rs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const fetchTitle = (i: number, url: string) => {
    if (!youTubeId(url)) return;
    getVideoTitle(url).then(t => { if (t) setRows(rs => rs.map((x, j) => (j === i && !x.title.trim() && x.url === url ? { ...x, title: t } : x))); });
  };
  const [state, setState] = useState<'' | 'saving' | 'saved' | string>('');
  // Without ✎, the saved videos aren't in the rows: keep them as they are
  const songOnly = (rs: Draft[]) => [...(editingOwn ? [] : own.map(r => ({ url: r.url, title: r.title }))), ...rs.filter(r => r.url.trim() && !r.show).map(r => ({ url: r.url.trim(), title: r.title.trim() }))];
  const changed = rows.some(r => r.show && r.url.trim())
    || JSON.stringify(songOnly(rows)) !== JSON.stringify(own.map(r => ({ url: r.url, title: r.title })));

  async function save() {
    setState('saving');
    try {
      // From a show: it becomes one of that show's videos, with this song
      // marked (at the link's ?t= time, else the start), so the show page has it too
      const fromShows = rows.filter(r => r.url.trim() && r.show);
      for (const r of fromShows) {
        const url = r.url.trim();
        const theirs = media.filter(m => m.owner === r.show);
        const next: Partial<MediaRow>[] = [...theirs];
        if (!theirs.some(m => m.kind === 'show' && m.url === url)) next.push({ kind: 'show', url, title: r.title.trim() });
        if (!theirs.some(m => m.kind === 'part' && m.url === url && normalize(m.song) === normalize(title))) {
          next.push({ kind: 'part', url, song: title, start: String(youTubeStart(url) ?? 0) });
        }
        onSaved(r.show, await saveMedia(r.show, next));
      }
      const saved = await saveMedia(owner, songOnly(rows).map(r => ({ kind: 'song', ...r })));
      onSaved(owner, saved);
      setRows([]);
      setEditingOwn(false);
      setState('saved');
      window.setTimeout(() => setState(st => (st === 'saved' ? '' : st)), 2500);
    } catch (err) {
      setState(errorText(err));
    }
  }

  const play = (url: string, start: number | null) => {
    const id = youTubeId(url);
    if (!id) { window.open(url, '_blank', 'noopener'); return; }
    if (playing?.id === id && handle.current) handle.current.seek(start || 0);
    setPlaying({ id, start });
  };

  const card = (it: Item) => {
    const id = youTubeId(it.url);
    return (
      <li key={it.key}>
        <button type="button" className={`lu-vcard${playing && id === playing.id && (it.start ?? null) === playing.start ? ' is-on' : ''}`} onClick={() => play(it.url, it.start)}>
          {id ? <img src={youTubeThumb(id)} alt="" loading="lazy" /> : <span className="lu-vcard-link">↗</span>}
          <span className="lu-vcard-text">
            <strong>{it.label}</strong>
            {it.sub && <span>{it.sub}</span>}
            <span className="lu-vcard-time">▶ {it.whole ? s.songVideoWhole : it.start !== null ? formatTime(it.start) : s.videoPlay}</span>
          </span>
        </button>
        {it.href && <Link to={it.href} className="lu-icon-btn" aria-label={s.editShow} title={s.editShow}>↗</Link>}
      </li>
    );
  };

  return (
    <div className="lu-videos">
      <p className="lu-hint lu-hint-top">🔒 {s.videosPrivate}</p>
      {live.length === 0 && own.length === 0 && rows.length === 0 && (
        <div className="lu-row lu-videos-empty">
          <span className="lu-hint">{s.songVideosNone}</span>
          <button type="button" className="lu-btn" onClick={() => setRows([{ url: '', title: '', show: '' }])}>+ {s.videoAdd}</button>
        </div>
      )}

      {playing && (
        <div className="lu-video-body is-song">
          <YouTubePlayer key={playing.id} videoId={playing.id} start={playing.start} autoplay onReady={h => { handle.current = h; }} />
          <a className="lu-hint" href={youTubeWatch(playing.id, playing.start)} target="_blank" rel="noopener noreferrer">{s.videoOpen} ↗</a>
        </div>
      )}


      {live.length > 0 && (
        <>
          <p className="lu-publish-label">{s.songVideosLive} · {live.length}</p>
          <ul className="lu-vcards">{live.map(card)}</ul>
        </>
      )}

      {(live.length > 0 || own.length > 0 || rows.length > 0) && <>
      <p className="lu-publish-label lu-row-between">
        <span>{s.songVideosOther}</span>
        {own.length > 0 && !editingOwn && (
          <button type="button" className="lu-icon-btn lu-edit-btn" onClick={startEditOwn} aria-label={s.songEdit} title={s.songEdit}>✎</button>
        )}
      </p>
      {own.length > 0 && !editingOwn && (
        <ul className="lu-vcards">
          {own.map((r, i) => card({ key: `o${i}`, url: r.url, start: null, label: r.title || r.url.replace(/^https?:\/\/(www\.)?/, '') }))}
        </ul>
      )}
      <div className="lu-video-edit">
        {rows.map((r, i) => (
          <div key={i} className="lu-video-head">
            <input className="lu-video-url" type="url" inputMode="url" placeholder="https://youtu.be/…" value={r.url} aria-label={s.videoUrl}
              onChange={e => { setRow(i, { url: e.target.value }); if (!r.title.trim()) fetchTitle(i, e.target.value); }} />
            <input className="lu-video-title" placeholder={s.videoTitle} value={r.title} aria-label={s.videoTitle}
              onChange={e => setRow(i, { title: e.target.value })} />
            {playedShows.length > 0 && (
              <select className="lu-video-show" value={r.show} aria-label={s.videoFromShow} onChange={e => setRow(i, { show: e.target.value })}>
                <option value="">{s.videoNoShow}</option>
                {playedShows.map(ev => <option key={ev.id} value={ev.id}>{ev.date} · {showName(ev)}</option>)}
              </select>
            )}
            <button type="button" className="lu-icon-btn is-danger" aria-label={s.videoRemove} title={s.videoRemove}
              onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <div className="lu-row">
          <button type="button" className="lu-btn" onClick={() => setRows(rs => [...rs, { url: '', title: '', show: '' }])}>+ {s.videoAdd}</button>
          {(changed || state) && (
            <button type="button" className="lu-btn lu-btn-primary" onClick={save} disabled={state === 'saving' || !changed}>
              {state === 'saving' ? s.saving : state === 'saved' ? `✓ ${s.songVideosSaved}` : s.save}
            </button>
          )}
          {state && !['saving', 'saved'].includes(state) && <span className="lu-field-error">{s.errorPrefix} {state}</span>}
        </div>
      </div>
      </>}
    </div>
  );
}
