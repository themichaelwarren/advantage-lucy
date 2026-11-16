/**
 * "New" reservations: fans' bookings (made or changed on the site) since this
 * device last opened 予約. Remembered per device, like unread mail; nothing is
 * written to the sheet. Bookings added by hand or imported from the Google
 * Form never count as new.
 */
import type { Reservation } from '../services/adminService';

const KEY = 'lu-resv-seen';

/** When 予約 was last opened here (ISO). The very first time: now, so old bookings don't all show as new. */
export function lastSeen(): string {
  try {
    const v = localStorage.getItem(KEY);
    if (v) return v;
    const now = new Date().toISOString();
    localStorage.setItem(KEY, now);
    return now;
  } catch { return new Date().toISOString(); }
}

/** 予約 was opened: everything up to now counts as seen (the sidebar badge clears). */
export function markSeen() {
  try { localStorage.setItem(KEY, new Date().toISOString()); } catch { /* private mode */ }
  window.dispatchEvent(new Event('lu-resv-seen'));
}

export const isFanBooking = (r: Reservation) => r.source === 'web' && r.status !== 'cancelled';
export const isNewSince = (r: Reservation, seen: string) => isFanBooking(r) && (r.received_at || '') > seen;
