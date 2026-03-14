import { Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AdminLogin from '../pages/admin/AdminLogin';

export default function RequireAuth() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="admin-shell">
        <div className="admin-login">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <AdminLogin />;

  return <Outlet />;
}
