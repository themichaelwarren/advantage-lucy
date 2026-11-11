/** Client-side helpers for admin write operations. */

import { cache } from './sheetsService';
import { getAdminToken, setAdminTokenValue, setOnAdminAuthExpired, adminAuthExpired } from './adminToken';

// The signed-in admin's Google access token, kept in sync by AuthContext.
// Every admin request carries it; the server checks it with Google.
export const setAdminToken = (token: string | null) => setAdminTokenValue(token);

// Called when the server rejects our sign-in, so the UI can offer "sign in again"
export const setOnAuthExpired = (fn: (() => void) | null) => setOnAdminAuthExpired(fn);

export class AuthExpiredError extends Error {}

function withAuth(options: RequestInit = {}): RequestInit {
  const headers = new Headers(options.headers);
  const accessToken = getAdminToken();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return { ...options, headers };
}

async function adminFetch(url: string, options?: RequestInit, retried = false): Promise<any> {
  const sentWith = getAdminToken();
  const res = await fetch(url, withAuth(options));
  if (res.status === 401) {
    // Sent with an older token (or none) and the sign-in has changed since:
    // try once more with the current one instead of crying "expired"
    if (!retried && getAdminToken() && getAdminToken() !== sentWith) return adminFetch(url, options, true);
    adminAuthExpired();
    const body = await res.json().catch(() => ({}));
    throw new AuthExpiredError(body.error || 'Please sign in again.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Admin API error: ${res.status}`);
  }
  return res.json();
}

export async function createRow(tab: string, fields: Record<string, string>) {
  const result = await adminFetch(`/api/admin/${tab}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  invalidateCache(tab);
  return result;
}

export async function updateRow(tab: string, id: string, fields: Record<string, string>) {
  const result = await adminFetch(`/api/admin/${tab}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, fields }),
  });
  invalidateCache(tab);
  return result;
}

/** Put a tab's rows in this order (by id). The sheet's row order is the site's order. */
export async function reorderRows(tab: string, ids: string[]) {
  const result = await adminFetch(`/api/admin/${tab}/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  invalidateCache(tab);
  return result;
}

export async function deleteRow(tab: string, id: string) {
  const result = await adminFetch(`/api/admin/${tab}?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  invalidateCache(tab);
  return result;
}

/** Bulk replace: delete all rows where col A = key, then append new rows. */
export async function replaceRows(tab: string, key: string, rows: Record<string, string>[]) {
  const result = await adminFetch(`/api/admin/${tab}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, rows }),
  });
  invalidateCache(tab);
  return result;
}

export type MessageStatus = '' | 'doing' | 'done';

/** Set a message's status: '' (new), 'doing' (in progress) or 'done'. */
export async function setMessageStatus(id: string, status: MessageStatus) {
  return adminFetch('/api/admin/messages', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  });
}

/** Contact form messages, newest first (admin only). */
export async function getMessages(): Promise<Record<string, string>[]> {
  const data = await adminFetch('/api/admin/messages');
  return data.messages || [];
}

/** A private photo attached to a message, as a temporary object URL (admin only). */
export async function getAttachmentUrl(name: string): Promise<string> {
  const res = await fetch(`/api/admin/attachment/${encodeURIComponent(name)}`, withAuth());
  if (res.status === 401) { adminAuthExpired(); throw new AuthExpiredError('Please sign in again.'); }
  if (!res.ok) throw new Error(`Couldn’t load photo (${res.status})`);
  return URL.createObjectURL(await res.blob());
}

export async function getHeaders(tab: string): Promise<string[]> {
  const data = await adminFetch(`/api/admin/${tab}/headers`);
  return data.headers;
}

/** Upload a file to R2 (prod) or local (dev). Returns the image URL. */
export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload', withAuth({
    method: 'POST',
    body: formData,
  }));

  if (res.status === 401) {
    adminAuthExpired();
    throw new AuthExpiredError('Please sign in again.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }

  const data = await res.json();
  return data.url; // /api/images/<key> (R2) or /uploads/<key> (dev)
}

/** Invalidate client-side cache so re-fetches pick up changes. */
function invalidateCache(tab: string) {
  const key = tab.toLowerCase();
  delete (cache as Record<string, unknown>)[key];
  delete (cache as Record<string, unknown>)[`admin:${key}`];
}

export type Reservation = {
  id: string; event: string; received_at: string; locale: string; name: string; email: string;
  tickets: string; note: string; status: string; emailed: string; arrived: string; source: string;
};

/** Every ticket reservation, oldest first (admin only). */
export async function getReservations(): Promise<Reservation[]> {
  const data = await adminFetch('/api/admin/reservations');
  return data.reservations || [];
}

/** Change a reservation: name, email, tickets, note, status ('' | 'cancelled') or arrived ('TRUE' | ''). */
export async function updateReservation(id: string, fields: Partial<Reservation>): Promise<Reservation> {
  const data = await adminFetch('/api/admin/reservations', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, fields }),
  });
  return data.reservation;
}

/** Add a reservation by hand (DM, phone…); optionally email them the confirmation. */
export async function addReservation(fields: Partial<Reservation>, sendEmail: boolean): Promise<Reservation> {
  const data = await adminFetch('/api/admin/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields, send_email: sendEmail }),
  });
  return data.reservation;
}

/** Send the confirmation email again. */
export async function resendReservation(id: string): Promise<Reservation> {
  const data = await adminFetch('/api/admin/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resend: id }),
  });
  return data.reservation;
}

// ── Media (admin only: videos of shows and songs, see functions/lib/media.ts) ──

export interface MediaRow {
  owner: string;   // event id, or "song:<song id>"
  kind: 'show' | 'part' | 'song';
  url: string;
  song: string;    // part: the song's title, as in setlists
  start: string;   // part: seconds into the video
  title: string;
  note: string;
}

export async function getMedia(): Promise<MediaRow[]> {
  const out = await adminFetch('/api/admin/media') as { media: MediaRow[] };
  return out.media;
}

/** A YouTube video's title ('' if it can't be found). */
export async function getVideoTitle(url: string): Promise<string> {
  try {
    const out = await adminFetch(`/api/admin/media?title=${encodeURIComponent(url)}`) as { title: string };
    return out.title || '';
  } catch {
    return '';
  }
}

/** Replace everything a show (event id) or song ("song:<id>") owns. */
export async function saveMedia(owner: string, rows: Partial<MediaRow>[]): Promise<MediaRow[]> {
  const out = await adminFetch('/api/admin/media', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, rows }),
  }) as { media: MediaRow[] };
  return out.media;
}

// ── Arrangements (admin only: keys etc., see functions/lib/arrangements.ts) ──

export interface ArrangementRow { song: string; kind: 'key'; value: string; label: string; note: string }

export async function getArrangements(): Promise<ArrangementRow[]> {
  const out = await adminFetch('/api/admin/arrangements') as { arrangements: ArrangementRow[] };
  return out.arrangements;
}

/** Replace a song's arrangement rows (in this order). */
export async function saveArrangements(song: string, rows: Partial<ArrangementRow>[]): Promise<ArrangementRow[]> {
  const out = await adminFetch('/api/admin/arrangements', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ song, rows }),
  }) as { arrangements: ArrangementRow[] };
  return out.arrangements;
}

// ── Filtered senders (admin only, see functions/lib/filters.ts) ──

export interface FilterRow { kind: 'email' | 'forward'; value: string; note: string; added: string }
export interface Filters { emails: string[]; forwardTo: string; rows: FilterRow[] }

export async function getFilters(): Promise<Filters> {
  return await adminFetch('/api/admin/filters') as Filters;
}

/** Replace the list of filtered addresses. */
export async function saveFilterEmails(rows: { value: string; note?: string; added?: string }[]): Promise<Filters> {
  return await adminFetch('/api/admin/filters', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'email', rows }),
  }) as Filters;
}

/** Where a filtered sender's messages are emailed ('' = nowhere). */
export async function saveFilterForward(value: string): Promise<Filters> {
  return await adminFetch('/api/admin/filters', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'forward', value }),
  }) as Filters;
}

// ── Lyrics docs: which have text (admin only, see functions/lib/lyricsStatus.ts) ──
export async function getLyricsStatus(fresh = false): Promise<{ status: Record<string, 'text' | 'empty' | 'error'>; checkedAt: string }> {
  return await adminFetch(`/api/admin/lyrics-status${fresh ? '?fresh=1' : ''}`) as { status: Record<string, 'text' | 'empty' | 'error'>; checkedAt: string };
}

// ── Are video and listen links still alive? (admin only, see functions/lib/linkCheck.ts) ──
export type LinkState = 'ok' | 'gone' | 'private' | 'broken' | 'unknown';
export interface LinkCheck { videos: Record<string, LinkState>; listen: Record<string, LinkState>; checkedAt: string }
let linkCheck: Promise<LinkCheck> | null = null;
/** Shared by every page that asks (the server keeps the result for 6 hours). */
export function getLinkCheck(fresh = false): Promise<LinkCheck> {
  if (fresh || !linkCheck) linkCheck = adminFetch(`/api/admin/link-check${fresh ? '?fresh=1' : ''}`).then(r => r as LinkCheck).catch(err => { linkCheck = null; throw err; });
  return linkCheck;
}
/** Dead: deleted, private, or a page that's gone (not "couldn't check"). */
export const isDeadLink = (state?: LinkState) => state === 'gone' || state === 'private' || state === 'broken';
