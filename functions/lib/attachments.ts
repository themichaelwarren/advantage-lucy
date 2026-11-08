/**
 * Photo attachments on public submissions (e.g. a snap of a setlist).
 *
 * Safety rules:
 *  - at most MAX_FILES images, each at most MAX_BYTES
 *  - the file's real type is checked from its first bytes (JPEG/PNG/WebP
 *    only), never trusted from the name or the browser's claim
 *  - stored under the private "submissions/" prefix, which the public
 *    /api/images/* route refuses to serve; only admins can view them
 *    (api/admin/attachment/[name].ts)
 */
export const MAX_FILES = 3;
export const MAX_BYTES = 5 * 1024 * 1024;
export const SUBMISSIONS_PREFIX = 'submissions/';

type Kind = { ext: string; type: string };

/** Identify an image from its magic bytes. */
export function sniffImage(bytes: Uint8Array): Kind | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: 'png', type: 'image/png' };
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return { ext: 'webp', type: 'image/webp' };
  return null;
}

export interface CheckedFile { bytes: Uint8Array; kind: Kind }

/** Validate uploaded files. Returns an error code for the form, or the files. */
export async function checkFiles(files: File[]): Promise<{ ok: true; files: CheckedFile[] } | { ok: false; error: string }> {
  const real = files.filter(f => f && typeof f !== 'string' && f.size > 0);
  if (real.length > MAX_FILES) return { ok: false, error: 'too_many_files' };
  const out: CheckedFile[] = [];
  for (const f of real) {
    if (f.size > MAX_BYTES) return { ok: false, error: 'file_too_big' };
    const bytes = new Uint8Array(await f.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) return { ok: false, error: 'file_type' };
    out.push({ bytes, kind });
  }
  return { ok: true, files: out };
}

/** Private storage names for a message's files: "<messageId>-1.jpg", … */
export function attachmentNames(messageId: string, files: CheckedFile[]): string[] {
  return files.map((f, i) => `${messageId}-${i + 1}.${f.kind.ext}`);
}

/** Only names we generate are valid (no slashes, no path tricks). */
export function isAttachmentName(name: string): boolean {
  return /^[0-9]{14}-[a-z0-9]{5}-[1-9]\.(jpg|png|webp)$/.test(name);
}

/**
 * Best-effort rate limit per IP using the edge cache (per data centre, so
 * not exact, but enough to blunt a flood). Returns true if allowed.
 */
export async function allowSubmission(ip: string | null, limit = 5, windowSeconds = 600): Promise<boolean> {
  if (!ip || typeof caches === 'undefined') return true;
  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(`https://rate-limit.internal/contact/${encodeURIComponent(ip)}`);
  const hit = await cache.match(key);
  const count = hit ? Number(await hit.text()) || 0 : 0;
  if (count >= limit) return false;
  await cache.put(key, new Response(String(count + 1), { headers: { 'Cache-Control': `max-age=${windowSeconds}` } }));
  return true;
}
