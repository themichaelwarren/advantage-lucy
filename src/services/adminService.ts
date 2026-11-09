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

async function adminFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, withAuth(options));
  if (res.status === 401) {
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
