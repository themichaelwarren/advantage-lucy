import { useAuth } from '../../contexts/AuthContext';
import { useAdminT } from '../../i18n/admin';

export default function AdminLogin() {
  const { login, isLoading, authError } = useAuth();
  const { s } = useAdminT();

  return (
    <div className="admin-shell ad-shell">
      <div className="ad-login">
        <span className="ad-brand band-name">{s.brand}</span>
        <h1>{s.signInTitle}</h1>
        <p>{s.signInBody}</p>
        {authError && <div className="ad-alert">{authError}</div>}
        <button className="ad-btn ad-btn-primary ad-btn-lg" onClick={login} disabled={isLoading}>
          {isLoading ? s.loading : s.signIn}
        </button>
      </div>
    </div>
  );
}
