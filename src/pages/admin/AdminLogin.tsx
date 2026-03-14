import { useAuth } from '../../contexts/AuthContext';

export default function AdminLogin() {
  const { login, isLoading, authError } = useAuth();

  return (
    <div className="admin-shell">
      <div className="admin-login">
        <h1>aL Admin</h1>
        <p>Sign in with Google to manage the site.</p>
        {authError && <div className="admin-error">{authError}</div>}
        <button
          className="admin-btn admin-btn-primary"
          onClick={login}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  );
}
