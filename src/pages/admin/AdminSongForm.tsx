import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSongs, usePeople, useAllSetlists, useAllEvents, useTracklists, useAlbums } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
import { normalize } from '../../components/admin/SuggestInput';
import { retitleEverywhere } from '../../components/admin/songs';
import { createDriveDoc } from '../../services/driveService';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminT } from '../../i18n/admin';
import { Section, Field, SaveBar, DeleteButton, useUnsavedWarning, makeId, errorText } from '../../components/admin/ui';
import PeoplePicker from '../../components/admin/PeoplePicker';

// Same columns as before; the server rewrites whole rows, so all are always sent
const SONG_COLUMNS = ['id', 'title', 'lyrics_by', 'music_by', 'lyrics_doc_id'] as const;
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
  const { songs, loading } = useSongs();
  const { people } = usePeople();
  const { accessToken } = useAuth();
  const { setlists, refresh: refreshSetlists } = useAllSetlists();
  const { events } = useAllEvents();
  const { tracklists, refresh: refreshTracklists } = useTracklists();
  const { albums } = useAlbums();

  const [form, setForm] = useState<Form>(emptyForm);
  const [baseline, setBaseline] = useState('');
  const [titleError, setTitleError] = useState('');
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) { setBaseline(JSON.stringify(emptyForm())); return; }
    if (loading) return;
    const song = songs.find(x => x.id === id);
    if (!song) return;
    const f: Form = {
      id: song.id, title: song.title || '', lyrics_by: song.lyrics_by || '',
      music_by: song.music_by || '', lyrics_doc_id: song.lyrics_doc_id || '',
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

  if (!isNew && loading) return <p className="lu-loading">{s.loading}</p>;

  return (
    <form className="lu-form" onSubmit={e => { e.preventDefault(); save(form); }} noValidate>
      {leaveGuard}
      <div className="lu-page-head">
        <div>
          <p className="lu-eyebrow">{isNew ? s.songsTitle : s.editSongItem}</p>
          <h1>{isNew ? s.newSongItem : form.title}</h1>
        </div>
      </div>

      <Section title={s.secDetails}>
        <Field label={s.songTitle} error={titleError}>
          {fid => <input id={fid} value={form.title} onChange={e => set('title', e.target.value)} />}
        </Field>
        {renaming && (showCount > 0 || releaseCount > 0) && (
          <p className="lu-note">{s.renameCascade.replace('{shows}', String(showCount)).replace('{releases}', String(releaseCount))}</p>
        )}
        <div className="lu-grid-2">
          <Field label={s.musicBy} optional s={s}>
            {fid => <PeoplePicker s={s} locale={locale} id={fid} value={form.music_by} onChange={v => set('music_by', v)} people={people} personHref={pid => `${prefix}/people/${pid}`} />}
          </Field>
          <Field label={s.lyricsBy} optional s={s}>
            {fid => <PeoplePicker s={s} locale={locale} id={fid} value={form.lyrics_by} onChange={v => set('lyrics_by', v)} people={people} personHref={pid => `${prefix}/people/${pid}`} />}
          </Field>
        </div>
      </Section>

      {!isNew && (
        <Section title={`${s.songPlayedAt} · ${showCount}`}>
          {usage.shows.length === 0 ? <p className="lu-hint">{s.songNotPlayed}</p> : (
            <ul className="lu-list lu-usage">
              {usage.shows.map(({ row, event }) => {
                const name = event ? (locale === 'ja' ? event.title_ja || event.venue_ja || event.title_en || event.venue_en : event.title_en || event.venue_en || event.title_ja || event.venue_ja) : row.event;
                return (
                  <li key={`${row.event}-${row.set}-${row.order}`}>
                    <Link to={`${prefix}/events/${row.event}`} className="lu-list-row">
                      <time>{event?.date || '—'}</time>
                      <span className="lu-list-main">
                        <strong>{name}</strong>
                        <span>{setLabel(row.set)} · #{row.order}</span>
                      </span>
                      <span className="lu-list-tags">
                        {row.notes && <span className="lu-tag">{row.notes}</span>}
                        {row.status === 'private' && <span className="lu-tag is-muted">{s.hidden}</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      )}

      {!isNew && (
        <Section title={`${s.songOnReleases} · ${releaseCount}`}>
          {usage.releases.length === 0 ? <p className="lu-hint">{s.songNoReleases}</p> : (
            <ul className="lu-list lu-usage">
              {usage.releases.map(({ track, album }) => (
                <li key={`${track.release}-${track.track}`}>
                  {album ? (
                    <Link to={`${prefix}/releases/${album.id}`} className="lu-list-row">
                      {album.coverUrl ? <img className="lu-thumb" src={album.coverUrl} alt="" loading="lazy" /> : <span className="lu-thumb" />}
                      <span className="lu-list-main">
                        <strong>{album.title}</strong>
                        <span>{[album.date || album.year, s.trackN.replace('{n}', String(track.track))].filter(Boolean).join(' · ')}</span>
                      </span>
                    </Link>
                  ) : (
                    <span className="lu-list-row"><span className="lu-list-main"><strong>{track.release}</strong></span></span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section title={s.secLyrics}>
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
        <div className="lu-row">
          {form.lyrics_doc_id ? (
            <a className="lu-btn" href={`https://docs.google.com/document/d/${form.lyrics_doc_id}/edit`} target="_blank" rel="noopener noreferrer">
              {s.lyricsDocOpen}
            </a>
          ) : (
            <button type="button" className="lu-btn" onClick={createDoc} disabled={creatingDoc || saving}>
              {creatingDoc ? s.lyricsDocCreating : `+ ${s.lyricsDocCreate}`}
            </button>
          )}
        </div>
        {!isNew && (
          <div className="lu-danger-row">
            <DeleteButton s={s} onConfirm={async () => {
              try { await deleteRow('Songs', form.id); navigate(`${prefix}/songs`); }
              catch (err) { setError(errorText(err)); }
            }} />
          </div>
        )}
      </Section>

      <SaveBar
        s={s} saving={saving} savedAt={savedAt} error={error} dirty={dirty}
        viewHref={!isNew ? `/${locale}/songs/${form.id}` : undefined}
        backHref={`${prefix}/songs`}
      />
    </form>
  );
}
