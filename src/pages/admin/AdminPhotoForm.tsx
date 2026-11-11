import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAllPhotos, useAllEvents } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import {
  Section, Field, BilingualRow, Switch, SaveBar, ImageField, DeleteButton,
  useUnsavedWarning, makeId, errorText,
} from '../../components/admin/ui';
import { PHOTO_COLUMNS, photoToRow } from '../../utils/adminRows';
import { showLinkId } from '../../utils/photoLinks';
import { todayInJapan } from '../../utils/showDates';

// The server rewrites whole rows, so every column is always sent
type PhotoField = typeof PHOTO_COLUMNS[number];
type Form = Record<PhotoField, string>;
type LinkKind = 'none' | 'show' | 'other';

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
  const { events } = useAllEvents();

  const [form, setForm] = useState<Form>(emptyForm);
  const [baseline, setBaseline] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [linkKind, setLinkKind] = useState<LinkKind>('none');

  useEffect(() => {
    if (isNew) { setBaseline(JSON.stringify(emptyForm())); return; }
    if (loading) return;
    const p = photos.find(x => x.id === id);
    if (!p) return;
    const f: Form = {
      id: p.id, image_url: p.image_url || '', caption_en: p.caption_en || '', caption_ja: p.caption_ja || '',
      status: p.status || 'published', profile_photo: p.profile_photo || '', link: p.link || '', share_image: p.share_image || '',
    };
    setForm(f);
    setLinkKind(!f.link ? 'none' : showLinkId(f.link) ? 'show' : 'other');
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
          await updateRow('Photos', other.id, photoToRow({ ...other, profile_photo: '' }));
        }
      }
      // Only one share image too
      if (fields.share_image === 'yes') {
        for (const other of photos.filter(p => p.id !== photoId && p.share_image === 'yes')) {
          await updateRow('Photos', other.id, photoToRow({ ...other, share_image: '' }));
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

  // Shows to link to: upcoming first (soonest at the top), then past ones
  const today = todayInJapan();
  const showEnd = (e: { date: string; end_date?: string }) => e.end_date || e.date;
  const upcomingShows = events.filter(e => showEnd(e) >= today).sort((a, b) => a.date.localeCompare(b.date));
  const pastShows = events.filter(e => showEnd(e) < today).sort((a, b) => b.date.localeCompare(a.date));
  const showLabel = (e: typeof events[number]) => {
    const title = locale === 'ja' ? e.title_ja || e.title_en : e.title_en || e.title_ja;
    const venue = locale === 'ja' ? e.venue_ja || e.venue_en : e.venue_en || e.venue_ja;
    return `${e.date} · ${title || venue}`;
  };
  const linkedShowId = showLinkId(form.link);
  const linkedShow = linkedShowId ? events.find(e => e.id === linkedShowId) : undefined;
  const pickKind = (k: LinkKind) => {
    setLinkKind(k);
    if (k === 'none') set('link', '');
    if (k === 'show' && !linkedShowId) set('link', '');
    if (k === 'other' && linkedShowId) set('link', '');
  };

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

      <Section title={s.photoLink}>
        <p className="lu-hint lu-hint-top">{s.photoLinkHint}</p>
        <div className="lu-chips" role="radiogroup" aria-label={s.photoLink}>
          {(['none', 'show', 'other'] as const).map(k => (
            <button
              key={k} type="button" role="radio" aria-checked={linkKind === k}
              className={`lu-pill${linkKind === k ? ' is-on' : ''}`}
              onClick={() => pickKind(k)}
            >
              {k === 'none' ? s.photoLinkNone : k === 'show' ? s.photoLinkShow : s.photoLinkOther}
            </button>
          ))}
        </div>
        {linkKind === 'show' && (
          <Field label={s.photoLinkShow} s={s} hint={[s.photoLinkPastHint, s.photoCaptionFromShow].join(locale === 'ja' ? '' : ' ')}>
            {fid => (
              <select id={fid} value={linkedShowId || ''} onChange={e => set('link', e.target.value ? `/events/${e.target.value}` : '')}>
                <option value="">{s.photoLinkPickShow}</option>
                {upcomingShows.length > 0 && (
                  <optgroup label={s.upcoming}>
                    {upcomingShows.map(e => <option key={e.id} value={e.id}>{showLabel(e)}</option>)}
                  </optgroup>
                )}
                {pastShows.length > 0 && (
                  <optgroup label={s.past}>
                    {pastShows.map(e => <option key={e.id} value={e.id}>{showLabel(e)}</option>)}
                  </optgroup>
                )}
              </select>
            )}
          </Field>
        )}
        {linkKind === 'show' && linkedShow?.posterUrl && linkedShow.posterUrl !== form.image_url && (
          <button type="button" className="lu-btn" onClick={() => set('image_url', linkedShow.posterUrl!)}>
            ▣ {s.photoUseFlyer}
          </button>
        )}
        {linkKind === 'other' && (
          <Field label={s.photoLinkUrl} s={s} hint={s.photoLinkUrlHint}>
            {fid => <input id={fid} type="text" inputMode="url" placeholder="https://…" value={form.link} onChange={e => set('link', e.target.value.trim())} />}
          </Field>
        )}
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
        <Switch checked={form.share_image === 'yes'} onChange={v => set('share_image', v ? 'yes' : '')} label={s.shareImage} hint={s.shareImageHint} />
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
