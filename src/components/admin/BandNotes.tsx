import { useEffect, useState } from 'react';
import type { AdminStrings } from '../../i18n/admin';
import { getNotes, saveNotes, type NoteRow } from '../../services/adminService';
import { useAuth } from '../../contexts/AuthContext';
import { Section, LockHint, errorText } from './ui';
import Icon from './Icon';
import { whoName, whenText } from './Activity';
import { linkify } from '../../utils/linkify';

/**
 * Band notes on a show, song or release: a short thread, newest first,
 * each with who wrote it and when. Never on the site (a private tab, see
 * functions/lib/notes.ts). Adding, editing or deleting saves at once.
 */
export default function BandNotes({ s, locale, owner }: { s: AdminStrings; locale: string; owner: string }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<NoteRow[] | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    getNotes().then(all => { if (live) setNotes(all.filter(n => n.owner === owner)); }).catch(() => { if (live) setNotes([]); });
    return () => { live = false; };
  }, [owner]);

  const write = async (next: NoteRow[]) => {
    setSaving(true); setError('');
    try { setNotes(await saveNotes(owner, next)); return true; }
    catch (err) { setError(errorText(err)); return false; }
    finally { setSaving(false); }
  };
  const add = async () => {
    const text = draft.trim();
    if (!text || !notes) return;
    const note: NoteRow = { owner, id: Math.random().toString(36).slice(2, 10), at: new Date().toISOString(), who: user?.email || '', text };
    if (await write([...notes, note])) setDraft('');
  };
  const shown = [...(notes || [])].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Section title={s.notesTitle} badge={<LockHint text={s.videosPrivate} />}>
      <div className="lu-note-add">
        <textarea rows={2} value={draft} placeholder={s.notePlaceholder} aria-label={s.notePlaceholder}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add(); } }} />
        <button type="button" className="lu-btn" disabled={!draft.trim() || saving || notes === null} onClick={add}>{saving && draft ? s.saving : s.noteAdd}</button>
      </div>
      {error && <p className="lu-field-error" role="alert">{error}</p>}
      {notes === null ? <p className="lu-hint">{s.loading}</p> : shown.length === 0 ? null : (
        <ol className="lu-notes">
          {shown.map(n => (
            <li key={n.id}>
              <div className="lu-act-head">
                <span className="lu-act-who" aria-hidden="true">{whoName(n.who).charAt(0)}</span>
                <span className="lu-act-by"><strong title={n.who}>{whoName(n.who)}</strong> · <time dateTime={n.at}>{whenText(n.at, s, locale)}</time></span>
                {editing?.id !== n.id && (
                  <span className="lu-row lu-note-tools">
                    <button type="button" className="lu-icon-btn" aria-label={s.songEdit} title={s.songEdit} onClick={() => setEditing({ id: n.id, text: n.text })}><Icon name="edit" /></button>
                    <button type="button" className="lu-icon-btn" aria-label={s.remove} title={s.remove} disabled={saving}
                      onClick={() => { if (window.confirm(s.noteDeleteConfirm)) write((notes || []).filter(x => x.id !== n.id)); }}><Icon name="close" /></button>
                  </span>
                )}
              </div>
              {editing?.id === n.id ? (
                <div className="lu-note-add">
                  <textarea rows={3} value={editing.text} autoFocus onChange={e => setEditing({ id: n.id, text: e.target.value })} aria-label={s.songEdit} />
                  <span className="lu-row">
                    <button type="button" className="lu-btn" onClick={() => setEditing(null)}>{s.cancel}</button>
                    <button type="button" className="lu-btn lu-btn-primary" disabled={!editing.text.trim() || saving}
                      onClick={async () => { if (await write((notes || []).map(x => (x.id === n.id ? { ...x, text: editing.text.trim() } : x)))) setEditing(null); }}>{s.save}</button>
                  </span>
                </div>
              ) : (
                <p className="lu-note-text">{linkify(n.text)}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
