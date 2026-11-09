import { useAuth } from '../../contexts/AuthContext';
import { useAdminT } from '../../i18n/admin';

export default function AdminLogin() {
  const { login, isLoading, authError } = useAuth();
  const { s } = useAdminT();

  return (
    <div className="admin-shell lu-shell">
      <div className="lu-login">
        <img className="lu-login-art" src="/img/lucy-drum.png" alt="advantage Lucy" width="220" height="220" />
        {/* Just the drum and the button; the title stays for screen readers */}
        <h1 className="lu-visually-hidden">{s.brand}: {s.signInTitle}</h1>
        {authError && <div className="lu-alert">{authError}</div>}
        <button className="lu-btn lu-btn-primary lu-btn-lg" onClick={login} disabled={isLoading}>
          {isLoading ? s.loading : s.signIn}
        </button>
      </div>
    </div>
  );
}
