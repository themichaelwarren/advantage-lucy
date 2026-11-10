import { useState } from 'react';
import type { AdminStrings } from '../../i18n/admin';
import { getVideoTitle, type MediaRow } from '../../services/adminService';
import type { SetlistItem } from './SetlistEditor';
import YouTubePlayer, { type PlayerHandle } from './YouTubePlayer';
import { youTubeId, youTubeStart, youTubeWatch, formatTime, parseTime } from '../../utils/youtube';
import { normalize } from './SuggestInput';

/**
 * Videos of a show (admin only). Paste YouTube links; the open one plays
 * here, and under it each song from the setlist gets a start time: press
 * "Now" while it plays, or type one. Saved with the show (to the private
 * Media tab), and each timed song shows up on that song's page.
 */
export interface ShowVideo {
  key: string;
  url: string;
  title: string;
  /** Start of each song, by setlist row (SetlistItem.key) */
  starts: Record<string, number>;
}

let nextKey = 0;
const newVideo = (url = '', title = ''): ShowVideo => ({ key: `v${nextKey++}`, url, title, starts: {} });

/** Media rows of one show → videos on screen (song times matched to setlist rows by title, in order). */
export function toShowVideos(rows: MediaRow[], eventId: string, setlist: SetlistItem[]): ShowVideo[] {
  const mine = rows.filter(r => r.owner === eventId);
  const videos = mine.filter(r => r.kind === 'show').map(r => newVideo(r.url, r.title));
  // A part whose video has no "show" row still gets a video (it was added some other way)
  for (const p of mine.filter(r => r.kind === 'part')) {
    if (!videos.some(v => v.url === p.url)) videos.push(newVideo(p.url));
  }
  for (const v of videos) {
    const used = new Set<string>();
    for (const p of mine.filter(r => r.kind === 'part' && r.url === v.url)) {
      const row = setlist.find(i => !used.has(i.key) && normalize(i.song) === normalize(p.song));
      if (row && p.start !== '') { used.add(row.key); v.starts[row.key] = Number(p.start); }
    }
  }
  return videos;
}

/** Videos on screen → Media rows to save for the show. */
export function fromShowVideos(videos: ShowVideo[], setlist: SetlistItem[]): Partial<MediaRow>[] {
  const out: Partial<MediaRow>[] = [];
  for (const v of videos) {
    if (!v.url.trim()) continue;
    out.push({ kind: 'show', url: v.url.trim(), title: v.title.trim() });
    for (const item of setlist) {
      const t = v.starts[item.key];
      if (item.song.trim() && t !== undefined) out.push({ kind: 'part', url: v.url.trim(), song: item.song.trim(), start: String(t) });
    }
  }
  return out;
}

/** For "unsaved changes": what matters about the videos. */
export const videosSnapshot = (videos: ShowVideo[], setlist: SetlistItem[]) => JSON.stringify(fromShowVideos(videos, setlist));

export default function ShowVideos({ s, videos, onChange, setlist }: {
  s: AdminStrings;
  videos: ShowVideo[];
  onChange: React.Dispatch<React.SetStateAction<ShowVideo[]>>;
  setlist: SetlistItem[];
}) {
  const [openKey, setOpenKey] = useState<string | null>(videos[0]?.key ?? null);
  const [player, setPlayer] = useState<PlayerHandle | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({}); // typed times not yet valid
  const songs = setlist.filter(i => i.song.trim());

  const update = (key: string, patch: Partial<ShowVideo>) => onChange(vs => vs.map(v => (v.key === key ? { ...v, ...patch } : v)));
  /** Fill in a blank title from YouTube once a link is pasted. */
  const fetchTitle = (key: string, url: string) => {
    if (!youTubeId(url)) return;
    getVideoTitle(url).then(t => {
      if (t) onChange(vs => vs.map(v => (v.key === key && !v.title.trim() && v.url === url ? { ...v, title: t } : v)));
    });
  };
  const setStart = (v: ShowVideo, itemKey: string, sec: number | null) => {
    const starts = { ...v.starts };
    if (sec === null) delete starts[itemKey]; else starts[itemKey] = Math.floor(sec);
    update(v.key, { starts });
  };

  return (
    <div className="lu-videos">
      <p className="lu-hint lu-hint-top">🔒 {s.videosPrivate}</p>
      {videos.map(v => {
        const id = youTubeId(v.url);
        const open = openKey === v.key;
        const marked = Object.keys(v.starts).filter(k => songs.some(i => i.key === k)).length;
        return (
          <div key={v.key} className={`lu-video${open ? ' is-open' : ''}`}>
            <div className="lu-video-head">
              <input
                className="lu-video-url" type="url" inputMode="url" placeholder="https://youtu.be/…"
                value={v.url} aria-label={s.videoUrl}
                onChange={e => {
                  const url = e.target.value;
                  // A link copied at a moment (?t=…) is probably where the first song starts
                  const t = youTubeStart(url);
                  const first = songs[0];
                  update(v.key, { url, ...(t !== null && first && !Object.keys(v.starts).length ? { starts: { [first.key]: t } } : {}) });
                  setOpenKey(v.key);
                  if (!v.title.trim()) fetchTitle(v.key, url);
                }}
              />
              <input className="lu-video-title" placeholder={s.videoTitle} value={v.title} aria-label={s.videoTitle} onChange={e => update(v.key, { title: e.target.value })} />
              {id && !open && (
                <button type="button" className="lu-btn lu-btn-quiet" onClick={() => setOpenKey(v.key)}>
                  ▶ {marked ? s.videoTimes.replace('{n}', String(marked)) : s.videoPlay}
                </button>
              )}
              <button type="button" className="lu-icon-btn is-danger" aria-label={s.videoRemove} title={s.videoRemove}
                onClick={() => { onChange(videos.filter(x => x.key !== v.key)); if (open) setOpenKey(null); }}>✕</button>
            </div>

            {v.url.trim() && !id && (
              /^https?:\/\//i.test(v.url.trim())
                ? <p className="lu-hint"><a href={v.url.trim()} target="_blank" rel="noopener noreferrer">{v.url.trim()} ↗</a> · {s.videoLinkOnly}</p>
                : <p className="lu-field-error">{s.videoBad}</p>
            )}

            {id && open && (
              <div className="lu-video-body">
                <YouTubePlayer videoId={id} onReady={setPlayer} title={v.title || undefined} />
                <div className="lu-video-parts">
                  <p className="lu-publish-label">{s.videoSongsTitle}</p>
                  {songs.length === 0 ? <p className="lu-hint">{s.videoNoSetlist}</p> : (
                    <>
                      <p className="lu-hint">{s.videoSongsHint}</p>
                      <ol>
                        {songs.map(item => {
                          const t = v.starts[item.key];
                          const draftKey = `${v.key}:${item.key}`;
                          const draft = drafts[draftKey];
                          return (
                            <li key={item.key} className={t !== undefined ? 'has-time' : ''}>
                              <span className="lu-video-song">{item.song}</span>
                              <input
                                className="lu-video-time" inputMode="numeric" placeholder="0:00" aria-label={`${item.song}: ${s.videoStart}`}
                                value={draft ?? (t !== undefined ? formatTime(t) : '')}
                                onChange={e => {
                                  const text = e.target.value;
                                  const sec = parseTime(text);
                                  setDrafts(d => ({ ...d, [draftKey]: text }));
                                  if (sec !== null || !text.trim()) setStart(v, item.key, text.trim() ? sec : null);
                                }}
                                onBlur={() => setDrafts(d => { const n = { ...d }; delete n[draftKey]; return n; })}
                              />
                              <button type="button" className="lu-btn lu-btn-quiet lu-video-now" disabled={!player}
                                onClick={() => { if (player) { setStart(v, item.key, player.time()); setDrafts(d => { const n = { ...d }; delete n[draftKey]; return n; }); } }}>
                                {s.videoNow}
                              </button>
                              <button type="button" className="lu-icon-btn" disabled={!player || t === undefined} aria-label={s.videoJump} title={s.videoJump}
                                onClick={() => t !== undefined && player?.seek(t)}>▶</button>
                            </li>
                          );
                        })}
                      </ol>
                    </>
                  )}
                  <a className="lu-hint" href={youTubeWatch(id)} target="_blank" rel="noopener noreferrer">{s.videoOpen} ↗</a>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <button type="button" className="lu-btn" onClick={() => { const v = newVideo(); onChange([...videos, v]); setOpenKey(v.key); }}>
        + {s.videoAdd}
      </button>
    </div>
  );
}
