import { useEffect, useState } from 'react';
import { getFilters, type Filters } from '../services/adminService';
import { matchSender, type SenderMatch } from '../../functions/lib/filters';

/**
 * The filtered-senders list, shared by Messages, a message's page and
 * Reservations (loaded once; a save updates every page using it).
 */
let cache: Filters | null = null;
let loading: Promise<Filters> | null = null;
const listeners = new Set<(f: Filters) => void>();

/** The list, loaded once and shared (for code outside a component). */
export function loadFiltersOnce(): Promise<Filters> {
  if (cache) return Promise.resolve(cache);
  loading ??= getFilters();
  return loading.then(f => { setFilters(f); return f; }).catch(() => { const f = { emails: [], forwardTo: '', rows: [] }; setFilters(f); return f; }).finally(() => { loading = null; });
}

/** Messages minus filtered senders (for "new" counts). */
export async function withoutFiltered<T extends { email?: string }>(list: T[]): Promise<T[]> {
  const f = await loadFiltersOnce();
  return list.filter(m => matchSender(m.email || '', f.emails)?.kind !== 'filtered');
}

export function setFilters(f: Filters) {
  cache = f;
  listeners.forEach(l => l(f));
}

export function useFilters() {
  const [filters, set] = useState<Filters | null>(cache);
  useEffect(() => {
    listeners.add(set);
    if (!cache) loadFiltersOnce();
    return () => { listeners.delete(set); };
  }, []);
  const match = (email?: string): SenderMatch => (filters && email ? matchSender(email, filters.emails) : null);
  return { filters, match };
}
