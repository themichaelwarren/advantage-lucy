import { Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAdminT } from '../i18n/admin';
import AdminLogin from '../pages/admin/AdminLogin';

export default function RequireAuth() {
  const { user, isLoading } = useAuth();
  const { s } = useAdminT();

  // A remembered session shows the admin straight away, even while Google's
  // sign-in script is still loading; only first-time visitors wait for it.
  if (!user && isLoading) {
    return (
      <div className="admin-shell ad-shell">
        <div className="ad-login"><p>{s.loading}</p></div>
      </div>
    );
  }

  if (!user) return <AdminLogin />;

  return <Outlet />;
}
