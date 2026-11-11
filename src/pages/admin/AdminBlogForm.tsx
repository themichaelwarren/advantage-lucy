import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAllBlog } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import PublishControl, { showDateTime } from '../../components/admin/PublishControl';
import {
  Section, Field, BilingualRow, SaveBar, DeleteButton, EditDialog, VisToggle,
  useUnsavedWarning, makeId, errorText,
} from '../../components/admin/ui';
import { BLOG_COLUMNS, blogToRow } from '../../utils/adminRows';
import InstagramEmbed from '../../components/InstagramEmbed';
import Icon from '../../components/admin/Icon';
import { useFitsViewport } from '../../hooks/useFitsViewport';
import { nowInJapan, normDateTime } from '../../utils/showDates';

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

/**
 * A blog post (an Instagram post), read first: its picture, date, title
 * and whether it's on the site on the left; the post itself on the right.
 * ✎ opens the details; the on/off beside it saves at once. A new post is
 * one plain form.
 */
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
  const [editing, setEditing] = useState(false);
  useEffect(() => { setEditing(false); }, [id]);
  const panel = useFitsViewport<HTMLElement>(32);

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

  /** Saves the post (with any changes in `extra`); true if it worked. */
  async function save(extra: Partial<Form> = {}): Promise<boolean> {
    const next = { ...form, ...extra };
    const c = instagramCode(next.instagram_url);
    if (!c) { setUrlError(s.instagramBad); return false; }
    setSaving(true);
    setError('');
    try {
      const postId = isNew ? (blog.some(b => b.id === c) ? makeId([c], new Set(blog.map(b => b.id))) : c) : next.id;
      // Store a clean link without tracking parameters
      const cleanUrl = next.instagram_url.split('?')[0];
      const fields = { ...next, id: postId, instagram_url: cleanUrl, date: next.date || today() };
      if (isNew) await createRow('Blog', fields);
      else await updateRow('Blog', postId, fields);
      setForm(fields);
      setBaseline(JSON.stringify(fields));
      setSavedAt(Date.now());
      if (isNew) navigate(`${prefix}/blog/${postId}`, { replace: true });
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  const fields = (
    <>
      <Field label={s.instagramUrl} hint={s.instagramHint} error={urlError}>
        {fid => <input id={fid} type="url" inputMode="url" placeholder="https://www.instagram.com/p/…" value={form.instagram_url} onChange={e => set('instagram_url', e.target.value)} />}
      </Field>
      <Field label={s.date}>
        {fid => <input id={fid} type="date" value={form.date} onChange={e => set('date', e.target.value)} />}
      </Field>
      <p className="lu-hint">{s.bothLanguagesHint}</p>
      <BilingualRow>
        <Field label={`${s.title} · ${s.english}`} optional s={s}>
          {fid => <input id={fid} value={form.title_en} onChange={e => set('title_en', e.target.value)} />}
        </Field>
        <Field label={`${s.title} · ${s.japanese}`} optional s={s}>
          {fid => <input id={fid} lang="ja" value={form.title_ja} onChange={e => set('title_ja', e.target.value)} />}
        </Field>
      </BilingualRow>
      <PublishControl s={s} status={form.status} publishAt={form.publish_at}
        onChange={v => { set('status', v.status); set('publish_at', v.publish_at); }} />
    </>
  );

  if (!isNew && loading) return <p className="lu-loading">{s.loading}</p>;

  // ---------- A new post: one plain form ----------
  if (isNew) {
    return (
      <form className="lu-form" onSubmit={e => { e.preventDefault(); save(); }} noValidate>
        {leaveGuard}
        <div className="lu-page-head"><div><p className="lu-eyebrow">{s.blogTitle}</p><h1>{s.newBlog}</h1></div></div>
        <Section title={s.secDetails}>{fields}</Section>
        {code && (
          <Section title={s.preview}>
            <InstagramEmbed url={form.instagram_url.split('?')[0]} />
          </Section>
        )}
        <SaveBar s={s} saving={saving} savedAt={savedAt} error={error} dirty={dirty} backHref={`${prefix}/blog`} />
      </form>
    );
  }
  if (!blog.some(b => b.id === id)) return <p className="lu-empty">{s.noResults}</p>;

  // ---------- The post at a glance ----------
  const saved = baseline ? (JSON.parse(baseline) as Form) : form;
  const savedCode = instagramCode(saved.instagram_url);
  const main = (locale === 'ja' ? saved.title_ja || saved.title_en : saved.title_en || saved.title_ja) || s.untitledPost;
  const other = locale === 'ja' ? saved.title_en : saved.title_ja;
  const at = normDateTime(saved.publish_at);
  const scheduled = saved.status !== 'private' && !!at && at > nowInJapan();

  return (
    <div className="lu-song-page lu-rel-page">
      {leaveGuard}
      <div className="lu-song-layout">
        <aside ref={panel.ref} className={`lu-song-side${panel.fits ? ' is-sticky' : ''}`} style={{ top: panel.top }}>
          <div className="lu-song-card">
            <div className="lu-song-card-head">
              <p className="lu-eyebrow"><Link to={`${prefix}/blog`}><Icon name="back" /> {s.blogTitle}</Link></p>
              <span className="lu-row lu-card-tools">
                <VisToggle on={saved.status !== 'private'} onLabel={s.visPageShort} offLabel={s.songDraft} tip={s.visPostTip} busy={saving}
                  onFlip={() => save(saved.status === 'private' ? { status: 'published' } : { status: 'private', publish_at: '' })} />
                <button type="button" className="lu-icon-btn lu-edit-btn" onClick={() => setEditing(true)} aria-label={s.songEdit} title={s.songEdit}><Icon name="edit" /></button>
              </span>
            </div>
            <p className="lu-show-date"><strong>{saved.date.replace(/-/g, '.')}</strong></p>
            <div>
              <h1>{main}</h1>
              {other && other !== main && <p className="lu-song-alt lu-rel-alt" lang={locale === 'ja' ? 'en' : 'ja'}>{other}</p>}
            </div>
            {scheduled && <p className="lu-song-draft"><span className="lu-tag is-scheduled"><Icon name="clock" /> {s.scheduledTag.replace('{at}', showDateTime(at))}</span></p>}
            {saved.status === 'private' && <p className="lu-song-draft"><span className="lu-tag is-muted"><Icon name="lock" /> {s.songDraft}</span><span className="lu-hint">{s.visPostOff}</span></p>}
            {savedCode && (
              <a className="lu-rel-art lu-blog-art" href={saved.instagram_url} target="_blank" rel="noopener noreferrer" aria-label={s.openOnInstagram}>
                <img src={`/api/ig/${savedCode}`} alt="" />
              </a>
            )}
            <div className="lu-row lu-rel-links">
              <a className="lu-btn" href={saved.instagram_url} target="_blank" rel="noopener noreferrer">{s.openOnInstagram} <Icon name="external" /></a>
            </div>
          </div>
        </aside>

        <div className="lu-song-main">
          <Section title={s.preview}>
            {savedCode ? <InstagramEmbed url={saved.instagram_url} /> : <p className="lu-hint">{s.instagramBad}</p>}
          </Section>
        </div>
      </div>

      <EditDialog s={s} title={s.secDetails} open={editing} saving={saving} error={error} dirty={dirty}
        onSave={() => { save().then(ok => { if (ok) setEditing(false); }); }}
        onClose={() => {
          if (dirty && !window.confirm(s.songDiscard)) return;
          if (baseline) setForm(JSON.parse(baseline) as Form);
          setUrlError(''); setError(''); setEditing(false);
        }}
        footer={<DeleteButton s={s} onConfirm={async () => {
          try { await deleteRow('Blog', form.id); navigate(`${prefix}/blog`); }
          catch (err) { setError(errorText(err)); }
        }} />}>
        {fields}
      </EditDialog>
    </div>
  );
}
