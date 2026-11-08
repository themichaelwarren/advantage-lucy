import { useRef, useState } from 'react';
import type { AdminStrings } from '../../i18n/admin';

export interface SetlistItem {
  key: string;     // local only, for React and drag
  song: string;    // stored as the song title, as in the existing sheet
  set: string;     // '1', '2', … or 'e', 'e2' for encores
  notes: string;
  status: string;
}

let nextKey = 0;
export const newItem = (set: string, song = ''): SetlistItem =>
  ({ key: `k${nextKey++}`, song, set, notes: '', status: 'published' });

/**
 * Songs grouped into sets. Order is simply the order on screen: drag the ⇅
 * handle (or use the arrows) to move songs, including between sets. No
 * order numbers to type.
 */
export default function SetlistEditor({ s, items, onChange, songTitles }: {
  s: AdminStrings;
  items: SetlistItem[];
  onChange: (items: SetlistItem[]) => void;
  songTitles: string[];
}) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const lastAdded = useRef<string | null>(null);

  const sets = Array.from(new Set(items.map(i => i.set)));
  if (sets.length === 0) sets.push('1');
  const label = (set: string) =>
    set === 'e' ? s.encore : set.startsWith('e') ? `${s.encore} ${set.slice(1)}` : `${s.set} ${set}`;

  const update = (key: string, patch: Partial<SetlistItem>) =>
    onChange(items.map(i => (i.key === key ? { ...i, ...patch } : i)));

  function add(set: string) {
    const item = newItem(set);
    lastAdded.current = item.key;
    // Insert after the last song of that set
    const lastIdx = items.map(i => i.set).lastIndexOf(set);
    const copy = [...items];
    copy.splice(lastIdx === -1 ? copy.length : lastIdx + 1, 0, item);
    onChange(copy);
  }

  function move(key: string, dir: -1 | 1) {
    const idx = items.findIndex(i => i.key === key);
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const copy = [...items];
    const it = copy[idx];
    const other = copy[target];
    if (it.set !== other.set) {
      // At the edge of a set: step into the neighbouring set first
      copy[idx] = { ...it, set: other.set };
    } else {
      copy[idx] = other;
      copy[target] = it;
    }
    onChange(copy);
  }

  function dropOn(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return;
    const from = items.findIndex(i => i.key === dragKey);
    const to = items.findIndex(i => i.key === targetKey);
    const copy = [...items];
    const [it] = copy.splice(from, 1);
    copy.splice(to, 0, { ...it, set: items[to].set });
    onChange(copy);
  }

  const nextSetName = () => {
    const numbered = sets.filter(x => /^\d+$/.test(x)).map(Number);
    return String((numbered.length ? Math.max(...numbered) : 0) + 1);
  };
  const nextEncoreName = () => {
    const enc = sets.filter(x => x.startsWith('e'));
    return enc.length === 0 ? 'e' : `e${enc.length + 1}`;
  };

  return (
    <div className="ad-setlist">
      <datalist id="ad-song-titles">
        {songTitles.map(t => <option key={t} value={t} />)}
      </datalist>

      {sets.map(set => {
        const rows = items.filter(i => i.set === set);
        return (
          <div key={set} className={`ad-set${set.startsWith('e') ? ' is-encore' : ''}`}>
            <h3>{label(set)}</h3>
            {rows.length === 0 && <p className="ad-hint">{s.setlistEmpty}</p>}
            <ol>
              {rows.map(row => {
                const idx = items.indexOf(row);
                return (
                  <li
                    key={row.key}
                    className={`ad-song${dragKey === row.key ? ' is-dragging' : ''}`}
                    draggable
                    onDragStart={e => { setDragKey(row.key); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); dropOn(row.key); setDragKey(null); }}
                    onDragEnd={() => setDragKey(null)}
                  >
                    <span className="ad-drag" aria-hidden="true">⇅</span>
                    <input
                      className="ad-song-title"
                      list="ad-song-titles"
                      value={row.song}
                      placeholder={s.songPlaceholder}
                      aria-label={s.songPlaceholder}
                      autoFocus={lastAdded.current === row.key}
                      onChange={e => update(row.key, { song: e.target.value })}
                      onKeyDown={e => {
                        // Enter on a filled row adds the next song: quick to type a whole set
                        if (e.key === 'Enter') { e.preventDefault(); if (row.song.trim()) add(set); }
                      }}
                    />
                    <input
                      className="ad-song-note"
                      value={row.notes}
                      placeholder={s.notes}
                      aria-label={s.notes}
                      onChange={e => update(row.key, { notes: e.target.value })}
                    />
                    <span className="ad-song-actions">
                      <button type="button" className="ad-icon-btn" onClick={() => move(row.key, -1)} disabled={idx === 0} aria-label={s.moveUp}>↑</button>
                      <button type="button" className="ad-icon-btn" onClick={() => move(row.key, 1)} disabled={idx === items.length - 1} aria-label={s.moveDown}>↓</button>
                      <button type="button" className="ad-icon-btn is-danger" onClick={() => onChange(items.filter(i => i.key !== row.key))} aria-label={s.remove}>✕</button>
                    </span>
                  </li>
                );
              })}
            </ol>
            <button type="button" className="ad-btn ad-btn-quiet" onClick={() => add(set)}>+ {s.addSong}</button>
          </div>
        );
      })}

      <div className="ad-row">
        <button type="button" className="ad-btn" onClick={() => add(nextSetName())}>+ {s.addSet}</button>
        <button type="button" className="ad-btn" onClick={() => add(nextEncoreName())}>+ {s.addEncore}</button>
      </div>
      <p className="ad-hint">{s.setlistHint}</p>
    </div>
  );
}
