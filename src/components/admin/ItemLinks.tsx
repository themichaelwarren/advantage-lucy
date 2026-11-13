import { useEffect, useState } from 'react';
import type { AdminStrings } from '../../i18n/admin';
import { getLinks, saveLinks, getPageTitle, type LinkRow } from '../../services/adminService';
import { Section, EditDialog, Switch, errorText } from './ui';
import Icon from './Icon';
import { todayInJapan } from '../../utils/showDates';

/**
 * Links about a show, song or release (a blog post, a setlist page, an
 * interview): as many as you like, each on the site or band-only. Pasting
 * a link fills in the page's title. New links start band-only; switch one
 * on to list it on the site. See functions/lib/links.ts.
 */
type Draft = Pick<LinkRow, 'url' | 'title' | 'note' | 'status' | 'added'> & { key: number };
let nextKey = 0;
const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

export default function ItemLinks({ s, owner }: { s: AdminStrings; owner: string }) {
  const [links, setLinks] = useState<LinkRow[] | null>(null);
  const [rows, setRows] = useState<Draft[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    getLinks().then(all => { if (live) setLinks(all.filter(l => l.owner === owner)); }).catch(() => { if (live) setLinks([]); });
    return () => { live = false; };
  }, [owner]);

  const open = (addOne = false) => {
    const now = (links || []).map(l => ({ ...l, key: nextKey++ }));
    setRows(addOne || !now.length ? [...now, { url: '', title: '', note: '', status: 'private', added: '', key: nextKey++ }] : now);
    setError('');
  };
  const setRow = (key: number, patch: Partial<Draft>) => setRows(rs => rs && rs.map(r => (r.key === key ? { ...r, ...patch } : r)));
  // A link just pasted: fill in the page's title if there isn't one
  const fillTitle = async (key: number, url: string) => {
    if (!/^https?:\/\/\S+$/i.test(url.trim())) return;
    setFetching(key);
    const t = await getPageTitle(url.trim());
    setFetching(f => (f === key ? null : f));
    if (t) setRows(rs => rs && rs.map(r => (r.key === key && !r.title.trim() ? { ...r, title: t } : r)));
  };
  const save = async () => {
    if (!rows) return;
    setSaving(true); setError('');
    try {
      const keep = rows.filter(r => r.url.trim()).map(({ key: _, ...r }) => ({ ...r, url: r.url.trim(), added: r.added || todayInJapan() }));
      const saved = await saveLinks(owner, keep);
      setLinks(saved);
      setRows(null);
    } catch (err) { setError(errorText(err)); }
    finally { setSaving(false); }
  };
  const dirty = !!rows && JSON.stringify(rows.filter(r => r.url.trim()).map(({ key: _, ...r }) => r)) !== JSON.stringify((links || []).map(({ owner: _o, ...r }) => r));

  const editBtn = <button type="button" className="lu-icon-btn lu-edit-btn" onClick={() => open()} aria-label={s.songEdit} title={s.songEdit}><Icon name="edit" /></button>;

  return (
    <Section title={links?.length ? `${s.linksTitle} · ${links.length}` : s.linksTitle} aside={links?.length ? editBtn : undefined}>
      {links === null ? <p className="lu-hint">{s.loading}</p> : links.length === 0 ? (
        <p className="lu-hint">{s.linksNone} <button type="button" className="lu-link-btn" onClick={() => open(true)}>+ {s.refAdd}</button></p>
      ) : (
        <ul className="lu-reflist">
          {links.map((l, i) => (
            <li key={i}>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="lu-ref-title">{l.title || host(l.url)} <Icon name="external" /></a>
              <span className="lu-ref-meta">
                <span>{host(l.url)}</span>
                {l.status === 'private' && <span className="lu-tag is-muted"><Icon name="lock" /> {s.linkPrivate}</span>}
              </span>
              {l.note && <p className="lu-ref-note">{l.note}</p>}
            </li>
          ))}
        </ul>
      )}

      <EditDialog s={s} title={s.linksTitle} open={rows !== null} saving={saving} error={error} dirty={dirty}
        onClose={() => { if (dirty && !window.confirm(s.songDiscard)) return; setRows(null); }}
        onSave={save}>
        <p className="lu-hint">{s.linksHint}</p>
        <ul className="lu-ref-rows">
          {(rows || []).map(r => (
            <li key={r.key}>
              <input type="url" inputMode="url" placeholder="https://…" aria-label={s.refUrl} value={r.url}
                onChange={e => setRow(r.key, { url: e.target.value })}
                onPaste={e => { const v = e.clipboardData.getData('text'); setTimeout(() => fillTitle(r.key, v), 0); }}
                onBlur={e => { if (!r.title.trim()) fillTitle(r.key, e.target.value); }} />
              <input placeholder={fetching === r.key ? s.linkFetching : s.linkTitle} aria-label={s.linkTitle} value={r.title} onChange={e => setRow(r.key, { title: e.target.value })} />
              <input placeholder={`${s.linkNote} (${s.optional})`} aria-label={s.linkNote} value={r.note} onChange={e => setRow(r.key, { note: e.target.value })} />
              <div className="lu-ref-row-foot">
                <Switch checked={r.status !== 'private'} onChange={v => setRow(r.key, { status: v ? '' : 'private' })} label={r.status === 'private' ? s.linkPrivate : s.linkPublic} hint={s.linkPublicTip} />
                <button type="button" className="lu-icon-btn" aria-label={s.remove} title={s.remove} onClick={() => setRows(rs => rs && rs.filter(x => x.key !== r.key))}><Icon name="close" /></button>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className="lu-link-btn" onClick={() => setRows(rs => [...(rs || []), { url: '', title: '', note: '', status: 'private', added: '', key: nextKey++ }])}>+ {s.refAdd}</button>
      </EditDialog>
    </Section>
  );
}
