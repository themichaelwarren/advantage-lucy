import Icon from './Icon';
import { useEffect, useState } from 'react';
import type { AdminStrings } from '../../i18n/admin';
import { getVideoTitle, type MediaRow } from '../../services/adminService';
import type { SetlistItem } from './SetlistEditor';
import YouTubePlayer, { type PlayerHandle } from './YouTubePlayer';
import { youTubeId, youTubeStart, youTubeWatch, youTubeThumb, formatTime, parseTypedTime } from '../../utils/youtube';
import { normalize } from './SuggestInput';
import { ConfirmDialog } from './ui';
import TimestampPaste from './TimestampPaste';
import { looseKey, matchSong } from '../../utils/timestamps';
import type { Song } from '../../types';

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
  /** Start of each song, by its place in the setlist: "シトラス#1" (#2 if played twice) */
  starts: Record<string, number>;
}

/**
 * Each setlist row's lasting name for its start time: the song plus which
 * time it's played ("めまい#2"). Row keys change whenever the setlist
 * reloads; this doesn't, so marked times stay with their songs.
 */
export function songSlots(setlist: SetlistItem[]): Record<string, string> {
  const seen: Record<string, number> = {};
  const out: Record<string, string> = {};
  for (const item of setlist) {
    if (!item.song.trim()) continue;
    const n = normalize(item.song);
    seen[n] = (seen[n] || 0) + 1;
    out[item.key] = `${n}#${seen[n]}`;
  }
  return out;
}

let nextKey = 0;
export const newVideo = (url = '', title = ''): ShowVideo => ({ key: `v${nextKey++}`, url, title, starts: {} });

/** Media rows of one show → videos on screen (song times matched to setlist rows by title, in order). */
export function toShowVideos(rows: MediaRow[], eventId: string, setlist: SetlistItem[]): ShowVideo[] {
  const mine = rows.filter(r => r.owner === eventId);
  const videos = mine.filter(r => r.kind === 'show').map(r => newVideo(r.url, r.title));
  // A part whose video has no "show" row still gets a video (it was added some other way)
  for (const p of mine.filter(r => r.kind === 'part')) {
    if (!videos.some(v => v.url === p.url)) videos.push(newVideo(p.url));
  }
  const slots = Object.values(songSlots(setlist));
  for (const v of videos) {
    const seen: Record<string, number> = {};
    for (const p of mine.filter(r => r.kind === 'part' && r.url === v.url)) {
      if (p.start === '') continue;
      const n = normalize(p.song);
      seen[n] = (seen[n] || 0) + 1;
      const slot = `${n}#${seen[n]}`;
      if (slots.includes(slot)) v.starts[slot] = Number(p.start);
    }
  }
  return videos;
}

/** Videos on screen → Media rows to save for the show. */
export function fromShowVideos(videos: ShowVideo[], setlist: SetlistItem[]): Partial<MediaRow>[] {
  const out: Partial<MediaRow>[] = [];
  const slot = songSlots(setlist);
  for (const v of videos) {
    if (!v.url.trim()) continue;
    out.push({ kind: 'show', url: v.url.trim(), title: v.title.trim() });
    for (const item of setlist) {
      const t = v.starts[slot[item.key]];
      if (item.song.trim() && t !== undefined) out.push({ kind: 'part', url: v.url.trim(), song: item.song.trim(), start: String(t) });
    }
  }
  return out;
}

/** For "unsaved changes": what matters about the videos. */
export const videosSnapshot = (videos: ShowVideo[], setlist: SetlistItem[]) => JSON.stringify(fromShowVideos(videos, setlist));

export default function ShowVideos({ s, videos, onChange, setlist, editing = true, knownSongs = [] }: {
  s: AdminStrings;
  videos: ShowVideo[];
  onChange: React.Dispatch<React.SetStateAction<ShowVideo[]>>;
  setlist: SetlistItem[];
  /** false: watch only (player and the marked songs); true: change links and times */
  editing?: boolean;
  /** All songs, so pasted names match by any title or reading */
  knownSongs?: Song[];
}) {
  const [openKey, setOpenKey] = useState<string | null>(videos[0]?.key ?? null);
  const [removing, setRemoving] = useState<ShowVideo | null>(null);
  // Starting to edit with no videos: open with an empty link to paste into
  // …and leaving edit mode (saved or cancelled) drops any link box left empty
  // Editing with videos already there: open the first, so its song times (and paste) are in view
  useEffect(() => {
    if (editing && !openKey && videos.length > 0 && videos[0].url.trim()) setOpenKey(videos[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, videos.length]);
  useEffect(() => {
    if (editing && videos.length === 0) { const v = newVideo(); onChange([v]); setOpenKey(v.key); }
    if (!editing) onChange(vs => (vs.some(v => !v.url.trim()) ? vs.filter(v => v.url.trim()) : vs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);
  const [player, setPlayer] = useState<PlayerHandle | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({}); // typed times not yet valid
  const songs = setlist.filter(i => i.song.trim());
  const slot = songSlots(setlist);

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
    const k = slot[itemKey];
    if (sec === null) delete starts[k]; else starts[k] = Math.floor(sec);
    update(v.key, { starts });
  };

  // ---------- Watching: nothing here changes anything ----------
  if (!editing) {
    const open = videos.find(v => v.key === openKey);
    const openId = open ? youTubeId(open.url) : null;
    const marksOf = (v: ShowVideo) => songs
      .filter(i => v.starts[slot[i.key]] !== undefined)
      .map(i => ({ item: i, t: v.starts[slot[i.key]] }))
      .sort((x, y) => x.t - y.t);
    return (
      <div className="lu-videos lu-videos-compact">
        {videos.length === 0 && <p className="lu-hint">{s.videosNoneShow}</p>}
        {videos.length > 0 && (
          <ul className="lu-vcards">
            {videos.map(v => {
              const id = youTubeId(v.url);
              const n = marksOf(v).length;
              const label = v.title || v.url.replace(/^https?:\/\/(www\.)?/, '');
              const pick = () => (id ? setOpenKey(k => (k === v.key ? null : v.key)) : window.open(v.url, '_blank', 'noopener'));
              return (
                <li key={v.key} className={`lu-vcard${openKey === v.key ? ' is-on' : ''}`}>
                  <button type="button" className="lu-vcard-play" onClick={pick} aria-label={`${s.videoPlay}: ${label}`}>
                    {id ? <img src={youTubeThumb(id)} alt="" loading="lazy" /> : <span className="lu-vcard-link">↗</span>}
                    <span className="lu-vcard-time">▶ {n ? s.videoSongsN.replace('{n}', String(n)) : s.videoPlay}</span>
                  </button>
                  <span className="lu-vcard-text">
                    <button type="button" className="lu-vcard-title" onClick={pick}>{label}</button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {open && openId && (
          <div className="lu-video-body">
            <YouTubePlayer key={openId} videoId={openId} onReady={setPlayer} title={open.title || undefined} />
            <div className="lu-video-parts">
              {marksOf(open).length === 0 ? <p className="lu-hint">{s.videoNoMarks}</p> : (
                <ol className="lu-video-chapters">
                  {marksOf(open).map(({ item, t }) => (
                    <li key={item.key}>
                      <button type="button" onClick={() => player?.seek(t)} disabled={!player}>
                        <span className="lu-video-song">{item.song}</span>
                        <span className="lu-video-at">{formatTime(t)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <a className="lu-hint" href={youTubeWatch(openId)} target="_blank" rel="noopener noreferrer">{s.videoOpen} ↗</a>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- Editing ----------
  return (
    <div className="lu-videos">
      <ConfirmDialog
        s={s} open={!!removing}
        title={s.videoRemoveTitle} body={s.videoRemoveBody} confirmLabel={s.videoRemoveYes}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) { onChange(vs => vs.filter(x => x.key !== removing.key)); if (openKey === removing.key) setOpenKey(null); }
          setRemoving(null);
        }}
      />
      {videos.map(v => {
        const id = youTubeId(v.url);
        const open = openKey === v.key;
        const marked = songs.filter(i => v.starts[slot[i.key]] !== undefined).length;
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
                  update(v.key, { url, ...(t !== null && first && !Object.keys(v.starts).length ? { starts: { [slot[first.key]]: t } } : {}) });
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
                onClick={() => (v.url.trim() ? setRemoving(v) : onChange(vs => vs.filter(x => x.key !== v.key)))}><Icon name="close" /></button>
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
                      <TimestampPaste s={s} label={s.pasteTimesForVideo} onRead={lines => {
                        // Each pasted song with a time → the first setlist row of that song not yet used
                        const starts = { ...v.starts };
                        const used = new Set<string>();
                        let filled = 0, missed = 0;
                        for (const l of lines) {
                          if (l.start === null) continue;
                          const key = looseKey(matchSong(l.title, knownSongs)?.title || l.title);
                          const item = songs.find(it => !used.has(it.key) && looseKey(it.song) === key);
                          if (!item) { missed++; continue; }
                          used.add(item.key); starts[slot[item.key]] = l.start; filled++;
                        }
                        if (!filled) return s.pasteNoTimes;
                        update(v.key, { starts });
                        return missed ? s.pasteTimesMissed.replace('{n}', String(filled)).replace('{m}', String(missed)) : s.pasteTimesDone.replace('{n}', String(filled));
                      }} />
                      <ol>
                        {songs.map(item => {
                          const t = v.starts[slot[item.key]];
                          const draftKey = `${v.key}:${item.key}`;
                          const draft = drafts[draftKey];
                          return (
                            <li key={item.key} className={t !== undefined ? 'has-time' : ''}>
                              <span className="lu-video-song">{item.song}</span>
                              <input
                                className="lu-video-time" inputMode="decimal" placeholder="0:00" aria-label={`${item.song}: ${s.videoStart}`}
                                value={draft ?? (t !== undefined ? formatTime(t) : '')}
                                onChange={e => {
                                  const text = e.target.value;
                                  const sec = parseTypedTime(text);
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
