import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminStrings } from '../../i18n/admin';
import type { Event } from '../../types';
import { saveMedia, getVideoTitle, type MediaRow } from '../../services/adminService';
import YouTubePlayer, { type PlayerHandle } from './YouTubePlayer';
import { youTubeId, youTubeStart, youTubeThumb, youTubeWatch, formatTime } from '../../utils/youtube';
import { normalize } from './SuggestInput';
import { errorText, ConfirmDialog } from './ui';

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

  // Live: marked starts first; then, from shows it was played at, videos with
  // no songs marked at all, as "whole show". A video with any song marked is a
  // clip or a marked-up show: it only appears on the pages of the songs marked in it
  const live = useMemo<Item[]>(() => {
    const key = normalize(title);
    const byEvent = new Map(events.map(e => [e.id, e]));
    const parts = media.filter(r => r.kind === 'part' && normalize(r.song) === key);
    const out: Item[] = parts.map((r, i) => {
      const ev = byEvent.get(r.owner);
      return { key: `p${i}`, url: r.url, start: r.start === '' ? null : Number(r.start), label: ev?.date || r.owner, sub: showName(ev), href: `${prefix}/events/${r.owner}` };
    });
    const anyMarked = new Set(media.filter(r => r.kind === 'part').map(r => `${r.owner}|${r.url}`));
    media.filter(r => r.kind === 'show' && played.includes(r.owner) && !anyMarked.has(`${r.owner}|${r.url}`)).forEach((r, i) => {
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
  const [removing, setRemoving] = useState<number | null>(null);
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
    const on = !!playing && id === playing.id && (it.start ?? null) === playing.start;
    return (
      <li key={it.key} className={`lu-vcard${on ? ' is-on' : ''}`}>
        <button type="button" className="lu-vcard-play" onClick={() => play(it.url, it.start)} aria-label={`${s.videoPlay}: ${it.label}`}>
          {id ? <img src={youTubeThumb(id)} alt="" loading="lazy" /> : <span className="lu-vcard-link">↗</span>}
          <span className="lu-vcard-time">▶ {it.whole ? s.songVideoWhole : it.start !== null ? formatTime(it.start) : s.videoPlay}</span>
        </button>
        <span className="lu-vcard-text">
          <button type="button" className="lu-vcard-title" onClick={() => play(it.url, it.start)}>{it.label}</button>
          {it.sub && (it.href ? <Link to={it.href} className="lu-vcard-sub">{it.sub}</Link> : <span className="lu-vcard-sub">{it.sub}</span>)}
        </span>
      </li>
    );
  };
  const ownItems = own.map((r, i): Item => ({ key: `o${i}`, url: r.url, start: null, label: r.title || r.url.replace(/^https?:\/\/(www\.)?/, '') }));
  const both = live.length > 0 && ownItems.length > 0;
  const editingRows = editingOwn || rows.length > 0;

  return (
    <div className="lu-videos lu-videos-compact">
      <ConfirmDialog
        s={s} open={removing !== null}
        title={s.videoRemoveTitle} body={s.videoRemoveBody} confirmLabel={s.videoRemoveYes}
        onCancel={() => setRemoving(null)}
        onConfirm={() => { setRows(rs => rs.filter((_, j) => j !== removing)); setRemoving(null); }}
      />

      {playing && (
        <div className="lu-video-body is-song">
          <YouTubePlayer key={playing.id} videoId={playing.id} start={playing.start} autoplay onReady={h => { handle.current = h; }} />
          <a className="lu-hint" href={youTubeWatch(playing.id, playing.start)} target="_blank" rel="noopener noreferrer">{s.videoOpen} ↗</a>
        </div>
      )}

      {live.length === 0 && ownItems.length === 0 && !editingRows && <p className="lu-hint">{s.songVideosNone}</p>}
      {live.length > 0 && (
        <>
          {both && <p className="lu-vgroup">{s.songVideosLive}</p>}
          <ul className="lu-vcards">{live.map(card)}</ul>
        </>
      )}
      {ownItems.length > 0 && !editingOwn && (
        <>
          {both && <p className="lu-vgroup">{s.songVideosOther}</p>}
          <ul className="lu-vcards">{ownItems.map(card)}</ul>
        </>
      )}

      {editingRows && (
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
                onClick={() => (r.url.trim() ? setRemoving(i) : setRows(rs => rs.filter((_, j) => j !== i)))}>✕</button>
            </div>
          ))}
          <div className="lu-row lu-section-actions">
            {state && !['saving', 'saved'].includes(state) && <span className="lu-field-error">{s.errorPrefix} {state}</span>}
            <button type="button" className="lu-btn" disabled={state === 'saving'}
              onClick={() => { if (changed && !window.confirm(s.songDiscard)) return; setRows([]); setEditingOwn(false); setState(''); }}>{s.cancel}</button>
            <button type="button" className="lu-btn lu-btn-primary" onClick={save} disabled={state === 'saving' || !changed}>
              {state === 'saving' ? s.saving : s.save}
            </button>
          </div>
        </div>
      )}

      {!editingRows && (
        <div className="lu-vfoot">
          <button type="button" className="lu-link-btn" onClick={() => setRows([{ url: '', title: '', show: '' }])}>+ {s.videoAdd}</button>
          {ownItems.length > 0 && <button type="button" className="lu-link-btn" onClick={startEditOwn}>✎ {s.songVideosEditOwn}</button>}
          {state === 'saved' && <span className="lu-hint">✓ {s.songVideosSaved}</span>}
        </div>
      )}
    </div>
  );
}
