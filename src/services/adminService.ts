/** Client-side helpers for admin write operations. */

import { cache } from './sheetsService';

async function adminFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
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

export async function getHeaders(tab: string): Promise<string[]> {
  const data = await adminFetch(`/api/admin/${tab}/headers`);
  return data.headers;
}

/** Upload a file to Google Drive. Returns the public image URL. */
export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }

  const data = await res.json();
  return data.url; // lh3.googleusercontent.com direct link
}

/** Invalidate client-side cache so re-fetches pick up changes. */
function invalidateCache(tab: string) {
  const key = tab.toLowerCase();
  delete (cache as Record<string, unknown>)[key];
}
