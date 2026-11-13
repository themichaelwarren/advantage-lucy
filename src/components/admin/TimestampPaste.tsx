import Icon from './Icon';
import { useState } from 'react';
import type { AdminStrings } from '../../i18n/admin';
import { parseTimestamps, type PastedSong } from '../../utils/timestamps';
import { youTubeId } from '../../utils/youtube';

/**
 * "📋 Paste from the description": a link that opens a box for a video's
 * timestamps (and, optionally, the video's link). Reads them with
 * parseTimestamps and hands the songs back; says what happened.
 */
export default function TimestampPaste({ s, label, withLink, anyLink, placeholder, onRead }: {
  s: AdminStrings;
  label: string;
  /** Also ask for the video's YouTube link */
  withLink?: boolean;
  /** Any web link is fine there (a setlist site), not only YouTube */
  anyLink?: boolean;
  placeholder?: string;
  /** Returns a short note to show (e.g. "8 songs read"), or '' */
  onRead: (songs: PastedSong[], link: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const badLink = !!link.trim() && (anyLink ? !/^https?:\/\/\S+$/i.test(link.trim()) : !youTubeId(link));

  const read = () => {
    const songs = parseTimestamps(text);
    if (!songs.length) { setNote(s.viPasteNothing); return; }
    const out = onRead(songs, link.trim());
    setNote(out);
    if (out !== s.viPasteNothing) { setOpen(false); setText(''); setLink(''); }
  };

  if (!open) {
    return (
      <div className="lu-paste-closed">
        <button type="button" className="lu-link-btn" onClick={() => { setOpen(true); setNote(''); }}><Icon name="paste" /> {label}</button>
        {note && <p className="lu-note" role="status">{note}</p>}
      </div>
    );
  }
  return (
    <div className="lu-vi-paste lu-paste-box">
      {withLink && (
        <label className="lu-field">
          <span>{s.pasteVideoLink} <span className="lu-optional">· {s.optional}</span></span>
          <input type="url" inputMode="url" placeholder={anyLink ? "https://…" : "https://youtu.be/…"} value={link} onChange={e => setLink(e.target.value)} />
          {badLink && <span className="lu-field-error">{anyLink ? s.pasteLinkBad : s.viNotYouTube}</span>}
          <span className="lu-hint">{s.pasteVideoLinkHint}</span>
        </label>
      )}
      <textarea rows={7} value={text} onChange={e => setText(e.target.value)} placeholder={placeholder || s.viPastePlaceholder} aria-label={s.viPasteLabel} />
      <div className="lu-row">
        <button type="button" className="lu-btn" disabled={!text.trim() || badLink} onClick={read}>{s.viPasteRead}</button>
        <button type="button" className="lu-link-btn" onClick={() => { setOpen(false); setNote(''); }}>{s.cancel}</button>
      </div>
      {note && <p className="lu-note" role="status">{note}</p>}
    </div>
  );
}
