import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAllNews } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import {
  Section, Field, BilingualRow, Switch, SaveBar, ImageField, DeleteButton,
  useUnsavedWarning, makeId, errorText,
} from '../../components/admin/ui';
import { NEWS_COLUMNS, newsToRow } from '../../utils/adminRows';
import LinkTextarea from '../../components/admin/LinkTextarea';

type NewsField = typeof NEWS_COLUMNS[number];
type Form = Record<NewsField, string>;

const today = () => new Date().toISOString().slice(0, 10);
function emptyForm(): Form {
  const f = Object.fromEntries(NEWS_COLUMNS.map(c => [c, ''])) as Form;
  f.date = today();
  f.status = 'published';
  return f;
}

export default function AdminNewsForm() {
  const { id } = useParams<{ id: string }>();
  const { s, locale, prefix } = useAdminT();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { news, loading } = useAllNews();

  const [form, setForm] = useState<Form>(emptyForm);
  const [baseline, setBaseline] = useState('');
  const [titleError, setTitleError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) { setBaseline(JSON.stringify(emptyForm())); return; }
    if (loading) return;
    const post = news.find(n => n.id === id);
    if (!post) return;
    const f: Form = newsToRow(post);
    setForm(f);
    setBaseline(JSON.stringify(f));
  }, [isNew, id, loading, news]);

  const dirty = baseline !== '' && JSON.stringify(form) !== baseline;
  const leaveGuard = useUnsavedWarning(dirty, saving);
  const set = (field: NewsField, value: string) => { setForm(f => ({ ...f, [field]: value })); if (field.startsWith('title')) setTitleError(''); };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title_en.trim() && !form.title_ja.trim()) { setTitleError(s.titleMissing); return; }
    setSaving(true);
    setError('');
    try {
      const postId = isNew
        ? makeId(/^[\x20-\x7e]+$/.test(form.title_en) ? [form.title_en] : [form.date, 'news'], new Set(news.map(n => n.id)))
        : form.id;
      const fields = { ...form, id: postId, date: form.date || today() };
      if (isNew) await createRow('News', fields);
      else await updateRow('News', postId, fields);
      setForm(fields);
      setBaseline(JSON.stringify(fields));
      setSavedAt(Date.now());
      if (isNew) navigate(`${prefix}/news/${postId}`, { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  if (!isNew && loading) return <p className="lu-loading">{s.loading}</p>;

  return (
    <form className="lu-form" onSubmit={handleSubmit} noValidate>
      {leaveGuard}
      <div className="lu-page-head">
        <div>
          <p className="lu-eyebrow">{isNew ? s.newsTitle : s.editNews}</p>
          <h1>{isNew ? s.newNews : (locale === 'ja' ? form.title_ja || form.title_en : form.title_en || form.title_ja)}</h1>
        </div>
      </div>

      <Section title={s.secDetails}>
        <p className="lu-hint">{s.bothLanguagesHint}</p>
        <Field label={s.date}>
          {fid => <input id={fid} type="date" value={form.date} onChange={e => set('date', e.target.value)} />}
        </Field>
        <BilingualRow>
          <Field label={`${s.title} · ${s.english}`} error={titleError}>
            {fid => <input id={fid} value={form.title_en} onChange={e => set('title_en', e.target.value)} />}
          </Field>
          <Field label={`${s.title} · ${s.japanese}`}>
            {fid => <input id={fid} lang="ja" value={form.title_ja} onChange={e => set('title_ja', e.target.value)} />}
          </Field>
        </BilingualRow>
        <Field label={`${s.body} · ${s.english}`} optional s={s}>
          {fid => <LinkTextarea s={s} id={fid} className="lu-textarea-long" rows={8} value={form.body_en} onChange={v => set('body_en', v)} />}
        </Field>
        <Field label={`${s.body} · ${s.japanese}`} optional s={s}>
          {fid => <LinkTextarea s={s} id={fid} className="lu-textarea-long" rows={8} lang="ja" value={form.body_ja} onChange={v => set('body_ja', v)} />}
        </Field>
      </Section>

      <Section title={s.image}>
        <ImageField s={s} value={form.image_url} onChange={v => set('image_url', v)} onError={setError} />
      </Section>

      <Section title={s.visible}>
        <Switch checked={form.status !== 'private'} onChange={v => set('status', v ? 'published' : 'private')} label={s.visible} hint={s.visibleHint} />
        {!isNew && (
          <div className="lu-danger-row">
            <DeleteButton s={s} onConfirm={async () => {
              try { await deleteRow('News', form.id); navigate(`${prefix}/news`); }
              catch (err) { setError(errorText(err)); }
            }} />
          </div>
        )}
      </Section>

      <SaveBar
        s={s} saving={saving} savedAt={savedAt} error={error} dirty={dirty}
        viewHref={!isNew ? `/${locale}/news/${form.id}` : undefined}
        backHref={`${prefix}/news`}
      />
    </form>
  );
}
