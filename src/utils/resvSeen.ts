/**
 * "New" reservations: fans' bookings (made or changed on the site) that nobody
 * in the band has marked 確認済み yet. Saved in the sheet (Reservations
 * `checked`), so everyone sees the same. Bookings added by hand or imported
 * from the Google Form never count as new.
 */
import type { Reservation } from '../services/adminService';

export const isFanBooking = (r: Reservation) => r.source === 'web' && r.status !== 'cancelled';
export const needsCheck = (r: Reservation) => isFanBooking(r) && r.checked !== 'TRUE';
