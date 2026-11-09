import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAllBlog } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import {
  Section, Field, BilingualRow, Switch, SaveBar, DeleteButton,
  useUnsavedWarning, makeId, errorText,
} from '../../components/admin/ui';
import { BLOG_COLUMNS, blogToRow } from '../../utils/adminRows';
import InstagramEmbed from '../../components/InstagramEmbed';

type BlogField = typeof BLOG_COLUMNS[number];
type Form = Record<BlogField, string>;

const today = () => new Date().toISOString().slice(0, 10);
function emptyForm(): Form {
  const f = Object.fromEntries(BLOG_COLUMNS.map(c => [c, ''])) as Form;
  f.date = today();
  f.status = 'published';
  return f;
}

/** instagram.com/p/ABC123/ or /reel/ABC123/ → "ABC123" (existing blog IDs use this). */
function instagramCode(url: string): string | null {
  return url.match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

export default function AdminBlogForm() {
  const { id } = useParams<{ id: string }>();
  const { s, locale, prefix } = useAdminT();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { blog, loading } = useAllBlog();

  const [form, setForm] = useState<Form>(emptyForm);
  const [baseline, setBaseline] = useState('');
  const [urlError, setUrlError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) { setBaseline(JSON.stringify(emptyForm())); return; }
    if (loading) return;
    const post = blog.find(b => b.id === id);
    if (!post) return;
    const f: Form = blogToRow(post);
    setForm(f);
    setBaseline(JSON.stringify(f));
  }, [isNew, id, loading, blog]);

  const dirty = baseline !== '' && JSON.stringify(form) !== baseline;
  const leaveGuard = useUnsavedWarning(dirty, saving);
  const set = (field: BlogField, value: string) => { setForm(f => ({ ...f, [field]: value })); if (field === 'instagram_url') setUrlError(''); };
  const code = instagramCode(form.instagram_url);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code) { setUrlError(s.instagramBad); return; }
    setSaving(true);
    setError('');
    try {
      const postId = isNew ? (blog.some(b => b.id === code) ? makeId([code], new Set(blog.map(b => b.id))) : code) : form.id;
      // Store a clean link without tracking parameters
      const cleanUrl = form.instagram_url.split('?')[0];
      const fields = { ...form, id: postId, instagram_url: cleanUrl, date: form.date || today() };
      if (isNew) await createRow('Blog', fields);
      else await updateRow('Blog', postId, fields);
      setForm(fields);
      setBaseline(JSON.stringify(fields));
      setSavedAt(Date.now());
      if (isNew) navigate(`${prefix}/blog/${postId}`, { replace: true });
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
          <p className="lu-eyebrow">{isNew ? s.blogTitle : s.editBlog}</p>
          <h1>{isNew ? s.newBlog : (locale === 'ja' ? form.title_ja || form.title_en : form.title_en || form.title_ja) || form.id}</h1>
        </div>
      </div>

      <Section title="Instagram">
        <Field label={s.instagramUrl} hint={s.instagramHint} error={urlError}>
          {fid => <input id={fid} type="url" inputMode="url" placeholder="https://www.instagram.com/p/…" value={form.instagram_url} onChange={e => set('instagram_url', e.target.value)} />}
        </Field>
        {code && (
          <div className="lu-preview">
            <p className="lu-eyebrow">{s.preview}</p>
            <InstagramEmbed url={form.instagram_url.split('?')[0]} />
          </div>
        )}
      </Section>

      <Section title={s.secDetails}>
        <p className="lu-hint">{s.bothLanguagesHint}</p>
        <Field label={s.date}>
          {fid => <input id={fid} type="date" value={form.date} onChange={e => set('date', e.target.value)} />}
        </Field>
        <BilingualRow>
          <Field label={`${s.title} · ${s.english}`} optional s={s}>
            {fid => <input id={fid} value={form.title_en} onChange={e => set('title_en', e.target.value)} />}
          </Field>
          <Field label={`${s.title} · ${s.japanese}`} optional s={s}>
            {fid => <input id={fid} lang="ja" value={form.title_ja} onChange={e => set('title_ja', e.target.value)} />}
          </Field>
        </BilingualRow>
      </Section>

      <Section title={s.visible}>
        <Switch checked={form.status !== 'private'} onChange={v => set('status', v ? 'published' : 'private')} label={s.visible} hint={s.visibleHint} />
        {!isNew && (
          <div className="lu-danger-row">
            <DeleteButton s={s} onConfirm={async () => {
              try { await deleteRow('Blog', form.id); navigate(`${prefix}/blog`); }
              catch (err) { setError(errorText(err)); }
            }} />
          </div>
        )}
      </Section>

      <SaveBar
        s={s} saving={saving} savedAt={savedAt} error={error} dirty={dirty}
        viewHref={!isNew ? `/${locale}/blog/${form.id}` : undefined}
        backHref={`${prefix}/blog`}
      />
    </form>
  );
}
