import { useEffect, useMemo, useRef, useState } from 'react';
import type { AdminLocale, AdminStrings } from '../../i18n/admin';
import type { Area, Event, SetlistEntry, Song, Venue } from '../../types';
import { saveMedia, getVideoTitle, createRow, updateRow, replaceRows, type MediaRow } from '../../services/adminService';
import { youTubeId, youTubeThumb, youTubeStart, parseTypedTime, formatTime } from '../../utils/youtube';
import { songTitle, songAltTitle, songSearchText, songQuery, hira, compareSongs } from '../../utils/songTitles';
import { parseTimestamps, matchSong, looseKey } from '../../utils/timestamps';
import { EVENT_COLUMNS, eventToRow } from '../../utils/adminRows';
import { todayInJapan } from '../../utils/showDates';
import SuggestInput, { normalize } from './SuggestInput';
import VenuePicker from './VenuePicker';
import { addMissingSongs } from './songs';
import { errorText, makeId } from './ui';

/**
 * Add a video, step by step (admin Videos page). Any YouTube link: the
 * band's own or a fan's.
 *   1. the link (title fetched; already-added videos are caught)
 *   2. a live video from a show, or a video of one song
 *   3. which show (suggested from a date in the title), or a new one for
 *      the archive; or which song
 *   4. the songs in it: tick them from the setlist, or paste the
 *      timestamps from the video's description. A show with no setlist
 *      gets one from the paste, with every song already marked.
 */
type Step = 'link' | 'kind' | 'pick' | 'songs';
type Kind = 'show' | 'song';
interface Row { key: number; song: string; time: string }
let rowKey = 0;

/** A date written in a video title: 2025-11-30, 2025.11.30, 2025/11/30, 20251130, 2025年11月30日. */
export function dateInTitle(title: string): string | null {
  const m = title.match(/(19\d{2}|20\d{2})\s*[-./年]?\s*(\d{1,2})\s*[-./月]?\s*(\d{1,2})\s*日?/);
  if (!m) return null;
  const [y, mo, d] = [m[1], Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function VideoIntake({ s, locale, media, events, songs, setlists, venues, areas, onVenuesChanged, onClose, onSaved }: {
  s: AdminStrings;
  locale: AdminLocale;
  media: MediaRow[];
  events: Event[];
  songs: Song[];
  setlists: SetlistEntry[];
  venues: Venue[];
  areas: Area[];
  onVenuesChanged: () => void;
  onClose: () => void;
  /** After saving: the owner's rows; a show made here; whether the setlist or songs changed */
  onSaved: (owner: string, rows: MediaRow[], extra: { newEvent?: Event; setlistChanged?: boolean; songsAdded?: boolean }) => void;
}) {
  const [step, setStep] = useState<Step>('link');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<Kind | null>(null);
  const [eventId, setEventId] = useState('');
  const [newShow, setNewShow] = useState<{ date: string; venue: string; title: string } | null>(null);
  const [songId, setSongId] = useState('');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [times, setTimes] = useState<Record<number, string>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [paste, setPaste] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteNote, setPasteNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const box = useRef<HTMLDivElement>(null);

  // Escape closes; the page behind doesn't scroll
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);
  useEffect(() => { box.current?.scrollTo(0, 0); setQuery(''); }, [step]);

  const id = youTubeId(url);
  const same = (a: string, b: string) => youTubeId(a) === youTubeId(b);
  const already = id ? media.filter(r => (r.kind === 'show' || r.kind === 'song') && youTubeId(r.url) === id) : [];

  // Fill in the title from YouTube once a link is pasted
  useEffect(() => {
    if (!id) return;
    let live = true;
    getVideoTitle(url).then(t => { if (live && t) setTitle(old => old || t); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const pick = (en?: string, ja?: string) => (locale === 'ja' ? ja || en : en || ja) || '';
  const showName = (e: Event) => pick(e.title_en, e.title_ja) || pick(e.venue_en, e.venue_ja);
  const event = events.find(e => e.id === eventId);
  const song = songs.find(x => x.id === songId);
  const newVenue = newShow ? venues.find(v => v.id === newShow.venue) : undefined;

  // Shows: a date in the title suggests them; otherwise search
  const titleDate = dateInTitle(title);
  const shows = useMemo(() => {
    const words = query.trim().split(/\s+/).map(songQuery).filter(Boolean);
    const text = (e: Event) => hira(normalize([e.date, e.date.replace(/-/g, '/'), e.date.replace(/-/g, '.'), e.title_en, e.title_ja, e.venue_en, e.venue_ja, e.city_en, e.city_ja, e.performers].filter(Boolean).join(' ')));
    return [...events]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter(e => words.every(w => text(e).includes(w)));
  }, [events, query]);
  const suggested = titleDate ? events.filter(e => e.date === titleDate || (e.end_date && e.date <= titleDate && titleDate <= e.end_date)) : [];

  const songList = useMemo(() => {
    const q = songQuery(query);
    return songs.filter(x => x.id && (!q || songSearchText(x).includes(q))).sort(compareSongs(locale));
  }, [songs, query, locale]);
  const songSuggestions = useMemo(
    () => songs.filter(x => x.title).sort(compareSongs(locale)).map(x => ({ value: x.title, hint: songAltTitle(x, 'ja') || undefined, keywords: [x.title_en, x.title_kana].filter(Boolean).join(' ') })),
    [songs, locale],
  );

  // The show's setlist, in order (a new show has none)
  const setlist = useMemo(() => (newShow ? [] : setlists
    .filter(r => r.event === eventId && r.song?.trim())
    .sort((a, b) => (a.set === b.set ? a.order - b.order : String(a.set).localeCompare(String(b.set))))), [setlists, eventId, newShow]);
  const hasSetlist = setlist.length > 0;
  const songOf = (name: string) => songs.find(x => normalize(x.title) === normalize(name)) || matchSong(name, songs);
  const chosen = setlist.map((r, i) => ({ r, i })).filter(({ i }) => picked[i]);
  const badTime = hasSetlist
    ? chosen.some(({ i }) => (times[i] || '').trim() && parseTypedTime(times[i]) === null)
    : rows.some(r => r.time.trim() && parseTypedTime(r.time) === null);

  /** A pasted description: fills the times of an existing setlist, or becomes the setlist. */
  function readPaste() {
    const lines = parseTimestamps(paste);
    if (!lines.length) { setPasteNote(s.viPasteNothing); return; }
    if (hasSetlist) {
      const nextPicked = { ...picked }; const nextTimes = { ...times };
      const used = new Set<number>();
      let missed = 0;
      for (const l of lines) {
        const known = matchSong(l.title, songs);
        const key = looseKey(known?.title || l.title);
        const i = setlist.findIndex((r, j) => !used.has(j) && looseKey(songOf(r.song)?.title || r.song) === key);
        if (i < 0) { missed++; continue; }
        used.add(i); nextPicked[i] = true;
        if (l.start !== null) nextTimes[i] = formatTime(l.start);
      }
      setPicked(nextPicked); setTimes(nextTimes);
      setPasteNote(missed ? s.viPasteMissed.replace('{n}', String(missed)) : s.viPasteDone.replace('{n}', String(lines.length)));
    } else {
      setRows(lines.map(l => ({ key: rowKey++, song: matchSong(l.title, songs)?.title || l.title, time: l.start !== null ? formatTime(l.start) : '' })));
      setPasteNote(s.viPasteDone.replace('{n}', String(lines.length)));
    }
    setPasteOpen(false);
  }

  async function save() {
    setSaving(true); setError('');
    try {
      const clean = url.trim();
      if (kind === 'song' && song) {
        const owner = `song:${song.id}`;
        const mine = media.filter(r => r.owner === owner);
        const next: Partial<MediaRow>[] = [...mine, ...(mine.some(r => same(r.url, clean)) ? [] : [{ kind: 'song' as const, url: clean, title: title.trim() }])];
        onSaved(owner, await saveMedia(owner, next), {});
        return;
      }
      // The show: an existing one, or a new one for the archive
      let ev = event;
      let newEvent: Event | undefined;
      if (newShow) {
        const venue = newVenue;
        const area = areas.find(a => a.id === venue?.area);
        const evId = makeId([newShow.date, area?.prefecture || area?.id || ''], new Set(events.map(e => e.id)));
        const t = newShow.title.trim();
        const isJa = /[぀-ヿ一-鿿]/.test(t);
        const fields: Record<string, string> = Object.fromEntries(EVENT_COLUMNS.map(c => [c, '']));
        const fromPaste = rows.some(r => r.song.trim());
        Object.assign(fields, { id: evId, date: newShow.date, venue: newShow.venue, title_en: isJa ? '' : t, title_ja: isJa ? t : '', status: 'published',
          ...(fromPaste ? { setlist_added: todayInJapan(), setlist_source: url.trim() } : {}) });
        await createRow('Events', fields);
        newEvent = {
          id: evId, date: newShow.date, title_en: fields.title_en, title_ja: fields.title_ja, venue_id: newShow.venue,
          venue_en: venue?.name_en || '', venue_ja: venue?.name_ja || '', city_en: area?.name_en || '', city_ja: area?.name_ja || '', status: 'published',
        };
        ev = newEvent;
      }
      if (!ev) return;

      const mine = media.filter(r => r.owner === ev!.id);
      const next: Partial<MediaRow>[] = [...mine];
      if (!mine.some(r => r.kind === 'show' && same(r.url, clean))) next.push({ kind: 'show', url: clean, title: title.trim() });
      const addPart = (songName: string, start: number | null) => {
        if (start === null) return;
        if (!next.some(m => m.kind === 'part' && same(m.url || '', clean) && normalize(m.song || '') === normalize(songName))) {
          next.push({ kind: 'part', url: clean, song: songName, start: String(start) });
        }
      };
      let setlistChanged = false;
      let songsAdded = false;
      if (hasSetlist) {
        // One song alone in a clip starts at 0:00; otherwise the times typed (blank = mark later)
        const linkStart = youTubeStart(clean);
        for (const { r, i } of chosen) {
          const typed = parseTypedTime(times[i] || '');
          addPart(r.song, typed ?? (chosen.length === 1 ? (linkStart ?? 0) : null));
        }
      } else {
        // No setlist yet: the songs listed here become it (new titles go into Songs)
        const filled = rows.filter(r => r.song.trim());
        if (filled.length) {
          const { added, canonical } = await addMissingSongs(filled.map(r => r.song), songs);
          songsAdded = added.length > 0;
          const setRows = filled.map((r, i) => ({ event: ev!.id, song: canonical(r.song), set: '1', order: String(i + 1), notes: '', status: '' }));
          await replaceRows('Setlists', ev.id, setRows);
          setlistChanged = true;
          // An existing show getting its first setlist: note the day, and this video as the source
          if (!newEvent && !ev.setlist_added) {
            await updateRow('Events', ev.id, { ...eventToRow(ev), setlist_added: todayInJapan(), setlist_source: ev.setlist_source || clean });
          }
          for (const r of filled) addPart(canonical(r.song), filled.length === 1 && !r.time.trim() ? 0 : parseTypedTime(r.time));
        }
      }
      onSaved(ev.id, await saveMedia(ev.id, next), { newEvent, setlistChanged, songsAdded });
    } catch (err) {
      setError(errorText(err));
      setSaving(false);
    }
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'link', label: s.viStepLink },
    { key: 'kind', label: s.viStepKind },
    { key: 'pick', label: kind === 'song' ? s.viStepSong : s.viStepShow },
    ...(kind !== 'song' ? [{ key: 'songs' as Step, label: s.viStepSongs }] : []),
  ];
  const at = steps.findIndex(x => x.key === step);
  const back = () => setStep(steps[Math.max(0, at - 1)].key);
  const chooseShow = (eid: string) => { setEventId(eid); setNewShow(null); setPicked({}); setTimes({}); setRows([]); setPasteNote(''); setStep('songs'); };

  const thumb = id && (
    <div className="lu-vi-preview">
      <img src={youTubeThumb(id)} alt="" />
      <div>
        <strong>{title || url.replace(/^https?:\/\/(www\.)?/, '')}</strong>
        {event && !newShow && <span>{event.date} · {showName(event)}</span>}
        {newShow && <span>✦ {s.viNewShowTag} · {newShow.date}{newVenue ? ` · ${pick(newVenue.name_en, newVenue.name_ja)}` : ''}</span>}
        {song && <span>♫ {songTitle(song, locale)}</span>}
      </div>
    </div>
  );
  const pasteBox = (
    <div className="lu-vi-paste">
      <textarea rows={7} value={paste} onChange={e => setPaste(e.target.value)} placeholder={s.viPastePlaceholder} aria-label={s.viPasteLabel} />
      <div className="lu-row">
        <button type="button" className="lu-btn" disabled={!paste.trim()} onClick={readPaste}>{s.viPasteRead}</button>
        {hasSetlist && <button type="button" className="lu-link-btn" onClick={() => setPasteOpen(false)}>{s.cancel}</button>}
      </div>
    </div>
  );
  const newSongs = rows.filter(r => r.song.trim() && !songOf(r.song));

  return (
    <div className="lu-modal-overlay lu-vi-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} className="lu-modal lu-vi" role="dialog" aria-modal="true" aria-labelledby="lu-vi-title">
        <header className="lu-vi-top">
          <ol className="lu-vi-steps">
            {steps.map((x, i) => <li key={x.key} className={i === at ? 'is-on' : i < at ? 'is-past' : ''}><span>{i + 1}</span>{x.label}</li>)}
          </ol>
          <button type="button" className="lu-icon-btn" onClick={onClose} aria-label={s.close}>✕</button>
        </header>

        {step === 'link' && (
          <div className="lu-vi-body">
            <h2 id="lu-vi-title">{s.viLinkTitle}</h2>
            <p className="lu-hint">{s.viLinkHint}</p>
            <input className="lu-vi-input" type="url" inputMode="url" placeholder="https://youtu.be/…" value={url}
              onChange={e => { setUrl(e.target.value); setTitle(''); }} aria-label={s.videoUrl} />
            {url.trim() && !id && <p className="lu-field-error">{s.viNotYouTube}</p>}
            {thumb}
            {id && (
              <label className="lu-field">
                <span>{s.videoTitle}</span>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder={s.videoTitle} />
              </label>
            )}
            {already.length > 0 && <p className="lu-alert lu-filter-banner is-warn">⚠ {s.viAlready}</p>}
          </div>
        )}

        {step === 'kind' && (
          <div className="lu-vi-body">
            <h2 id="lu-vi-title">{s.viKindTitle}</h2>
            {thumb}
            <div className="lu-vi-choices">
              {([['show', '▶', s.viKindShow, s.viKindShowHint], ['song', '♫', s.viKindSong, s.viKindSongHint]] as const).map(([k, icon, label, hint]) => (
                <button key={k} type="button" className={`lu-vi-choice${kind === k ? ' is-on' : ''}`} aria-pressed={kind === k}
                  onClick={() => { setKind(k); setStep('pick'); }}>
                  <span className="lu-vi-choice-icon" aria-hidden="true">{icon}</span>
                  <strong>{label}</strong>
                  <span>{hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'pick' && kind === 'show' && !newShow && (
          <div className="lu-vi-body">
            <h2 id="lu-vi-title">{s.viShowTitle}</h2>
            {suggested.length > 0 && (
              <>
                <p className="lu-publish-label">{s.viSuggested.replace('{date}', titleDate!)}</p>
                <ul className="lu-vi-list">
                  {suggested.map(e => (
                    <li key={e.id}><button type="button" className={eventId === e.id ? 'is-on' : ''} onClick={() => chooseShow(e.id)}>
                      <time>{e.date}</time><span>{showName(e)}</span><em>{pick(e.venue_en, e.venue_ja)}</em>
                    </button></li>
                  ))}
                </ul>
              </>
            )}
            <button type="button" className="lu-vi-new" onClick={() => setNewShow({ date: titleDate || '', venue: '', title: '' })}>
              <strong>+ {s.viNewShow}</strong>
              <span>{titleDate && !suggested.length ? s.viNewShowFromTitle.replace('{date}', titleDate) : s.viNewShowHint}</span>
            </button>
            <input className="lu-vi-input" type="search" placeholder={s.viShowSearch} value={query} onChange={e => setQuery(e.target.value)} aria-label={s.viShowSearch} />
            <ul className="lu-vi-list is-scroll">
              {shows.slice(0, 60).map(e => (
                <li key={e.id}><button type="button" className={eventId === e.id ? 'is-on' : ''} onClick={() => chooseShow(e.id)}>
                  <time>{e.date}</time><span>{showName(e)}</span><em>{pick(e.venue_en, e.venue_ja)}</em>
                </button></li>
              ))}
              {shows.length === 0 && <li className="lu-hint">{s.noResults}</li>}
            </ul>
          </div>
        )}

        {step === 'pick' && kind === 'show' && newShow && (
          <div className="lu-vi-body">
            <h2 id="lu-vi-title">{s.viNewShowTitle}</h2>
            <p className="lu-hint">{s.viNewShowIntro}</p>
            {thumb}
            <label className="lu-field">
              <span>{s.date}</span>
              <input type="date" value={newShow.date} onChange={e => setNewShow(n => n && { ...n, date: e.target.value })} />
            </label>
            {newShow.date && events.some(e => e.date === newShow.date) && (
              <p className="lu-alert lu-filter-banner is-warn">⚠ {s.viNewShowSameDate}</p>
            )}
            <div className="lu-field">
              <span className="lu-field-label">{s.venue}</span>
              <VenuePicker s={s} locale={locale} id="lu-vi-venue" value={newShow.venue}
                onChange={v => setNewShow(n => n && { ...n, venue: v })}
                venues={venues} areas={areas} onCreated={onVenuesChanged} onError={setError} />
            </div>
            <label className="lu-field">
              <span>{s.viNewShowName} <span className="lu-optional">· {s.optional}</span></span>
              <input value={newShow.title} onChange={e => setNewShow(n => n && { ...n, title: e.target.value })} placeholder={s.viNewShowNameHint} />
            </label>
          </div>
        )}

        {step === 'pick' && kind === 'song' && (
          <div className="lu-vi-body">
            <h2 id="lu-vi-title">{s.viSongTitle}</h2>
            <input className="lu-vi-input" type="search" placeholder={s.viSongSearch} value={query} onChange={e => setQuery(e.target.value)} aria-label={s.viSongSearch} />
            <ul className="lu-vi-list is-scroll">
              {songList.slice(0, 80).map(x => (
                <li key={x.id}><button type="button" className={songId === x.id ? 'is-on' : ''} onClick={() => setSongId(x.id)}>
                  <span>{songTitle(x, locale)}</span>{songAltTitle(x, locale) && <em>{songAltTitle(x, locale)}</em>}
                </button></li>
              ))}
              {songList.length === 0 && <li className="lu-hint">{s.noResults}</li>}
            </ul>
          </div>
        )}

        {step === 'songs' && (event || newShow) && (
          <div className="lu-vi-body">
            <h2 id="lu-vi-title">{s.viSongsTitle}</h2>
            {thumb}
            {hasSetlist ? (
              <>
                <p className="lu-hint">{s.viSongsHint}</p>
                <div className="lu-row lu-vi-quick">
                  <button type="button" className="lu-link-btn" onClick={() => setPicked(Object.fromEntries(setlist.map((_, i) => [i, true])))}>{s.viAll}</button>
                  <button type="button" className="lu-link-btn" onClick={() => setPicked({})}>{s.viNone}</button>
                  {!pasteOpen && <button type="button" className="lu-link-btn" onClick={() => setPasteOpen(true)}>📋 {s.viPasteOpen}</button>}
                </div>
                {pasteOpen && pasteBox}
                {pasteNote && <p className="lu-note" role="status">{pasteNote}</p>}
                <ol className="lu-vi-setlist">
                  {setlist.map((r, i) => {
                    const t = times[i] || '';
                    const sec = parseTypedTime(t);
                    const sg = songOf(r.song);
                    return (
                      <li key={i} className={picked[i] ? 'is-on' : ''}>
                        <label>
                          <input type="checkbox" checked={!!picked[i]} onChange={e => setPicked(p => ({ ...p, [i]: e.target.checked }))} />
                          <span>{sg ? songTitle(sg, locale) : r.song}</span>
                        </label>
                        {picked[i] && (
                          <input className={`lu-video-time${t.trim() && sec === null ? ' is-bad' : ''}`} inputMode="decimal"
                            placeholder={chosen.length === 1 ? '0:00' : s.viLater} aria-label={`${r.song}: ${s.videoStart}`}
                            value={t} onChange={e => setTimes(x => ({ ...x, [i]: e.target.value }))}
                            onBlur={() => { if (sec !== null) setTimes(x => ({ ...x, [i]: formatTime(sec) })); }} />
                        )}
                      </li>
                    );
                  })}
                </ol>
                <p className="lu-hint">{chosen.length === 1 ? s.viOneSong : s.viTimesHint}</p>
              </>
            ) : (
              <>
                <p className="lu-hint">{newShow ? s.viBuildNew : s.viBuildEmpty}</p>
                {(rows.length === 0 || pasteOpen) ? pasteBox : (
                  <div className="lu-row lu-vi-quick">
                    <button type="button" className="lu-link-btn" onClick={() => setPasteOpen(true)}>📋 {s.viPasteAgain}</button>
                  </div>
                )}
                {pasteNote && <p className="lu-note" role="status">{pasteNote}</p>}
                {rows.length > 0 && (
                  <ol className="lu-vi-setlist is-build">
                    {rows.map((r, i) => {
                      const sec = parseTypedTime(r.time);
                      const known = songOf(r.song);
                      const set = (patch: Partial<Row>) => setRows(rs => rs.map(x => (x.key === r.key ? { ...x, ...patch } : x)));
                      return (
                        <li key={r.key}>
                          <span className="lu-vi-n">{i + 1}</span>
                          <div className="lu-vi-song">
                            <SuggestInput value={r.song} onChange={v => set({ song: v })} suggestions={songSuggestions} newLabel={s.newSongTitle} aria-label={s.trackTitle} />
                            {r.song.trim() && !known && <span className="lu-tag is-todo">{s.viNewSongTag}</span>}
                          </div>
                          <input className={`lu-video-time${r.time.trim() && sec === null ? ' is-bad' : ''}`} inputMode="decimal" placeholder={s.viLater}
                            aria-label={`${r.song}: ${s.videoStart}`} value={r.time} onChange={e => set({ time: e.target.value })}
                            onBlur={() => { if (sec !== null) set({ time: formatTime(sec) }); }} />
                          <button type="button" className="lu-icon-btn is-danger" aria-label={s.remove} onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}>✕</button>
                        </li>
                      );
                    })}
                  </ol>
                )}
                <div className="lu-row lu-vi-quick">
                  <button type="button" className="lu-link-btn" onClick={() => setRows(rs => [...rs, { key: rowKey++, song: '', time: '' }])}>+ {s.addSong}</button>
                </div>
                {newSongs.length > 0 && <p className="lu-hint">{s.viNewSongsNote.replace('{n}', String(newSongs.length))}</p>}
              </>
            )}
          </div>
        )}

        <footer className="lu-vi-foot">
          {error && <p className="lu-field-error">{s.errorPrefix} {error}</p>}
          {at > 0 && <button type="button" className="lu-btn" onClick={() => (step === 'pick' && newShow ? setNewShow(null) : back())} disabled={saving}>← {s.viBack}</button>}
          <span className="lu-vi-spacer" />
          {step === 'link' && <button type="button" className="lu-btn lu-btn-primary" disabled={!id} onClick={() => setStep('kind')}>{s.viNext} →</button>}
          {step === 'pick' && kind === 'show' && newShow && (
            <button type="button" className="lu-btn lu-btn-primary" disabled={!newShow.date || !newShow.venue}
              onClick={() => { setEventId(''); setRows([]); setPasteNote(''); setStep('songs'); }}>{s.viNext} →</button>
          )}
          {step === 'pick' && kind === 'song' && <button type="button" className="lu-btn lu-btn-primary" disabled={!song || saving} onClick={save}>{saving ? s.saving : s.viSave}</button>}
          {step === 'songs' && <button type="button" className="lu-btn lu-btn-primary" disabled={saving || badTime} onClick={save}>{saving ? s.saving : newShow ? s.viSaveNewShow : s.viSave}</button>}
        </footer>
      </div>
    </div>
  );
}
