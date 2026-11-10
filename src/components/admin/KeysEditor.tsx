import type { AdminStrings } from '../../i18n/admin';
import { NOTES, MINOR_NOTES, keyName, parseKey } from '../../../functions/lib/keys';

/**
 * A song's keys, in order (one per section, modulation, version…). Each
 * row: tap one of the 12 notes, toggle m for minor, add a label if it
 * helps ("サビ", "転調後", "原曲").
 */
export interface KeyDraft { pos: number; minor: boolean; label: string }

export const toDrafts = (rows: { value: string; label: string }[]): KeyDraft[] =>
  rows.map(r => ({ ...(parseKey(r.value) || { pos: 0, minor: false }), label: r.label }));
export const fromDrafts = (keys: KeyDraft[]) =>
  keys.map(k => ({ kind: 'key' as const, value: keyName(k.pos, k.minor), label: k.label.trim() }));

/** "G → A（サビ）" */
export function keysText(rows: { value: string; label: string }[], locale: 'en' | 'ja'): string {
  return rows.map(r => (r.label ? (locale === 'ja' ? `${r.value}（${r.label}）` : `${r.value} (${r.label})`) : r.value)).join(' → ');
}

export default function KeysEditor({ s, keys, onChange }: {
  s: AdminStrings;
  keys: KeyDraft[];
  onChange: (k: KeyDraft[]) => void;
}) {
  const set = (i: number, patch: Partial<KeyDraft>) => onChange(keys.map((k, j) => (j === i ? { ...k, ...patch } : k)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= keys.length) return;
    const next = [...keys];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="lu-keys">
      <p className="lu-hint lu-hint-top">🔒 {s.videosPrivate} {s.keysHint}</p>
      {keys.map((k, i) => (
        <div key={i} className="lu-key-row">
          <div className="lu-key-head">
            <strong className="lu-key-name">{keyName(k.pos, k.minor)}</strong>
            <input className="lu-key-label" placeholder={s.keyLabel} value={k.label} aria-label={s.keyLabel} onChange={e => set(i, { label: e.target.value })} />
            <button type="button" className="lu-icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={s.moveUp}>↑</button>
            <button type="button" className="lu-icon-btn" onClick={() => move(i, 1)} disabled={i === keys.length - 1} aria-label={s.moveDown}>↓</button>
            <button type="button" className="lu-icon-btn is-danger" onClick={() => onChange(keys.filter((_, j) => j !== i))} aria-label={s.remove}>✕</button>
          </div>
          <div className="lu-key-notes" role="radiogroup" aria-label={s.keyNote}>
            {(k.minor ? MINOR_NOTES : NOTES).map((n, pos) => (
              <button key={n} type="button" role="radio" aria-checked={k.pos === pos}
                className={`lu-key-note${k.pos === pos ? ' is-on' : ''}`} onClick={() => set(i, { pos })}>
                {n}
              </button>
            ))}
            <button type="button" aria-pressed={k.minor} className={`lu-key-note lu-key-minor${k.minor ? ' is-on' : ''}`}
              onClick={() => set(i, { minor: !k.minor })} title={s.keyMinor}>m</button>
          </div>
        </div>
      ))}
      <button type="button" className="lu-btn" onClick={() => onChange([...keys, keys.length ? { ...keys[keys.length - 1], label: '' } : { pos: 7, minor: false, label: '' }])}>
        + {s.keyAdd}
      </button>
    </div>
  );
}
