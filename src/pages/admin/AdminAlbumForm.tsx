import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAlbums, useTracklists, useSongs } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow, replaceRows } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import {
  Section, Field, BilingualRow, SaveBar, ImageField, DeleteButton,
  useUnsavedWarning, makeId, errorText,
} from '../../components/admin/ui';

// Same columns as before; the server rewrites whole rows, so all are always sent
const ALBUM_COLUMNS = [
  'id', 'title', 'date', 'year', 'type', 'number',
  'format', 'label', 'artwork_url', 'listen_url',
  'description_en', 'description_ja',
] as const;
type AlbumField = typeof ALBUM_COLUMNS[number];
type Form = Record<AlbumField, string>;
const emptyForm = (): Form => Object.fromEntries(ALBUM_COLUMNS.map(c => [c, ''])) as Form;

interface Track { key: string; title: string }
let nextKey = 0;
const track = (title = ''): Track => ({ key: `t${nextKey++}`, title });

export default function AdminAlbumForm() {
  const { id } = useParams<{ id: string }>();
  const { s, locale, prefix } = useAdminT();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { albums, loading } = useAlbums();
  const { tracklists } = useTracklists();
  const { songs } = useSongs();

  const [form, setForm] = useState<Form>(emptyForm);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [savedTitle, setSavedTitle] = useState(''); // tracklists are keyed by release title
  const [baseline, setBaseline] = useState('');
  const [titleError, setTitleError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  const songByTitle = useMemo(() => new Map(songs.map(x => [x.title, x])), [songs]);
  const snapshot = (f: Form, t: Track[]) => JSON.stringify([f, t.map(x => x.title)]);

  useEffect(() => {
    if (isNew) { setBaseline(snapshot(emptyForm(), [])); return; }
    if (loading) return;
    const a = albums.find(x => x.id === id);
    if (!a) return;
    const f: Form = {
      id: a.id, title: a.title || '', date: a.date || '', year: a.year || '', type: a.type || '',
      number: a.number || '', format: a.format || '', label: a.label || '', artwork_url: a.coverUrl || '',
      listen_url: a.listenUrl || '', description_en: a.description_en || '', description_ja: a.description_ja || '',
    };
    const t = tracklists.filter(x => x.release === a.title).sort((x, y) => x.track - y.track).map(x => track(x.title));
    setForm(f);
    setTracks(t);
    setSavedTitle(a.title);
    setBaseline(snapshot(f, t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, id, loading, albums, tracklists]);

  const dirty = baseline !== '' && snapshot(form, tracks) !== baseline;
  useUnsavedWarning(dirty);
  const set = (k: AlbumField, v: string) => { setForm(f => ({ ...f, [k]: v })); if (k === 'title') setTitleError(''); };

  function moveTrack(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= tracks.length) return;
    const copy = [...tracks];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setTracks(copy);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setTitleError(s.releaseTitleMissing); return; }
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

      // Tracklist rows are keyed by the release title: move them if it was renamed
      const rows = tracks
        .filter(t => t.title.trim())
        .map((t, i) => ({ release: fields.title, track: String(i + 1), title: t.title.trim() }));
      if (savedTitle && savedTitle !== fields.title) await replaceRows('Tracklists', savedTitle, []);
      if (rows.length || savedTitle) await replaceRows('Tracklists', fields.title, rows);

      setForm(fields);
      setSavedTitle(fields.title);
      setBaseline(snapshot(fields, tracks));
      setSavedAt(Date.now());
      if (isNew) navigate(`${prefix}/releases/${albumId}`, { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  if (!isNew && loading) return <p className="lu-loading">{s.loading}</p>;

  return (
    <form className="lu-form" onSubmit={handleSubmit} noValidate>
      <div className="lu-page-head">
        <div>
          <p className="lu-eyebrow">{isNew ? s.releasesTitle : s.editRelease}</p>
          <h1>{isNew ? s.newRelease : form.title}</h1>
        </div>
      </div>

      <Section title={s.secDetails}>
        <Field label={s.releaseTitle} error={titleError}>
          {fid => <input id={fid} value={form.title} onChange={e => set('title', e.target.value)} />}
        </Field>
        <div className="lu-grid-2">
          <Field label={s.releaseDate} optional s={s}>
            {fid => <input id={fid} type="date" value={form.date} onChange={e => set('date', e.target.value)} />}
          </Field>
          <Field label={s.releaseType} optional s={s}>
            {fid => (
              <select id={fid} value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="">—</option>
                <option value="album">{s.typeAlbum}</option>
                <option value="lp">{s.typeLp}</option>
                <option value="ep">{s.typeEp}</option>
                <option value="single">{s.typeSingle}</option>
                <option value="compilation">{s.typeCompilation}</option>
              </select>
            )}
          </Field>
        </div>
        <div className="lu-grid-3">
          <Field label={s.label} optional s={s}>
            {fid => <input id={fid} value={form.label} onChange={e => set('label', e.target.value)} />}
          </Field>
          <Field label={s.catalogNo} optional s={s}>
            {fid => <input id={fid} value={form.number} onChange={e => set('number', e.target.value)} />}
          </Field>
          <Field label={s.format} optional s={s}>
            {fid => <input id={fid} value={form.format} placeholder={s.formatPlaceholder} onChange={e => set('format', e.target.value)} />}
          </Field>
        </div>
        <Field label={s.listenUrl} hint={s.listenHint} optional s={s}>
          {fid => <input id={fid} type="url" inputMode="url" placeholder="https://" value={form.listen_url} onChange={e => set('listen_url', e.target.value)} />}
        </Field>
        <BilingualRow>
          <Field label={`${s.description} · ${s.english}`} optional s={s}>
            {fid => <textarea id={fid} rows={4} value={form.description_en} onChange={e => set('description_en', e.target.value)} />}
          </Field>
          <Field label={`${s.description} · ${s.japanese}`} optional s={s}>
            {fid => <textarea id={fid} rows={4} lang="ja" value={form.description_ja} onChange={e => set('description_ja', e.target.value)} />}
          </Field>
        </BilingualRow>
      </Section>

      <Section title={s.secTracklist}>
        <div className="lu-setlist">
          <datalist id="lu-track-titles">
            {songs.map(x => <option key={x.id} value={x.title} />)}
          </datalist>
          <div className="lu-set">
            <ol>
              {tracks.map((t, i) => {
                const song = songByTitle.get(t.title.trim());
                return (
                  <li key={t.key} className="lu-song">
                    <input
                      className="lu-song-title"
                      list="lu-track-titles"
                      value={t.title}
                      placeholder={s.trackTitle}
                      aria-label={s.trackTitle}
                      onChange={e => setTracks(tracks.map(x => (x.key === t.key ? { ...x, title: e.target.value } : x)))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (t.title.trim()) { const copy = [...tracks]; copy.splice(i + 1, 0, track()); setTracks(copy); }
                        }
                      }}
                      autoFocus={i === tracks.length - 1 && !t.title}
                    />
                    {t.title.trim() && (song
                      ? <Link to={`${prefix}/songs/${song.id}`} className={`lu-tag ${song.lyrics_doc_id ? 'is-ok' : 'is-todo'}`}>
                          {song.lyrics_doc_id ? s.lyricsLinked : s.lyricsMissing}
                        </Link>
                      : <span className="lu-tag is-muted">{s.songNotListed}</span>)}
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
      </Section>

      <Section title={s.artwork}>
        <ImageField s={s} value={form.artwork_url} onChange={v => set('artwork_url', v)} onError={setError} />
        {!isNew && (
          <div className="lu-danger-row">
            <DeleteButton s={s} onConfirm={async () => {
              try {
                if (savedTitle) await replaceRows('Tracklists', savedTitle, []);
                await deleteRow('Albums', form.id);
                navigate(`${prefix}/releases`);
              } catch (err) { setError(errorText(err)); }
            }} />
          </div>
        )}
      </Section>

      <SaveBar
        s={s} saving={saving} savedAt={savedAt} error={error} dirty={dirty}
        viewHref={!isNew ? `/${locale}/releases/${form.id}` : undefined}
        onCancel={() => navigate(`${prefix}/releases`)}
      />
    </form>
  );
}
