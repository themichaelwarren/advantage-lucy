import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAllPhotos } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import {
  Section, Field, BilingualRow, Switch, SaveBar, ImageField, DeleteButton,
  useUnsavedWarning, makeId, errorText,
} from '../../components/admin/ui';

// Same columns as before; the server rewrites whole rows, so all are always sent
const PHOTO_COLUMNS = ['id', 'image_url', 'caption_en', 'caption_ja', 'status', 'profile_photo'] as const;
type PhotoField = typeof PHOTO_COLUMNS[number];
type Form = Record<PhotoField, string>;

function emptyForm(): Form {
  const f = Object.fromEntries(PHOTO_COLUMNS.map(c => [c, ''])) as Form;
  f.status = 'published';
  return f;
}

export default function AdminPhotoForm() {
  const { id } = useParams<{ id: string }>();
  const { s, locale, prefix } = useAdminT();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { photos, loading } = useAllPhotos();

  const [form, setForm] = useState<Form>(emptyForm);
  const [baseline, setBaseline] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) { setBaseline(JSON.stringify(emptyForm())); return; }
    if (loading) return;
    const p = photos.find(x => x.id === id);
    if (!p) return;
    const f: Form = {
      id: p.id, image_url: p.image_url || '', caption_en: p.caption_en || '', caption_ja: p.caption_ja || '',
      status: p.status || 'published', profile_photo: p.profile_photo || '',
    };
    setForm(f);
    setBaseline(JSON.stringify(f));
  }, [isNew, id, loading, photos]);

  const dirty = baseline !== '' && JSON.stringify(form) !== baseline;
  const leaveGuard = useUnsavedWarning(dirty, saving);
  const set = (k: PhotoField, v: string) => { setForm(f => ({ ...f, [k]: v })); if (k === 'image_url') setPhotoError(''); };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.image_url) { setPhotoError(s.photoMissing); return; }
    setSaving(true);
    setError('');
    try {
      const photoId = isNew
        ? makeId([new Date().toISOString().slice(0, 10), form.caption_en || 'photo'], new Set(photos.map(p => p.id)))
        : form.id;
      const fields = { ...form, id: photoId };
      if (isNew) await createRow('Photos', fields);
      else await updateRow('Photos', photoId, fields);

      // Only one About-page photo: switch it off on any others
      if (fields.profile_photo === 'yes') {
        for (const other of photos.filter(p => p.id !== photoId && p.profile_photo === 'yes')) {
          await updateRow('Photos', other.id, {
            id: other.id, image_url: other.image_url || '', caption_en: other.caption_en || '',
            caption_ja: other.caption_ja || '', status: other.status || 'published', profile_photo: '',
          });
        }
      }

      setForm(fields);
      setBaseline(JSON.stringify(fields));
      setSavedAt(Date.now());
      if (isNew) navigate(`${prefix}/photos/${photoId}`, { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  if (!isNew && loading) return <p className="lu-loading">{s.loading}</p>;

  const caption = locale === 'ja' ? form.caption_ja || form.caption_en : form.caption_en || form.caption_ja;

  return (
    <form className="lu-form" onSubmit={handleSubmit} noValidate>
      {leaveGuard}
      <div className="lu-page-head">
        <div>
          <p className="lu-eyebrow">{isNew ? s.photosTitle : s.editPhoto}</p>
          <h1>{isNew ? s.newPhoto : caption || s.editPhoto}</h1>
        </div>
      </div>

      <Section title={s.photo}>
        <ImageField s={s} value={form.image_url} onChange={v => set('image_url', v)} onError={setError} />
        {photoError && <p className="lu-field-error">{photoError}</p>}
      </Section>

      <Section title={s.secDetails}>
        <BilingualRow>
          <Field label={`${s.caption} · ${s.english}`} optional s={s}>
            {fid => <input id={fid} value={form.caption_en} onChange={e => set('caption_en', e.target.value)} />}
          </Field>
          <Field label={`${s.caption} · ${s.japanese}`} optional s={s}>
            {fid => <input id={fid} lang="ja" value={form.caption_ja} onChange={e => set('caption_ja', e.target.value)} />}
          </Field>
        </BilingualRow>
        <Switch checked={form.status !== 'private'} onChange={v => set('status', v ? 'published' : 'private')} label={s.visible} hint={s.visibleHint} />
        <Switch checked={form.profile_photo === 'yes'} onChange={v => set('profile_photo', v ? 'yes' : '')} label={s.profilePhoto} hint={s.profilePhotoHint} />
        {!isNew && (
          <div className="lu-danger-row">
            <DeleteButton s={s} onConfirm={async () => {
              try { await deleteRow('Photos', form.id); navigate(`${prefix}/photos`); }
              catch (err) { setError(errorText(err)); }
            }} />
          </div>
        )}
      </Section>

      <SaveBar s={s} saving={saving} savedAt={savedAt} error={error} dirty={dirty} backHref={`${prefix}/photos`} />
    </form>
  );
}
