/**
 * The signed-in admin's Google access token, kept in sync by AuthContext.
 * Lives in its own module so both the data reads (sheetsService) and the
 * writes (adminService) can use it. Admin pages refetch when it changes,
 * e.g. after "sign in again".
 */
let token: string | null = null;
let version = 0;
const listeners = new Set<() => void>();
let onExpired: (() => void) | null = null;

export const getAdminToken = () => token;
export const getAdminTokenVersion = () => version;

export function setAdminTokenValue(next: string | null) {
  if (next === token) return;
  token = next;
  version++;
  listeners.forEach(fn => fn());
}

export function subscribeAdminToken(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** The server said our sign-in isn't valid (any more). */
export function setOnAdminAuthExpired(fn: (() => void) | null) { onExpired = fn; }
export function adminAuthExpired() { onExpired?.(); }
