import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAllNews } from '../../hooks/useSheetData';
import { createRow, updateRow, deleteRow } from '../../services/adminService';
import { useAdminT } from '../../i18n/admin';
import PublishControl, { showDateTime } from '../../components/admin/PublishControl';
import {
  Section, Field, BilingualRow, SaveBar, ImageField, DeleteButton, EditDialog, VisToggle,
  useUnsavedWarning, makeId, errorText,
} from '../../components/admin/ui';
import { NEWS_COLUMNS, newsToRow } from '../../utils/adminRows';
import LinkTextarea from '../../components/admin/LinkTextarea';
import Icon from '../../components/admin/Icon';
import { linkify } from '../../utils/linkify';
import { useFitsViewport } from '../../hooks/useFitsViewport';
import { nowInJapan, normDateTime } from '../../utils/showDates';
import { ActivityHistory } from '../../components/admin/Activity';

type NewsField = typeof NEWS_COLUMNS[number];
type Form = Record<NewsField, string>;

const today = () => new Date().toISOString().slice(0, 10);
function emptyForm(): Form {
  const f = Object.fromEntries(NEWS_COLUMNS.map(c => [c, ''])) as Form;
  f.date = today();
  f.status = 'published';
  return f;
}

/**
 * A news post, read first: date, title, image and whether it's on the site
 * on the left; the text in both languages on the right. Each part has its
 * own ✎; the on/off beside the title's ✎ saves at once. A new post is one
 * plain form.
 */
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
  const [dialog, setDialog] = useState<null | 'details' | 'body' | 'image'>(null);
  useEffect(() => { setDialog(null); }, [id]);
  const panel = useFitsViewport<HTMLElement>(32);

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

  /** Saves the post (with any changes in `extra`); true if it worked. */
  async function save(extra: Partial<Form> = {}): Promise<boolean> {
    const next = { ...form, ...extra };
    if (!next.title_en.trim() && !next.title_ja.trim()) { setTitleError(s.titleMissing); return false; }
    setSaving(true);
    setError('');
    try {
      const postId = isNew
        ? makeId(/^[\x20-\x7e]+$/.test(next.title_en) ? [next.title_en] : [next.date, 'news'], new Set(news.map(n => n.id)))
        : next.id;
      const fields = { ...next, id: postId, date: next.date || today() };
      if (isNew) await createRow('News', fields);
      else await updateRow('News', postId, fields);
      setForm(fields);
      setBaseline(JSON.stringify(fields));
      setSavedAt(Date.now());
      if (isNew) navigate(`${prefix}/news/${postId}`, { replace: true });
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setSaving(false);
    }
  }
  const closeDialog = () => {
    if (dirty && !window.confirm(s.songDiscard)) return;
    if (baseline) setForm(JSON.parse(baseline) as Form);
    setTitleError(''); setError(''); setDialog(null);
  };
  const saveDialog = () => { save().then(ok => { if (ok) setDialog(null); }); };

  const detailsFields = (
    <>
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
      <PublishControl s={s} status={form.status} publishAt={form.publish_at}
        onChange={v => { set('status', v.status); set('publish_at', v.publish_at); }} />
    </>
  );
  const bodyFields = (
    <>
      <Field label={`${s.body} · ${s.english}`} optional s={s}>
        {fid => <LinkTextarea s={s} id={fid} className="lu-textarea-long" rows={10} value={form.body_en} onChange={v => set('body_en', v)} />}
      </Field>
      <Field label={`${s.body} · ${s.japanese}`} optional s={s}>
        {fid => <LinkTextarea s={s} id={fid} className="lu-textarea-long" rows={10} lang="ja" value={form.body_ja} onChange={v => set('body_ja', v)} />}
      </Field>
    </>
  );
  const imageField = <ImageField s={s} value={form.image_url} onChange={v => set('image_url', v)} onError={setError} />;

  if (!isNew && loading) return <p className="lu-loading">{s.loading}</p>;

  // ---------- A new post: one plain form ----------
  if (isNew) {
    return (
      <form className="lu-form" onSubmit={e => { e.preventDefault(); save(); }} noValidate>
        {leaveGuard}
        <div className="lu-page-head"><div><p className="lu-eyebrow">{s.newsTitle}</p><h1>{s.newNews}</h1></div></div>
        <Section title={s.secDetails}>{detailsFields}</Section>
        <Section title={s.body}>{bodyFields}</Section>
        <Section title={s.image}>{imageField}</Section>
        <SaveBar s={s} saving={saving} savedAt={savedAt} error={error} dirty={dirty} backHref={`${prefix}/news`} />
      </form>
    );
  }
  if (!news.some(n => n.id === id)) return <p className="lu-empty">{s.noResults}</p>;

  // ---------- The post at a glance ----------
  const saved = baseline ? (JSON.parse(baseline) as Form) : form;
  const main = (locale === 'ja' ? saved.title_ja || saved.title_en : saved.title_en || saved.title_ja);
  const other = locale === 'ja' ? saved.title_en : saved.title_ja;
  const at = normDateTime(saved.publish_at);
  const scheduled = saved.status !== 'private' && !!at && at > nowInJapan();
  const editBtn = (which: 'details' | 'body' | 'image', label = s.songEdit) => (
    <button type="button" className="lu-icon-btn lu-edit-btn" onClick={() => setDialog(which)} aria-label={label} title={label}><Icon name="edit" /></button>
  );
  const bodies = ([['ja', saved.body_ja, s.japanese], ['en', saved.body_en, s.english]] as const);

  return (
    <div className="lu-song-page lu-rel-page">
      {leaveGuard}
      <div className="lu-song-layout">
        <aside ref={panel.ref} className={`lu-song-side${panel.fits ? ' is-sticky' : ''}`} style={{ top: panel.top }}>
          <div className="lu-song-card">
            <div className="lu-song-card-head">
              <p className="lu-eyebrow"><Link to={`${prefix}/news`}><Icon name="back" /> {s.newsTitle}</Link></p>
              <span className="lu-row lu-card-tools">
                <VisToggle on={saved.status !== 'private'} onLabel={s.visPageShort} offLabel={s.songDraft} tip={s.visPostTip} busy={saving}
                  onFlip={() => save(saved.status === 'private' ? { status: 'published' } : { status: 'private', publish_at: '' })} />
                {editBtn('details')}
              </span>
            </div>
            <p className="lu-show-date"><strong>{saved.date.replace(/-/g, '.')}</strong></p>
            <div>
              <h1>{main}</h1>
              {other && other !== main && <p className="lu-song-alt lu-rel-alt" lang={locale === 'ja' ? 'en' : 'ja'}>{other}</p>}
            </div>
            {scheduled && <p className="lu-song-draft"><span className="lu-tag is-scheduled"><Icon name="clock" /> {s.scheduledTag.replace('{at}', showDateTime(at))}</span></p>}
            {saved.status === 'private' && <p className="lu-song-draft"><span className="lu-tag is-muted"><Icon name="lock" /> {s.songDraft}</span><span className="lu-hint">{s.visPostOff}</span></p>}
            <div className="lu-rel-art lu-news-art">
              {saved.image_url
                ? <img src={saved.image_url} alt="" />
                : <button type="button" className="lu-rel-art-empty" onClick={() => setDialog('image')}>+ {s.image}</button>}
              {saved.image_url && <span className="lu-rel-art-edit">{editBtn('image', s.image)}</span>}
            </div>
            {saved.status !== 'private' && !scheduled && (
              <a href={`/${locale}/news/${saved.id}`} target="_blank" rel="noopener" className="lu-btn lu-site-link"><Icon name="external" /> {s.viewOnSite}</a>
            )}
          </div>
        </aside>

        <div className="lu-song-main">
          <Section title={s.body} aside={editBtn('body')}>
            {!saved.body_ja && !saved.body_en ? (
              <p className="lu-hint">{s.noBodyYet} <button type="button" className="lu-link-btn" onClick={() => setDialog('body')}>{s.songEdit}</button></p>
            ) : (
              <div className="lu-rel-notes is-stacked">
                {bodies.map(([lang, text, label]) => (
                  <div key={lang} className="lu-rel-note">
                    <p className="lu-publish-label">{label}</p>
                    {text ? <p lang={lang} className="lu-rel-note-text">{linkify(text, lang)}</p> : <p className="lu-hint">{s.relNoTranslation}</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>
          <div className="lu-history-wrap"><ActivityHistory s={s} locale={locale} refs={[`News:${id}`]} /></div>
        </div>
      </div>

      <EditDialog s={s} title={s.secDetails} open={dialog === 'details'} onClose={closeDialog} onSave={saveDialog} saving={saving} error={error} dirty={dirty}
        footer={<DeleteButton s={s} onConfirm={async () => {
          try { await deleteRow('News', form.id); navigate(`${prefix}/news`); }
          catch (err) { setError(errorText(err)); }
        }} />}>
        {detailsFields}
      </EditDialog>
      <EditDialog s={s} title={s.body} open={dialog === 'body'} onClose={closeDialog} onSave={saveDialog} saving={saving} error={error} dirty={dirty}>
        {bodyFields}
      </EditDialog>
      <EditDialog s={s} title={s.image} open={dialog === 'image'} onClose={closeDialog} onSave={saveDialog} saving={saving} error={error} dirty={dirty}>
        {imageField}
      </EditDialog>
    </div>
  );
}
