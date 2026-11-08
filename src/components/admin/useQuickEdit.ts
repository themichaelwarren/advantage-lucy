import { useCallback, useEffect, useRef, useState } from 'react';
import { updateRow } from '../../services/adminService';
import { errorText } from './ui';

/**
 * Optimistic "save as you toggle" for admin tables. Keeps a local copy of
 * the items, applies a change at once, writes the full row (via `toRow`, so
 * no column gets blanked), and rolls back if the save fails.
 */
export function useQuickEdit<T extends { id: string }>(
  loaded: T[],
  tab: string,
  toRow: (item: T) => Record<string, string>,
) {
  const [items, setItems] = useState<T[]>(loaded);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [rowState, setRowState] = useState<Record<string, string>>({}); // 'saving' | 'saved' | error text
  useEffect(() => { setItems(loaded); }, [loaded]);

  /** Change one item (and optionally others, e.g. "only one About photo"); saves full rows. */
  const save = useCallback(async (id: string, patch: Partial<T>, alsoChange: T[] = []) => {
    const before = itemsRef.current;
    const current = before.find(it => it.id === id);
    if (!current) return;
    const next = { ...current, ...patch } as T;
    setItems(before.map(it => (it.id === id ? next : alsoChange.find(a => a.id === it.id) || it)));
    setRowState(r => ({ ...r, [id]: 'saving' }));
    try {
      await updateRow(tab, id, toRow(next));
      for (const other of alsoChange) await updateRow(tab, other.id, toRow(other));
      setRowState(r => ({ ...r, [id]: 'saved' }));
      window.setTimeout(() => setRowState(r => (r[id] === 'saved' ? { ...r, [id]: '' } : r)), 2500);
    } catch (err) {
      setItems(before);
      setRowState(r => ({ ...r, [id]: errorText(err) }));
    }
  }, [tab, toRow]);

  return { items, setItems, save, rowState };
}
