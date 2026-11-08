/**
 * Server-side admin check, shared by the Cloudflare Functions and the
 * local Vite dev server (server/vite-plugin-sheets.ts).
 *
 * The admin UI signs people in with Google and sends the resulting access
 * token as `Authorization: Bearer <token>`. We ask Google who the token
 * belongs to, and only allow it when:
 *   - it was issued to *our* OAuth client (not some other app's token), and
 *   - its email is verified and on the admin list (VITE_ADMIN_EMAILS).
 *
 * Plain fetch only, so it runs on Workers and Node alike.
 */

export interface AdminAuthConfig {
  clientId?: string;
  adminEmails?: string;
}

export type AdminCheck =
  | { ok: true; email: string }
  | { ok: false; status: 401 | 403 | 500; error: string };

interface TokenInfo {
  aud?: string;
  azp?: string;
  email?: string;
  email_verified?: string | boolean;
  expires_in?: string;
  error_description?: string;
}

// Verified tokens, so a burst of saves doesn't call Google every time.
// Per-isolate on Workers; entries expire with the token or after 5 minutes.
const verified = new Map<string, { email: string; until: number }>();

export async function checkAdmin(authHeader: string | null | undefined, config: AdminAuthConfig): Promise<AdminCheck> {
  const allowed = (config.adminEmails || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  if (!config.clientId || allowed.length === 0) {
    // Fail closed: never allow writes because configuration is missing
    return { ok: false, status: 500, error: 'Admin access is not configured on the server.' };
  }

  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { ok: false, status: 401, error: 'Please sign in to make changes.' };

  const hit = verified.get(token);
  if (hit && hit.until > Date.now()) return { ok: true, email: hit.email };

  let info: TokenInfo;
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
    info = await res.json();
    if (!res.ok) return { ok: false, status: 401, error: 'Your sign-in has expired. Please sign in again.' };
  } catch {
    return { ok: false, status: 500, error: 'Could not reach Google to check your sign-in. Try again.' };
  }

  const audience = info.aud || info.azp;
  if (audience !== config.clientId) {
    return { ok: false, status: 401, error: 'This sign-in was not made for this site.' };
  }
  const email = (info.email || '').toLowerCase();
  const emailVerified = info.email_verified === true || info.email_verified === 'true';
  if (!email || !emailVerified || !allowed.includes(email)) {
    return { ok: false, status: 403, error: `${email || 'This account'} is not allowed to edit the site.` };
  }

  const expiresMs = Math.max(0, Number(info.expires_in || 0) * 1000);
  verified.set(token, { email, until: Date.now() + Math.min(expiresMs, 5 * 60 * 1000) });
  if (verified.size > 200) verified.clear();
  return { ok: true, email };
}
