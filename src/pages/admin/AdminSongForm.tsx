import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSongs, usePeople } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
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
  useUnsavedWarning(dirty);
  const set = (k: SongField, v: string) => { setForm(f => ({ ...f, [k]: v })); if (k === 'title') setTitleError(''); };

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

  if (!isNew && loading) return <p className="ad-loading">{s.loading}</p>;

  return (
    <form className="ad-form" onSubmit={e => { e.preventDefault(); save(form); }} noValidate>
      <div className="ad-page-head">
        <div>
          <p className="ad-eyebrow">{isNew ? s.songsTitle : s.editSongItem}</p>
          <h1>{isNew ? s.newSongItem : form.title}</h1>
        </div>
      </div>

      <Section title={s.secDetails}>
        <Field label={s.songTitle} error={titleError}>
          {fid => <input id={fid} value={form.title} onChange={e => set('title', e.target.value)} />}
        </Field>
        <div className="ad-grid-2">
          <Field label={s.musicBy} optional s={s}>
            {fid => <PeoplePicker s={s} locale={locale} id={fid} value={form.music_by} onChange={v => set('music_by', v)} people={people} />}
          </Field>
          <Field label={s.lyricsBy} optional s={s}>
            {fid => <PeoplePicker s={s} locale={locale} id={fid} value={form.lyrics_by} onChange={v => set('lyrics_by', v)} people={people} />}
          </Field>
        </div>
      </Section>

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
        <div className="ad-row">
          {form.lyrics_doc_id ? (
            <a className="ad-btn" href={`https://docs.google.com/document/d/${form.lyrics_doc_id}/edit`} target="_blank" rel="noopener noreferrer">
              {s.lyricsDocOpen}
            </a>
          ) : (
            <button type="button" className="ad-btn" onClick={createDoc} disabled={creatingDoc || saving}>
              {creatingDoc ? s.lyricsDocCreating : `+ ${s.lyricsDocCreate}`}
            </button>
          )}
        </div>
        {!isNew && (
          <div className="ad-danger-row">
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
        onCancel={() => navigate(`${prefix}/songs`)}
      />
    </form>
  );
}
