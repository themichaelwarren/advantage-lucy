import Icon from '../../components/admin/Icon';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom';
import { useAllSongs, usePeople, useAllSetlists, useAllEvents, useAllTracklists, useAllAlbums } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow, getMedia, getArrangements, saveArrangements, type MediaRow, type ArrangementRow } from '../../services/adminService';
import KeysEditor, { toDrafts, fromDrafts, keysText, type KeyDraft } from '../../components/admin/KeysEditor';
import SongVideos from '../../components/admin/SongVideos';
import { normalize } from '../../components/admin/SuggestInput';
import { retitleEverywhere } from '../../components/admin/songs';
import { createDriveDoc } from '../../services/driveService';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminT } from '../../i18n/admin';
import { Section, Field, FieldGroup, SaveBar, DeleteButton, EditDialog, LockHint, VisToggle, useUnsavedWarning, makeId, errorText } from '../../components/admin/ui';
import { getAdminToken } from '../../services/adminToken';
import { useFitsViewport } from '../../hooks/useFitsViewport';
import { todayInJapan } from '../../utils/showDates';
import { localTitle } from '../../utils/songTitles';
import PeoplePicker from '../../components/admin/PeoplePicker';
import { ActivityHistory } from '../../components/admin/Activity';
import ItemLinks from '../../components/admin/ItemLinks';
import BandNotes from '../../components/admin/BandNotes';
import LinkTextarea from '../../components/admin/LinkTextarea';
import { linkify } from '../../utils/linkify';
import AddressDialog, { movedTo } from '../../components/admin/AddressDialog';

// Same columns as before; the server rewrites whole rows, so all are always sent
const SONG_COLUMNS = ['id', 'title', 'lyrics_by', 'music_by', 'lyrics_doc_id', 'original_artist', 'title_en', 'title_kana', 'status', 'lyrics_status', 'about_en', 'about_ja'] as const;
type SongField = typeof SONG_COLUMNS[number];
type Form = Record<SongField, string>;
const emptyForm = (): Form => Object.fromEntries(SONG_COLUMNS.map(c => [c, ''])) as Form;

/** Accept a full Google Docs link or a bare doc ID. */
function docIdFrom(input: string): string {
  return input.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? input.trim();
}

export default function AdminSongForm() {
  const { id } = useParams<{ id: string }>();
  const { s, locale, prefix } = useAdminT();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const [addrOpen, setAddrOpen] = useState(false);
  const { songs, loading } = useAllSongs();
  const { people } = usePeople();
  const { accessToken } = useAuth();
  const { setlists, refresh: refreshSetlists } = useAllSetlists();
  const { events } = useAllEvents();
  const { tracklists, refresh: refreshTracklists } = useAllTracklists();
  const { albums } = useAllAlbums();

  const [form, setForm] = useState<Form>(emptyForm);
  const [baseline, setBaseline] = useState('');
  const [titleError, setTitleError] = useState('');
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  // Read first: each section has its own ✎ that opens a small edit window
  // (a new song opens as the full form instead)
  const [dialog, setDialog] = useState<null | 'details' | 'lyrics' | 'keys' | 'about'>(null);
  const panel = useFitsViewport<HTMLElement>(32);
  useEffect(() => { setDialog(null); }, [id]);
  const closeDialog = () => {
    if (dirty && !window.confirm(s.songDiscard)) return;
    if (baseline) setForm(JSON.parse(baseline) as Form);
    setTitleError('');
    setError('');
    setDialog(null);
  };
  const saveDialog = () => { save(form).then(ok => { if (ok) setDialog(null); }); };
  // The lyrics themselves, from the Google Doc (read mode)
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [historyAll, setHistoryAll] = useState(false);
  const docId = baseline ? (JSON.parse(baseline) as Form).lyrics_doc_id : '';
  useEffect(() => {
    setLyrics(null);
    if (!docId) return;
    const token = getAdminToken();
    fetch(`/api/docs/${docId}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined).then(r => r.json()).then(d => setLyrics(String(d.text || '').trim())).catch(() => setLyrics(''));
  }, [docId]);
  // Keys (admin only, private Arrangements tab): edited in their own window
  const [arrangements, setArrangements] = useState<ArrangementRow[] | null>(null);
  useEffect(() => { if (!isNew) getArrangements().then(setArrangements).catch(() => setArrangements([])); }, [isNew]);
  const songKeys = (arrangements || []).filter(r => r.song === id && r.kind === 'key');
  const [keyDraft, setKeyDraft] = useState<KeyDraft[]>([]);
  const [keysSaving, setKeysSaving] = useState(false);
  const [keysError, setKeysError] = useState('');
  const openKeys = () => { setKeyDraft(toDrafts(songKeys)); setKeysError(''); setDialog('keys'); };
  const keysDirty = dialog === 'keys' && JSON.stringify(fromDrafts(keyDraft)) !== JSON.stringify(songKeys.map(r => ({ kind: 'key', value: r.value, label: r.label })));
  async function saveKeys() {
    if (!id) return;
    setKeysSaving(true);
    setKeysError('');
    try {
      const others = (arrangements || []).filter(r => r.song === id && r.kind !== 'key');
      const saved = await saveArrangements(id, [...others, ...fromDrafts(keyDraft)]);
      setArrangements(a => [...(a || []).filter(r => r.song !== id), ...saved]);
      setDialog(null);
    } catch (err) {
      setKeysError(errorText(err));
    } finally {
      setKeysSaving(false);
    }
  }
  // Videos (admin only, private Media tab)
  const [media, setMedia] = useState<MediaRow[] | null>(null);
  useEffect(() => { if (!isNew) getMedia().then(setMedia).catch(() => setMedia([])); }, [isNew]);

  useEffect(() => {
    if (isNew) { setBaseline(JSON.stringify(emptyForm())); return; }
    if (loading) return;
    const song = songs.find(x => x.id === id);
    if (!song) return;
    const f: Form = {
      id: song.id, title: song.title || '', lyrics_by: song.lyrics_by || '',
      music_by: song.music_by || '', lyrics_doc_id: song.lyrics_doc_id || '',
      original_artist: song.original_artist || '',
      title_en: song.title_en || '', title_kana: song.title_kana || '', status: song.status || '', lyrics_status: song.lyrics_status || '',
      about_en: song.about_en || '', about_ja: song.about_ja || '',
    };
    setForm(f);
    setBaseline(JSON.stringify(f));
  }, [isNew, id, loading, songs]);

  const dirty = baseline !== '' && JSON.stringify(form) !== baseline;
  const leaveGuard = useUnsavedWarning(dirty, saving);
  const set = (k: SongField, v: string) => { setForm(f => ({ ...f, [k]: v })); if (k === 'title') setTitleError(''); };

  // Where this song appears, matched by its saved title like the public site
  const savedTitle = baseline ? (JSON.parse(baseline) as Form).title : '';
  const usage = useMemo(() => {
    const key = normalize(savedTitle);
    if (!key) return { shows: [], releases: [] };
    const eventById = new Map(events.map(e => [e.id, e]));
    const shows = setlists
      .filter(r => normalize(r.song || '') === key)
      .map(r => ({ row: r, event: eventById.get(r.event) }))
      .sort((a, b) => (b.event?.date || '').localeCompare(a.event?.date || ''));
    const albumByTitle = new Map(albums.map(a => [a.title, a]));
    const releases = tracklists
      .filter(t => normalize(t.title || '') === key)
      .map(t => ({ track: t, album: albumByTitle.get(t.release) }))
      .sort((a, b) => (b.album?.date || b.album?.year || '').localeCompare(a.album?.date || a.album?.year || ''));
    return { shows, releases };
  }, [savedTitle, setlists, events, tracklists, albums]);
  const showCount = new Set(usage.shows.map(x => x.row.event)).size;
  const releaseCount = new Set(usage.releases.map(x => x.track.release)).size;
  const renaming = !isNew && !!savedTitle && form.title.trim() !== '' && form.title.trim() !== savedTitle;
  const setLabel = (set: string) => set === 'e' ? s.encore : set.startsWith('e') ? `${s.encore} ${set.slice(1)}` : `${s.set} ${set}`;

  async function save(next: Form): Promise<Form | null> {
    if (!next.title.trim()) { setTitleError(s.songTitleMissing); return null; }
    setSaving(true);
    setError('');
    try {
      const songId = isNew && !next.id
        ? makeId([/^[\x20-\x7e]+$/.test(next.title) ? next.title : `song-${Date.now().toString(36)}`], new Set(songs.map(x => x.id)))
        : next.id;
      const fields = { ...next, id: songId };
      if (isNew && !next.id) await createRow('Songs', fields);
      else await updateRow('Songs', songId, fields);

      // Setlists and tracklists refer to songs by title: carry a rename over
      if (renaming) {
        const changed = await retitleEverywhere(savedTitle, fields.title, setlists, tracklists);
        if (changed.shows) refreshSetlists();
        if (changed.releases) refreshTracklists();
      }
      setForm(fields);
      setBaseline(JSON.stringify(fields));
      setSavedAt(Date.now());
      if (isNew) navigate(`${prefix}/songs/${songId}`, { replace: true });
      return fields;
    } catch (err) {
      setError(errorText(err));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function createDoc() {
    if (!form.title.trim()) { setTitleError(s.lyricsDocNeedsTitle); return; }
    if (!accessToken) { setError(s.lyricsDocNeedsSignIn); return; }
    setCreatingDoc(true);
    setError('');
    try {
      const docId = await createDriveDoc(form.title, import.meta.env.VITE_LYRICS_FOLDER_ID, accessToken);
      // Save straight away so the new doc is never left unlinked
      await save({ ...form, lyrics_doc_id: docId });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setCreatingDoc(false);
    }
  }

  // An old address (before the id changed) forwards to the new one
  const moved = movedTo(songs, isNew ? undefined : id);
  if (moved) return <Navigate to={`${prefix}/songs/${moved}`} replace />;
  if (!isNew && loading) return <p className="lu-loading">{s.loading}</p>;

  const personName = (pid: string) => {
    const p = people.find(x => x.id === pid.trim());
    if (!p) return pid;
    return locale === 'ja'
      ? [p.name_family_ja, p.name_given_ja].filter(Boolean).join(' ') || [p.name_given_en, p.name_family_en].filter(Boolean).join(' ')
      : [p.name_given_en, p.name_family_en].filter(Boolean).join(' ') || [p.name_family_ja, p.name_given_ja].filter(Boolean).join(' ');
  };
  const names = (ids: string) => ids.split(',').filter(x => x.trim()).map(pid => (
    <Link key={pid} to={`${prefix}/people/${pid.trim()}`}>{personName(pid)}</Link>
  )).flatMap((el, i) => (i ? [<span key={`sep${i}`}>、</span>, el] : [el]));

  // The edit fields, used by the new-song form and the edit windows
  const detailsFields = (
    <>
      <FieldGroup title={s.groupTitles}>
        <Field label={s.songTitle} error={titleError} required s={s}>
          {fid => <input id={fid} value={form.title} onChange={e => set('title', e.target.value)} />}
        </Field>
        {renaming && (showCount > 0 || releaseCount > 0) && (
          <p className="lu-note">{s.renameCascade.replace('{shows}', String(showCount)).replace('{releases}', String(releaseCount))}</p>
        )}
        <div className="lu-grid-2">
          <Field label={s.titleEn} hint={s.titleEnHint} s={s}>
            {fid => <input id={fid} lang="en" placeholder={`${s.eg}Kaze ni Azukete`} value={form.title_en} onChange={e => set('title_en', e.target.value)} />}
          </Field>
          <Field label={s.titleKana} hint={s.titleKanaHint} s={s}>
            {fid => <input id={fid} lang="ja" placeholder={`${s.eg}かぜにあずけて`} value={form.title_kana} onChange={e => set('title_kana', e.target.value)} />}
          </Field>
        </div>
      </FieldGroup>
      <FieldGroup title={s.groupCredits}>
        <div className="lu-grid-2">
          <Field label={s.musicBy} s={s}>
            {fid => <PeoplePicker s={s} locale={locale} id={fid} value={form.music_by} onChange={v => set('music_by', v)} people={people} personHref={pid => `${prefix}/people/${pid}`} />}
          </Field>
          <Field label={s.lyricsBy} s={s}>
            {fid => <PeoplePicker s={s} locale={locale} id={fid} value={form.lyrics_by} onChange={v => set('lyrics_by', v)} people={people} personHref={pid => `${prefix}/people/${pid}`} />}
          </Field>
        </div>
      </FieldGroup>
      <FieldGroup title={s.groupCover}>
        <Field label={s.originalArtist} hint={s.originalArtistHint} s={s}>
          {fid => <input id={fid} placeholder={`${s.eg}The Smiths`} value={form.original_artist} onChange={e => set('original_artist', e.target.value)} />}
        </Field>
      </FieldGroup>
    </>
  );
  const lyricsFields = (
    <>
      <Field label={s.lyricsDoc} hint={s.lyricsDocHint} optional s={s}>
        {fid => (
          <input
            id={fid}
            placeholder="https://docs.google.com/document/d/…"
            value={form.lyrics_doc_id ? `https://docs.google.com/document/d/${form.lyrics_doc_id}/edit` : ''}
            onChange={e => set('lyrics_doc_id', docIdFrom(e.target.value))}
          />
        )}
      </Field>
      {!form.lyrics_doc_id && (
        <div className="lu-row">
          <button type="button" className="lu-btn" onClick={createDoc} disabled={creatingDoc || saving}>
            {creatingDoc ? s.lyricsDocCreating : `+ ${s.lyricsDocCreate}`}
          </button>
        </div>
      )}
    </>
  );

  // ---------- A new song: the plain form ----------
  if (isNew) {
    return (
      <form className="lu-form" onSubmit={e => { e.preventDefault(); save(form); }} noValidate>
        {leaveGuard}
        <div className="lu-page-head">
          <div>
            <p className="lu-eyebrow">{s.songsTitle}</p>
            <h1>{s.newSongItem}</h1>
          </div>
        </div>
        <Section title={s.secDetails}>{detailsFields}</Section>
        <Section title={s.secLyrics}>{lyricsFields}</Section>
        <SaveBar s={s} saving={saving} savedAt={savedAt} error={error} dirty={dirty} backHref={`${prefix}/songs`} />
      </form>
    );
  }

  // ---------- The song at a glance ----------
  // Shows that are over (a setlist can be entered before the show)
  const today = todayInJapan();
  const showDates = usage.shows.map(x => x.event?.end_date || x.event?.date).filter(d => d && d <= today) as string[];
  const first = showDates.length ? showDates[showDates.length - 1] : '';
  const last = showDates[0] || '';
  const videoCount = media ? media.filter(r => (r.kind === 'part' && normalize(r.song) === normalize(savedTitle)) || r.owner === `song:${form.id}`).length : 0;
  // The 10 most recent at first; the rest on request
  const HISTORY_SHOWN = 10;
  const shownShows = historyAll ? usage.shows : usage.shows.slice(0, HISTORY_SHOWN);
  const byYear: [string, typeof usage.shows][] = [];
  for (const x of shownShows) {
    const y = (x.event?.date || '').slice(0, 4) || '—';
    const g = byYear[byYear.length - 1];
    if (g && g[0] === y) g[1].push(x); else byYear.push([y, [x]]);
  }
  const saved = baseline ? (JSON.parse(baseline) as Form) : form;
  // What the site shows, flipped right where it is (saved at once)
  const pagePublic = saved.status !== 'private';
  const lyricsPublic = saved.lyrics_status !== 'private';
  const visToggle = (on: boolean, onLabel: string, offLabel: string, tip: string, flip: () => void, off?: string) => (
    <VisToggle on={on} onLabel={onLabel} offLabel={offLabel} tip={tip} onFlip={flip} busy={saving} none={off} noneTip={s.visLyricsNoneTip} />
  );
  // No lyrics doc, or a doc with nothing in it: nothing to show or hide yet
  const lyricsEmpty = !!saved.lyrics_doc_id && lyrics !== null && !lyrics.replace(/\s/g, '');
  const noLyrics = !saved.lyrics_doc_id || lyricsEmpty;
  const editBtn = (which: 'details' | 'lyrics' | 'about') => (
    <button type="button" className="lu-icon-btn lu-edit-btn" onClick={() => setDialog(which)} aria-label={s.songEdit} title={s.songEdit}><Icon name="edit" /></button>
  );

  return (
    <div className="lu-song-page lu-song-only">
      {leaveGuard}
      <div className="lu-song-layout">
        {/* Left: what the song is, its releases and videos (stays in view while it fits) */}
        <aside ref={panel.ref} className={`lu-song-side${panel.fits ? ' is-sticky' : ''}`} style={{ top: panel.top }}>
          <div className="lu-song-card">
            <div className="lu-song-card-head">
              <p className="lu-eyebrow"><Link to={`${prefix}/songs`}>← {s.songsTitle}</Link></p>
              <span className="lu-row lu-card-tools">
                {visToggle(pagePublic, s.visPageShort, s.songDraft, s.visPageTip, () => save({ ...saved, status: pagePublic ? 'private' : '' }))}
                {editBtn('details')}
              </span>
            </div>
            <h1>{saved.title}</h1>
            {(saved.title_en && saved.title_en !== saved.title || saved.title_kana) && (
              <p className="lu-song-alt">
                {saved.title_en && saved.title_en !== saved.title && <span lang="en">{saved.title_en}</span>}
                {saved.title_kana && <span lang="ja">{saved.title_kana}</span>}
              </p>
            )}
            {!pagePublic && <p className="lu-song-draft"><span className="lu-tag is-muted"><Icon name="lock" /> {s.songDraft}</span><span className="lu-hint">{s.visPageOff}</span></p>}
            <dl className="lu-song-credits">
              {saved.original_artist && (<><dt>{s.coverTag}</dt><dd>{saved.original_artist}</dd></>)}
              {saved.music_by && (<><dt>{s.musicBy}</dt><dd>{names(saved.music_by)}</dd></>)}
              {saved.lyrics_by && (<><dt>{s.lyricsBy}</dt><dd>{names(saved.lyrics_by)}</dd></>)}
              <dt>{s.songKey}</dt>
              <dd>
                <button type="button" className="lu-link-btn lu-key-link" onClick={openKeys} disabled={!arrangements}>
                  {songKeys.length ? keysText(songKeys, locale) : `+ ${s.keyAdd}`}
                </button>
              </dd>
            </dl>
            {!saved.music_by && !saved.lyrics_by && !saved.original_artist && (
              <p className="lu-hint">{s.songNoCreditsYet} <button type="button" className="lu-link-btn" onClick={() => setDialog('details')}>{s.songEdit}</button></p>
            )}
            <ul className="lu-song-stats" aria-label={s.songStats}>
              <li><span className="lu-stat"><strong>{showCount}</strong><span>{s.songStatLive}</span></span></li>
              <li><a className="lu-stat" href="#videos"><strong>{videoCount}</strong><span>{s.songVideos}</span></a></li>
              <li><span className="lu-stat"><strong>{releaseCount}</strong><span>{s.songOnReleases}</span></span></li>
              {first && (
                <li className="is-wide"><span className="lu-stat">
                  <strong>{first}{last && last !== first ? ` – ${last}` : ''}</strong>
                  <span>{s.songStatFirst}{last && last !== first ? ` – ${s.songStatLast}` : ''}</span>
                </span></li>
              )}
            </ul>
            {saved.status !== 'private' && <Link to={`/${locale}/songs/${form.id}`} className="lu-btn lu-btn-quiet lu-song-site">{s.viewOnSite} ↗</Link>}
          </div>

          {usage.releases.length > 0 && (
            <div className="lu-song-card">
              <p className="lu-publish-label">{s.songOnReleases}</p>
              <ul className="lu-list lu-usage lu-compact">
                {usage.releases.map(({ track, album }) => (
                  <li key={`${track.release}-${track.track}`}>
                    {album ? (
                      <Link to={`${prefix}/releases/${album.id}`} className="lu-list-row">
                        {album.coverUrl ? <img className="lu-thumb" src={album.coverUrl} alt="" loading="lazy" /> : <span className="lu-thumb" />}
                        <span className="lu-list-main">
                          <strong>{localTitle(album, locale)}</strong>
                          <span>{[(album.date || album.year || '').slice(0, 4), s.trackN.replace('{n}', String(track.track))].filter(Boolean).join(' · ')}</span>
                        </span>
                      </Link>
                    ) : (
                      <span className="lu-list-row"><span className="lu-list-main"><strong>{track.release}</strong></span></span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {media && savedTitle && (
            <Section title={s.songVideos} id="videos" badge={<LockHint text={s.videosPrivate} />}>
              <SongVideos
                s={s} locale={locale} prefix={prefix}
                songId={form.id} title={savedTitle} media={media} events={events}
                played={[...new Set(usage.shows.map(x => x.row.event))]}
                onSaved={(owner, rows) => setMedia(m => [...(m || []).filter(r => r.owner !== owner), ...rows])}
              />
            </Section>
          )}
        </aside>

        {/* Right: lyrics and live history */}
        <div className="lu-song-main">
          <Section
            title={s.secLyrics}
            aside={<span className="lu-row">
              {visToggle(lyricsPublic, s.visLyricsShort, s.visLyricsHiddenShort, s.visLyricsTip, () => save({ ...saved, lyrics_status: lyricsPublic ? 'private' : '' }), noLyrics ? s.visLyricsNone : undefined)}
              {/* The doc itself, as a small button beside ✎ */}
              {saved.lyrics_doc_id && (
                <a className="lu-icon-btn lu-edit-btn" href={`https://docs.google.com/document/d/${saved.lyrics_doc_id}/edit`} target="_blank" rel="noopener noreferrer"
                  aria-label={s.lyricsDocOpen} title={s.lyricsDocOpen}><Icon name="doc" /></a>
              )}
              {editBtn('lyrics')}
            </span>}
          >
            {!saved.lyrics_doc_id ? (
              <p className="lu-hint">{s.songNoLyrics} <button type="button" className="lu-link-btn" onClick={() => setDialog('lyrics')}>{s.songEdit}</button></p>
            ) : lyrics === null ? (
              <p className="lu-hint">{s.loading}</p>
            ) : lyricsEmpty ? (
              <p className="lu-hint">{s.lyricsDocEmpty}</p>
            ) : (
              <>
                {!lyricsPublic && <p className="lu-hint lu-lyrics-hidden"><Icon name="lock" /> {s.visLyricsOff}</p>}
                <div className={`lu-lyrics${lyricsOpen ? ' is-open' : ''}`}>{lyrics || '—'}</div>
                {lyrics.split('\n').length > 10 && (
                  <button type="button" className="lu-link-btn" onClick={() => setLyricsOpen(o => !o)}>
                    {lyricsOpen ? s.lyricsLess : s.lyricsAll}
                  </button>
                )}
              </>
            )}
          </Section>

          <Section title={`${s.songPlayedAt} · ${showCount}`}>
            {usage.shows.length === 0 ? <p className="lu-hint">{s.songNotPlayed}</p> : (
              <div className="lu-song-history">
                {byYear.map(([year, list]) => (
                  <div key={year} className="lu-song-year">
                    <h3>{year}</h3>
                    <ul className="lu-list lu-usage lu-compact">
                      {list.map(({ row, event }) => {
                        const name = event ? (locale === 'ja' ? event.title_ja || event.venue_ja || event.title_en || event.venue_en : event.title_en || event.venue_en || event.title_ja || event.venue_ja) : row.event;
                        return (
                          <li key={`${row.event}-${row.set}-${row.order}`}>
                            <Link to={`${prefix}/events/${row.event}`} className="lu-list-row">
                              <time>{event?.date?.slice(5).replace('-', '/') || '—'}</time>
                              <span className="lu-list-main">
                                <strong>{name}</strong>
                                <span>{setLabel(row.set)} · #{row.order}</span>
                              </span>
                              <span className="lu-list-tags">
                                {row.notes && <span className="lu-tag" title={row.notes}>{row.notes}</span>}
                                {row.status === 'private' && <span className="lu-tag is-muted">{s.hidden}</span>}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                {usage.shows.length > HISTORY_SHOWN && (
                  <button type="button" className="lu-link-btn" onClick={() => setHistoryAll(v => !v)}>
                    {historyAll ? s.lyricsLess : s.historyAll.replace('{n}', String(usage.shows.length))}
                  </button>
                )}
              </div>
            )}
          </Section>
          <Section title={s.songAboutTitle} aside={editBtn('about')}>
            {!saved.about_ja && !saved.about_en ? (
              <p className="lu-hint">{s.songAboutNone} <button type="button" className="lu-link-btn" onClick={() => setDialog('about')}>{s.songEdit}</button></p>
            ) : (
              <div className="lu-rel-notes is-stacked">
                {([['ja', saved.about_ja, s.japanese], ['en', saved.about_en, s.english]] as const).map(([lang, text, label]) => (
                  <div key={lang} className="lu-rel-note">
                    <p className="lu-publish-label">{label}</p>
                    {text ? <p lang={lang} className="lu-rel-note-text">{linkify(text, lang)}</p> : <p className="lu-hint">{s.relNoTranslation}</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>
          <ItemLinks s={s} owner={`song:${id}`} />
          <BandNotes s={s} locale={locale} owner={`song:${id}`} />
          <div className="lu-history-wrap"><ActivityHistory s={s} locale={locale} refs={[`Songs:${id}`]} /></div>
        </div>
      </div>

      <AddressDialog s={s} kind="song" id={form.id} open={addrOpen} onClose={() => setAddrOpen(false)} />
      <EditDialog s={s} title={s.secDetails} open={dialog === 'details'} onClose={closeDialog} onSave={saveDialog} saving={saving} error={error} dirty={dirty}
        footer={<span className="lu-row">
          <button type="button" className="lu-btn" onClick={() => { closeDialog(); setAddrOpen(true); }}>{s.addrButton}</button>
          <DeleteButton s={s} onConfirm={async () => {
          try { await deleteRow('Songs', form.id); navigate(`${prefix}/songs`); }
          catch (err) { setError(errorText(err)); }
        }} />
        </span>}
      >
        {detailsFields}
      </EditDialog>
      <EditDialog s={s} title={s.songKey} open={dialog === 'keys'} saving={keysSaving} error={keysError} onSave={saveKeys} dirty={keysDirty}
        onClose={() => { if (keysDirty && !window.confirm(s.songDiscard)) return; setDialog(null); }}>
        <KeysEditor s={s} keys={keyDraft} onChange={setKeyDraft} />
      </EditDialog>
      <EditDialog s={s} title={s.secLyrics} open={dialog === 'lyrics'} onClose={closeDialog} onSave={saveDialog} saving={saving} error={error} dirty={dirty}>
        {lyricsFields}
      </EditDialog>
      <EditDialog s={s} title={s.songAboutTitle} open={dialog === 'about'} onClose={closeDialog} onSave={saveDialog} saving={saving} error={error} dirty={dirty}>
        <p className="lu-hint">{s.bothLanguagesHint}</p>
        <Field label={`${s.songAboutTitle} · ${s.japanese}`} optional s={s}>
          {fid => <LinkTextarea s={s} id={fid} className="lu-textarea-long" rows={8} lang="ja" value={form.about_ja} onChange={v => set('about_ja', v)} />}
        </Field>
        <Field label={`${s.songAboutTitle} · ${s.english}`} optional s={s}>
          {fid => <LinkTextarea s={s} id={fid} className="lu-textarea-long" rows={8} value={form.about_en} onChange={v => set('about_en', v)} />}
        </Field>
      </EditDialog>
    </div>
  );
}
