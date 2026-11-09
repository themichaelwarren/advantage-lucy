import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { setAdminToken, setOnAuthExpired } from '../services/adminService';

/**
 * Who may use the admin is decided only on the server (VITE_ADMIN_EMAILS,
 * checked in functions/lib/adminAuth.ts). The list is never in the browser
 * code, so the band's addresses aren't published; after Google sign-in we
 * just ask the server (/api/admin/whoami).
 */

const SESSION_KEY = 'admin-session';

interface User {
  email: string;
  name: string;
  picture: string;
}

interface StoredSession {
  user: User;
  token: string;
  expiresAt: number; // ms epoch
}

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  authError: string | null;
  /** Signed in earlier, but the one-hour Google token has run out. */
  sessionExpired: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  accessToken: null,
  isLoading: true,
  authError: null,
  sessionExpired: false,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

// The session lives in localStorage: it survives reloads, new tabs and
// moving between pages until the one-hour Google token expires.
function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    return s?.user && s.token ? s : null;
  } catch {
    return null;
  }
}
function writeSession(s: StoredSession | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* storage blocked: sign-in still works for this page view */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = readSession();
  const initialValid = initial && initial.expiresAt > Date.now() + 30_000 ? initial : null;
  // Hand the saved token to the data layer right away, before any page asks
  // for admin data (child effects run before ours)
  useState(() => { setAdminToken(initialValid?.token ?? null); return null; });

  // Dev-only UI preview: `?preview-admin` on the local dev server shows the
  // admin screens without Google sign-in. import.meta.env.DEV is false in
  // production builds, so this is stripped from the live site; and the
  // server still rejects every save without a real token.
  const preview = import.meta.env.DEV && new URLSearchParams(location.search).has('preview-admin');

  const [user, setUser] = useState<User | null>(
    preview ? { email: 'preview@localhost', name: 'Preview', picture: '' } : initial?.user ?? null
  );
  const [accessToken, setAccessToken] = useState<string | null>(initialValid?.token ?? null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(null);
  const expiryTimer = useRef<number | undefined>(undefined);

  const scheduleExpiry = useCallback((expiresAt: number) => {
    window.clearTimeout(expiryTimer.current);
    expiryTimer.current = window.setTimeout(() => setAccessToken(null), Math.max(0, expiresAt - Date.now() - 60_000));
  }, []);

  useEffect(() => {
    if (initialValid) scheduleExpiry(initialValid.expiresAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTokenResponse = useCallback(async (response: google.accounts.oauth2.TokenResponse) => {
    if (response.error) {
      setAuthError(response.error_description || response.error);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${response.access_token}` },
      });
      const info = await res.json();

      const who = await fetch('/api/admin/whoami', { headers: { Authorization: `Bearer ${response.access_token}` } });
      if (!who.ok) {
        setAuthError(`${info.email} is not authorized for admin access.`);
        google.accounts.oauth2.revoke(response.access_token);
        setIsLoading(false);
        return;
      }

      const signedIn: User = { email: info.email, name: info.name || info.email, picture: info.picture || '' };
      const expiresAt = Date.now() + Number(response.expires_in) * 1000;
      // Give the data layer the token now: the admin pages appear on the next
      // render and fetch straight away, before any effect of ours would run
      setAdminToken(response.access_token);
      setUser(signedIn);
      setAccessToken(response.access_token);
      setAuthError(null);
      writeSession({ user: signedIn, token: response.access_token, expiresAt });
      scheduleExpiry(expiresAt);
    } catch (err) {
      setAuthError(`Auth failed: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }, [scheduleExpiry]);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setIsLoading(false);
      return;
    }

    function init() {
      tokenClientRef.current = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile https://www.googleapis.com/auth/drive.file',
        callback: handleTokenResponse,
        error_callback: (err) => {
          console.error('[auth] GIS error:', err);
          setIsLoading(false);
        },
      });
      setIsLoading(false);
    }

    if (typeof google !== 'undefined' && google.accounts?.oauth2) {
      init();
    } else {
      const check = setInterval(() => {
        if (typeof google !== 'undefined' && google.accounts?.oauth2) {
          clearInterval(check);
          init();
        }
      }, 100);
      setTimeout(() => { clearInterval(check); setIsLoading(false); }, 10000);
    }
  }, [handleTokenResponse]);

  const login = useCallback(() => {
    setAuthError(null);
    // No forced consent screen: Google only asks again if something changed.
    // login_hint skips the account chooser when re-signing in the same person.
    tokenClientRef.current?.requestAccessToken({ prompt: '', login_hint: user?.email });
  }, [user?.email]);

  const logout = useCallback(() => {
    if (accessToken) google.accounts.oauth2.revoke(accessToken);
    window.clearTimeout(expiryTimer.current);
    writeSession(null);
    setUser(null);
    setAccessToken(null);
    setAuthError(null);
  }, [accessToken]);

  // Admin API calls read the token from adminService, and tell us when the
  // server says it's no longer valid.
  useEffect(() => { setAdminToken(accessToken); }, [accessToken]);
  useEffect(() => { setOnAuthExpired(() => setAccessToken(null)); }, []);

  const sessionExpired = !!user && !accessToken && !preview;

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, authError, sessionExpired, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
