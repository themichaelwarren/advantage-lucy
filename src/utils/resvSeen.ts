/**
 * "New" reservations: fans' bookings (made or changed on the site) since this
 * device last opened 予約. Remembered per device, like unread mail; nothing is
 * written to the sheet. Bookings added by hand or imported from the Google
 * Form never count as new.
 */
import type { Reservation } from '../services/adminService';

const KEY = 'lu-resv-seen';

/** When 予約 was last opened here (ISO). The very first time: two days ago, so the latest bookings
 *  count as new (and the badge shows it works) without every old booking doing so. */
export function lastSeen(): string {
  try {
    const v = localStorage.getItem(KEY);
    if (v) return v;
    const start = new Date(Date.now() - 2 * 86400000).toISOString();
    localStorage.setItem(KEY, start);
    return start;
  } catch { return new Date(Date.now() - 2 * 86400000).toISOString(); }
}

/** 予約 was opened: everything up to now counts as seen (the sidebar badge clears). */
export function markSeen() {
  try { localStorage.setItem(KEY, new Date().toISOString()); } catch { /* private mode */ }
  window.dispatchEvent(new Event('lu-resv-seen'));
}

export const isFanBooking = (r: Reservation) => r.source === 'web' && r.status !== 'cancelled';
export const isNewSince = (r: Reservation, seen: string) => isFanBooking(r) && (r.received_at || '') > seen;
