import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/** Allowed admin emails. Client-side gate only — real security is server-side service account keys. */
const ALLOWED_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

interface User {
  email: string;
  name: string;
  picture: string;
}

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  authError: string | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  accessToken: null,
  isLoading: true,
  authError: null,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(null);

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

      if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(info.email?.toLowerCase())) {
        setAuthError(`${info.email} is not authorized for admin access.`);
        google.accounts.oauth2.revoke(response.access_token);
        setIsLoading(false);
        return;
      }

      setUser({ email: info.email, name: info.name || info.email, picture: info.picture || '' });
      setAccessToken(response.access_token);
      setAuthError(null);

      // Auto-clear token before expiry
      setTimeout(() => {
        setAccessToken(null);
      }, (response.expires_in - 60) * 1000);
    } catch (err) {
      setAuthError(`Auth failed: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    tokenClientRef.current?.requestAccessToken({ prompt: 'consent' });
  }, []);

  const logout = useCallback(() => {
    if (accessToken) google.accounts.oauth2.revoke(accessToken);
    setUser(null);
    setAccessToken(null);
    setAuthError(null);
  }, [accessToken]);

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, authError, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
