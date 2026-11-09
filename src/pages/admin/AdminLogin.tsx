import { useAuth } from '../../contexts/AuthContext';
import { useAdminT } from '../../i18n/admin';

export default function AdminLogin() {
  const { login, isLoading, authError } = useAuth();
  const { s } = useAdminT();

  return (
    <div className="admin-shell lu-shell">
      <div className="lu-login">
        <img className="lu-login-art" src="/img/lucy-drum.png" alt="" width="220" height="220" />
        <span className="lu-brand band-name">{s.brand}</span>
        <h1>{s.signInTitle}</h1>
        <p>{s.signInBody}</p>
        {authError && <div className="lu-alert">{authError}</div>}
        <button className="lu-btn lu-btn-primary lu-btn-lg" onClick={login} disabled={isLoading}>
          {isLoading ? s.loading : s.signIn}
        </button>
      </div>
    </div>
  );
}
