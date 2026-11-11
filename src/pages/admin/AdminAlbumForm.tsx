import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAlbums, useTracklists, useAllSongs, useAllSetlists, useAllEvents } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow, replaceRows, getArrangements, type ArrangementRow } from '../../services/adminService';
import SuggestInput, { normalize } from '../../components/admin/SuggestInput';
import { addMissingSongs } from '../../components/admin/songs';
import AddedSongs from '../../components/admin/AddedSongs';
import { keysText } from '../../components/admin/KeysEditor';
import type { Song } from '../../types';
import LinkTextarea from '../../components/admin/LinkTextarea';
import { linkify } from '../../utils/linkify';
import { todayInJapan } from '../../utils/showDates';
import { LISTEN_SERVICES, LISTEN_COLUMNS, serviceOf } from '../../../functions/lib/listen';
import { useFitsViewport } from '../../hooks/useFitsViewport';
import { useAdminT } from '../../i18n/admin';
import {
  Section, Field, FieldGroup, BilingualRow, SaveBar, ImageField, DeleteButton, EditDialog,
  useUnsavedWarning, makeId, errorText,
} from '../../components/admin/ui';

// Same columns as before; the server rewrites whole rows, so all are always sent
const ALBUM_COLUMNS = [
  'id', 'title', 'title_en', 'title_kana', 'date', 'year', 'type', 'number',
  'format', 'label', 'artwork_url', 'listen_url',
  'description_en', 'description_ja',
  ...LISTEN_COLUMNS,
] as const;
type AlbumField = typeof ALBUM_COLUMNS[number];
type Form = Record<AlbumField, string>;
const emptyForm = (): Form => Object.fromEntries(ALBUM_COLUMNS.map(c => [c, ''])) as Form;
const TYPES = ['album', 'lp', 'ep', 'single', 'compilation'];

interface Track { key: string; title: string }
let nextKey = 0;
const track = (title = ''): Track => ({ key: `t${nextKey++}`, title });

/**
 * A release, read first: cover and details on the left, tracklist and notes
 * on the right. Details, notes and cover each have a ✎ that opens a small
 * window; the tracklist is edited in place. A new release is one plain form.
 */
export default function AdminAlbumForm() {
  const { id } = useParams<{ id: string }>();
  const { s, locale, prefix } = useAdminT();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { albums, loading } = useAlbums();
  const { tracklists } = useTracklists();
  const { songs, refresh: refreshSongs } = useAllSongs();
  const { setlists } = useAllSetlists();
  const { events } = useAllEvents();
  const [arr, setArr] = useState<ArrangementRow[]>([]);
  useEffect(() => { if (!isNew) getArrangements().then(setArr).catch(() => {}); }, [isNew]);
  const [addedSongs, setAddedSongs] = useState<Song[]>([]);

  const [form, setForm] = useState<Form>(emptyForm);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [savedTitle, setSavedTitle] = useState(''); // tracklists are keyed by release title
  const [baseline, setBaseline] = useState('');
  const [titleError, setTitleError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<null | 'details' | 'notes' | 'cover'>(null);
  const [tracksEditing, setTracksEditing] = useState(false);
  useEffect(() => { setDialog(null); setTracksEditing(false); }, [id]);
  const panel = useFitsViewport<HTMLElement>(32);

  const songByTitle = useMemo(() => new Map(songs.map(x => [normalize(x.title), x])), [songs]);
  const songSuggestions = useMemo(
    () => songs.map(x => x.title).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ja')).map(value => ({ value })),
    [songs],
  );
  const snapshot = (f: Form, t: Track[]) => JSON.stringify([f, t.map(x => x.title)]);

  useEffect(() => {
    if (isNew) { setBaseline(snapshot(emptyForm(), [])); return; }
    if (loading) return;
    const a = albums.find(x => x.id === id);
    if (!a) return;
    const f: Form = {
      id: a.id, title: a.title || '', title_en: a.title_en || '', title_kana: a.title_kana || '', date: a.date || '', year: a.year || '', type: a.type || '',
      number: a.number || '', format: a.format || '', label: a.label || '', artwork_url: a.coverUrl || '',
      listen_url: a.listenUrl || '', description_en: a.description_en || '', description_ja: a.description_ja || '',
      ...Object.fromEntries(LISTEN_SERVICES.map(x => [x.column, a.listen?.[x.key] || ''])) as Record<typeof LISTEN_COLUMNS[number], string>,
    };
    const t = tracklists.filter(x => x.release === a.title).sort((x, y) => x.track - y.track).map(x => track(x.title));
    setForm(f);
    setTracks(t);
    setSavedTitle(a.title);
    setBaseline(snapshot(f, t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, id, loading, albums, tracklists]);

  const dirty = baseline !== '' && snapshot(form, tracks) !== baseline;
  const leaveGuard = useUnsavedWarning(dirty, saving);
  const set = (k: AlbumField, v: string) => { setForm(f => ({ ...f, [k]: v })); if (k === 'title') setTitleError(''); };
  /** A listen link goes in its service's box, whichever box it was pasted into. */
  const setListen = (k: AlbumField, v: string) => {
    const svc = LISTEN_SERVICES.find(x => x.key === serviceOf(v));
    if (svc && svc.column !== k) {
      setForm(f => ({ ...f, [svc.column]: v.trim() }));
      setMoved(svc.name);
    } else { set(k, v); setMoved(''); }
  };
  const [moved, setMoved] = useState('');
  const [savedForm, savedTracks] = baseline
    ? (JSON.parse(baseline) as [Form, string[]])
    : [form, tracks.map(t => t.title)];

  /** Saves the release and its tracklist; true if it worked. */
  async function save(): Promise<boolean> {
    if (!form.title.trim()) { setTitleError(s.releaseTitleMissing); return false; }
    setSaving(true);
    setError('');
    try {
      const year = form.date ? form.date.slice(0, 4) : form.year;
      const albumId = isNew
        ? makeId([/^[\x20-\x7e]+$/.test(form.title) ? form.title : `${year || 'release'}-${Date.now().toString(36)}`], new Set(albums.map(a => a.id)))
        : form.id;
      const fields = { ...form, id: albumId, year, title: form.title.trim() };
      if (isNew) await createRow('Albums', fields);
      else await updateRow('Albums', albumId, fields);

      // New track titles go into Songs too; matching titles use the song's exact spelling
      const { added, canonical } = await addMissingSongs(tracks.map(t => t.title), songs);
      const cleaned = tracks.filter(t => t.title.trim()).map(t => ({ ...t, title: canonical(t.title) }));

      // Tracklist rows are keyed by the release title: move them if it was renamed
      const rows = cleaned.map((t, i) => ({ release: fields.title, track: String(i + 1), title: t.title }));
      if (savedTitle && savedTitle !== fields.title) await replaceRows('Tracklists', savedTitle, []);
      if (rows.length || savedTitle) await replaceRows('Tracklists', fields.title, rows);

      setForm(fields);
      setSavedTitle(fields.title);
      if (added.length) { setAddedSongs(added); refreshSongs(); }
      setTracks(cleaned);
      setBaseline(snapshot(fields, cleaned));
      setSavedAt(Date.now());
      if (isNew) navigate(`${prefix}/releases/${albumId}`, { replace: true });
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  /** Back to what's saved (closing a window or the tracklist editor). */
  const revert = () => {
    if (baseline) { setForm(savedForm); setTracks(savedTracks.map(t => track(t))); }
    setTitleError('');
    setError('');
  };
  const closeDialog = () => {
    if (dirty && !window.confirm(s.songDiscard)) return;
    revert();
    setDialog(null);
  };
  const saveDialog = () => { save().then(ok => { if (ok) setDialog(null); }); };

  function moveTrack(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= tracks.length) return;
    const copy = [...tracks];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setTracks(copy);
  }

  const typeLabel: Record<string, string> = {
    album: s.typeAlbum, lp: s.typeLp, ep: s.typeEp, single: s.typeSingle, compilation: s.typeCompilation, comp: s.typeCompilation,
  };

  // ---------- The edit fields (new-release form and the windows) ----------
  const detailsFields = (
    <>
      <FieldGroup title={s.relGroupRelease}>
        <Field label={s.releaseTitle} error={titleError} required s={s}>
          {fid => <input id={fid} value={form.title} onChange={e => set('title', e.target.value)} />}
        </Field>
        <div className="lu-grid-2">
          <Field label={s.titleEn} hint={s.relTitleEnHint} s={s}>
            {fid => <input id={fid} lang="en" placeholder={`${s.eg}Fanfare`} value={form.title_en} onChange={e => set('title_en', e.target.value)} />}
          </Field>
          <Field label={s.titleKana} hint={s.titleKanaHint} s={s}>
            {fid => <input id={fid} lang="ja" placeholder={`${s.eg}ふぁんふぁーれ`} value={form.title_kana} onChange={e => set('title_kana', e.target.value)} />}
          </Field>
        </div>
        <div className="lu-grid-2">
          <Field label={s.releaseDate} s={s}>
            {fid => <input id={fid} type="date" value={form.date} onChange={e => set('date', e.target.value)} />}
          </Field>
          <Field label={s.releaseType} s={s}>
            {fid => (
              <select id={fid} value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="">—</option>
                {TYPES.map(t => <option key={t} value={t}>{typeLabel[t]}</option>)}
                {/* Keep a value the sheet has that isn't one of ours ("comp") */}
                {form.type && !TYPES.includes(form.type) && <option value={form.type}>{typeLabel[form.type.toLowerCase()] || form.type}</option>}
              </select>
            )}
          </Field>
        </div>
      </FieldGroup>
      <FieldGroup title={s.relGroupCatalog}>
        <div className="lu-grid-3">
          <Field label={s.label} s={s}>
            {fid => <input id={fid} value={form.label} onChange={e => set('label', e.target.value)} />}
          </Field>
          <Field label={s.catalogNo} s={s}>
            {fid => <input id={fid} placeholder={`${s.eg}TOCT-4169`} value={form.number} onChange={e => set('number', e.target.value)} />}
          </Field>
          <Field label={s.format} s={s}>
            {fid => <input id={fid} value={form.format} placeholder={s.formatPlaceholder} onChange={e => set('format', e.target.value)} />}
          </Field>
        </div>
      </FieldGroup>
      <FieldGroup title={s.relGroupListen}>
        <p className="lu-hint lu-hint-top">{s.relListenHint}</p>
        <div className="lu-listen-fields">
          {LISTEN_SERVICES.map(x => (
            <Field key={x.key} label={x.name} s={s}>
              {fid => <input id={fid} type="url" inputMode="url" placeholder="https://" value={form[x.column]} onChange={e => setListen(x.column, e.target.value)} />}
            </Field>
          ))}
          <Field label={s.relListenAll} hint={s.relListenAllHint} s={s}>
            {fid => <input id={fid} type="url" inputMode="url" placeholder="https://song.link/…" value={form.listen_url} onChange={e => setListen('listen_url', e.target.value)} />}
          </Field>
        </div>
        {moved && <p className="lu-note" role="status">{s.relListenMoved.split('{service}').join(moved)}</p>}
      </FieldGroup>
    </>
  );
  const notesFields = (
    <BilingualRow>
      <Field label={`${s.description} · ${s.english}`} s={s}>
        {fid => <LinkTextarea s={s} id={fid} rows={6} value={form.description_en} onChange={v => set('description_en', v)} />}
      </Field>
      <Field label={`${s.description} · ${s.japanese}`} s={s}>
        {fid => <LinkTextarea s={s} id={fid} rows={6} lang="ja" value={form.description_ja} onChange={v => set('description_ja', v)} />}
      </Field>
    </BilingualRow>
  );
  const tracklistEditor = (
    <div className="lu-setlist">
      <div className="lu-set">
        <ol>
          {tracks.map((t, i) => {
            const song = songByTitle.get(normalize(t.title));
            return (
              <li key={t.key} className="lu-song">
                <SuggestInput
                  wrapClassName="lu-song-title-wrap"
                  className="lu-song-title"
                  value={t.title}
                  placeholder={s.trackTitle}
                  aria-label={s.trackTitle}
                  onChange={v => setTracks(tracks.map(x => (x.key === t.key ? { ...x, title: v } : x)))}
                  suggestions={songSuggestions}
                  newLabel={s.newSongTitle}
                  onEnter={() => {
                    if (t.title.trim()) { const copy = [...tracks]; copy.splice(i + 1, 0, track()); setTracks(copy); }
                  }}
                  autoFocus={i === tracks.length - 1 && !t.title}
                />
                {t.title.trim() && !song && <span className="lu-tag is-muted">{s.songNotListed}</span>}
                <span className="lu-song-actions">
                  <button type="button" className="lu-icon-btn" onClick={() => moveTrack(i, -1)} disabled={i === 0} aria-label={s.moveUp}>↑</button>
                  <button type="button" className="lu-icon-btn" onClick={() => moveTrack(i, 1)} disabled={i === tracks.length - 1} aria-label={s.moveDown}>↓</button>
                  <button type="button" className="lu-icon-btn is-danger" onClick={() => setTracks(tracks.filter(x => x.key !== t.key))} aria-label={s.remove}>✕</button>
                </span>
              </li>
            );
          })}
        </ol>
        <button type="button" className="lu-btn lu-btn-quiet" onClick={() => setTracks([...tracks, track()])}>+ {s.addTrack}</button>
      </div>
      <p className="lu-hint">{s.tracklistHint}</p>
    </div>
  );

  // Live history of each song: number of shows and the last one that's over
  const plays = useMemo(() => {
    const today = todayInJapan();
    const dateOf = new Map(events.map(e => [e.id, e.end_date || e.date]));
    const by = new Map<string, { shows: Set<string>; last: string }>();
    for (const r of setlists) {
      const d = dateOf.get(r.event) || '';
      if (!d || d > today) continue;
      const k = normalize(r.song || '');
      const cur = by.get(k) || { shows: new Set<string>(), last: '' };
      cur.shows.add(r.event);
      if (d > cur.last) cur.last = d;
      by.set(k, cur);
    }
    return by;
  }, [setlists, events]);

  if (!isNew && loading) return <p className="lu-loading">{s.loading}</p>;

  // ---------- A new release: one plain form ----------
  if (isNew) {
    return (
      <form className="lu-form" onSubmit={e => { e.preventDefault(); save(); }} noValidate>
        {leaveGuard}
        <div className="lu-page-head">
          <div>
            <p className="lu-eyebrow">{s.releasesTitle}</p>
            <h1>{s.newRelease}</h1>
          </div>
        </div>
        <Section title={s.secDetails}>{detailsFields}</Section>
        <Section title={s.secTracklist}>{tracklistEditor}</Section>
        <Section title={s.artwork}><ImageField s={s} value={form.artwork_url} onChange={v => set('artwork_url', v)} onError={setError} /></Section>
        <Section title={s.description}>{notesFields}</Section>
        <AddedSongs s={s} songs={addedSongs} prefix={prefix} onClose={() => setAddedSongs([])} />
        <SaveBar s={s} saving={saving} savedAt={savedAt} error={error} dirty={dirty} backHref={`${prefix}/releases`} />
      </form>
    );
  }

  if (!albums.some(a => a.id === id)) return <p className="lu-empty">{s.noResults}</p>;

  // ---------- The release at a glance ----------
  const sf = savedForm;
  const kind = (sf.type || '').toLowerCase();
  const rows = savedTracks.map((title, i) => {
    const song = songByTitle.get(normalize(title));
    const p = plays.get(normalize(title));
    const keys = song ? arr.filter(a => a.song === song.id && a.kind === 'key') : [];
    return { n: i + 1, title, song, shows: p?.shows.size || 0, last: p?.last || '', key: keysText(keys, locale) };
  });
  const playedCount = rows.filter(r => r.shows > 0).length;
  const totalPlays = rows.reduce((n, r) => n + r.shows, 0);
  const maxShows = Math.max(1, ...rows.map(r => r.shows));
  const editBtn = (which: 'details' | 'notes' | 'cover', label = s.songEdit) => (
    <button type="button" className="lu-icon-btn lu-edit-btn" onClick={() => setDialog(which)} aria-label={label} title={label}>✎</button>
  );
  const hasNotes = !!(sf.description_en || sf.description_ja);
  const hasListen = !!sf.listen_url || LISTEN_SERVICES.some(x => sf[x.column]);

  return (
    <div className="lu-song-page lu-rel-page">
      {leaveGuard}
      <div className="lu-song-layout">
        <aside ref={panel.ref} className={`lu-song-side${panel.fits ? ' is-sticky' : ''}`} style={{ top: panel.top }}>
          <div className="lu-song-card">
            <div className="lu-song-card-head">
              <p className="lu-eyebrow"><Link to={`${prefix}/releases`}>← {s.releasesTitle}</Link></p>
              {editBtn('details')}
            </div>
            <div className="lu-rel-art">
              {sf.artwork_url
                ? <img src={sf.artwork_url} alt={sf.title} />
                : <button type="button" className="lu-rel-art-empty" onClick={() => setDialog('cover')}>+ {s.relCoverAdd}</button>}
              {sf.artwork_url && <span className="lu-rel-art-edit">{editBtn('cover', s.relCoverChange)}</span>}
            </div>
            <div>
              <h1>{sf.title}</h1>
              {(sf.title_en && sf.title_en !== sf.title || sf.title_kana) && (
                <p className="lu-song-alt lu-rel-alt">
                  {sf.title_en && sf.title_en !== sf.title && <span lang="en">{sf.title_en}</span>}
                  {sf.title_kana && <span lang="ja">{sf.title_kana}</span>}
                </p>
              )}
              <p className="lu-rel-meta">
                {kind && <span className={`lu-rel-type is-${kind}`}>{typeLabel[kind] || sf.type}</span>}
                {(sf.date || sf.year) && <time>{sf.date || sf.year}</time>}
              </p>
            </div>
            <dl className="lu-song-credits">
              {sf.label && (<><dt>{s.label}</dt><dd>{sf.label}</dd></>)}
              {sf.number && (<><dt>{s.catalogNo}</dt><dd className="lu-rel-mono">{sf.number}</dd></>)}
              {sf.format && (<><dt>{s.format}</dt><dd>{sf.format}</dd></>)}
            </dl>
            <ul className="lu-song-stats" aria-label={s.songStats}>
              <li><a className="lu-stat" href="#tracklist"><strong>{rows.length}</strong><span>{s.relStatTracks}</span></a></li>
              <li><span className="lu-stat"><strong>{rows.length ? `${playedCount}/${rows.length}` : '—'}</strong><span>{s.relColLive}</span></span></li>
              <li><span className="lu-stat"><strong>{totalPlays}</strong><span>{s.relStatPlays}</span></span></li>
            </ul>
            {hasListen && (
              <div className="lu-rel-listen-list">
                <p className="lu-publish-label">{s.relListen}</p>
                <ul>
                  {LISTEN_SERVICES.map(x => (
                    <li key={x.key}>
                      {sf[x.column]
                        ? <a className="lu-rel-svc is-on" href={sf[x.column]} target="_blank" rel="noopener noreferrer">{x.name} ↗</a>
                        : <button type="button" className="lu-rel-svc" onClick={() => setDialog('details')} title={s.relListenMissing}>{x.name}</button>}
                    </li>
                  ))}
                  {sf.listen_url && <li><a className="lu-rel-svc is-on" href={sf.listen_url} target="_blank" rel="noopener noreferrer">{s.relListenAll} ↗</a></li>}
                </ul>
              </div>
            )}
            <div className="lu-row lu-rel-links">
              {!hasListen && <button type="button" className="lu-btn lu-btn-quiet" onClick={() => setDialog('details')}>+ {s.listenUrl}</button>}
              <Link to={`/${locale}/releases/${sf.id}`} className="lu-btn lu-btn-quiet">{s.viewOnSite} ↗</Link>
            </div>
          </div>
        </aside>

        <div className="lu-song-main">
          <Section
            title={`${s.secTracklist}${rows.length ? ` · ${rows.length}` : ''}`}
            id="tracklist"
            aside={!tracksEditing && rows.length > 0
              ? <button type="button" className="lu-icon-btn lu-edit-btn" onClick={() => setTracksEditing(true)} aria-label={s.songEdit} title={s.songEdit}>✎</button>
              : undefined}
          >
            {tracksEditing ? (
              <>
                {tracklistEditor}
                <div className="lu-row lu-section-actions">
                  {error && <span className="lu-field-error">{s.errorPrefix} {error}</span>}
                  <button type="button" className="lu-btn" disabled={saving}
                    onClick={() => { if (dirty && !window.confirm(s.songDiscard)) return; revert(); setTracksEditing(false); }}>{s.cancel}</button>
                  <button type="button" className="lu-btn lu-btn-primary" disabled={saving || !dirty}
                    onClick={async () => { if (await save()) setTracksEditing(false); }}>{saving ? s.saving : s.save}</button>
                </div>
              </>
            ) : rows.length === 0 ? (
              <p className="lu-hint">{s.relNoTracksYet} <button type="button" className="lu-link-btn" onClick={() => { setTracks([track()]); setTracksEditing(true); }}>+ {s.addTrack}</button></p>
            ) : (
              <ol className="lu-tracks">
                {rows.map(r => (
                  <li key={r.n} className="lu-track">
                    <span className="lu-track-n">{r.n}</span>
                    <span className="lu-track-main">
                      {r.song ? <Link to={`${prefix}/songs/${r.song.id}`} className="lu-track-title">{r.title}</Link> : <span className="lu-track-title">{r.title}</span>}
                      <span className="lu-track-sub">
                        {r.key && <span className="lu-track-key">{r.key}</span>}
                        {r.shows > 0 ? <span>{s.relTrackLast.replace('{date}', r.last)}</span> : <span className="lu-sg-none">{s.relTrackNever}</span>}
                        {r.song && !r.song.lyrics_doc_id && <span className="lu-tag is-todo">{s.lyricsMissing}</span>}
                        {!r.song && <span className="lu-tag is-muted">{s.songNotListed}</span>}
                      </span>
                    </span>
                    <span className="lu-track-plays" title={s.relTrackPlays.replace('{n}', String(r.shows))}>
                      <span className="lu-rel-bar" style={{ ['--p' as string]: `${(r.shows / maxShows) * 100}%` }} />
                      <span className="lu-track-count">{r.shows}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <AddedSongs s={s} songs={addedSongs} prefix={prefix} onClose={() => setAddedSongs([])} />
          </Section>

          <Section title={s.description} aside={editBtn('notes')}>
            {!hasNotes ? (
              <p className="lu-hint">{s.relNoNotesYet} <button type="button" className="lu-link-btn" onClick={() => setDialog('notes')}>{s.songEdit}</button></p>
            ) : (
              <div className="lu-rel-notes">
                {([['ja', sf.description_ja, s.japanese], ['en', sf.description_en, s.english]] as const).map(([lang, text, label]) => (
                  <div key={lang} className="lu-rel-note">
                    <p className="lu-publish-label">{label}</p>
                    {text ? <p lang={lang} className="lu-rel-note-text">{linkify(text, lang)}</p> : <p className="lu-hint">{s.relNoTranslation}</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      <EditDialog s={s} title={s.secDetails} open={dialog === 'details'} onClose={closeDialog} onSave={saveDialog} saving={saving} error={error} dirty={dirty}
        footer={<DeleteButton s={s} onConfirm={async () => {
          try {
            if (savedTitle) await replaceRows('Tracklists', savedTitle, []);
            await deleteRow('Albums', form.id);
            navigate(`${prefix}/releases`);
          } catch (err) { setError(errorText(err)); }
        }} />}
      >
        {detailsFields}
      </EditDialog>
      <EditDialog s={s} title={s.description} open={dialog === 'notes'} onClose={closeDialog} onSave={saveDialog} saving={saving} error={error} dirty={dirty}>
        {notesFields}
      </EditDialog>
      <EditDialog s={s} title={s.artwork} open={dialog === 'cover'} onClose={closeDialog} onSave={saveDialog} saving={saving} error={error} dirty={dirty}>
        <ImageField s={s} value={form.artwork_url} onChange={v => set('artwork_url', v)} onError={setError} />
      </EditDialog>
    </div>
  );
}
