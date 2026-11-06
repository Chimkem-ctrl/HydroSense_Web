import { useState } from 'react';
import { ChevronRight, LayoutDashboard, LogOut, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../components/common/Logo';
import { getMockDataByRole } from '../../data/mockRoleData';
import { sessionService } from '../../services/sessionService';
import { userService } from '../../services/userService';
import type { UserRole } from '../../types/auth.types';

export default function UserManagementPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState(() => userService.list());
  const [error, setError] = useState('');
  const me = sessionService.get();
  const { profile } = getMockDataByRole(me?.role ?? 'admin');

  function changeRole(email: string, role: UserRole) {
    try {
      setUsers(userService.setRole(me?.email ?? '', email, role));
      setError('');
      // Demoting yourself revokes access to this page.
      if (email === me?.email && role !== 'admin') navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change role.');
    }
  }

  function handleLogout() {
    sessionService.clear();
    navigate('/signin', { replace: true });
  }

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          <Logo size={34} className="dashboard-brand-logo" />
          <div><strong>HydroSense</strong><span>{profile.consoleLabel}</span></div>
        </div>
        <p className="dashboard-nav-label">WORKSPACE</p>
        <nav className="dashboard-nav" aria-label="Sections">
          <Link to="/dashboard" className="dashboard-nav-item">
            <LayoutDashboard size={17} strokeWidth={1.8} /><span>Dashboard</span>
          </Link>
          <Link to="/admin/users" className="dashboard-nav-item is-active">
            <Users size={17} strokeWidth={1.8} /><span>User Management</span>
            <span className="nav-active-mark" />
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <span className="dashboard-avatar">{profile.initials}</span>
            <div><b>{profile.fullName}</b><span>{profile.title}</span></div>
          </div>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="topbar-page-title"><span>Workspace</span><ChevronRight size={13} /><b>User Management</b></div>
          <div className="topbar-tools">
            <Link to="/dashboard" className="topbar-link"><LayoutDashboard size={15} /> Dashboard</Link>
            <Link to="/admin/users" className="topbar-link is-active"><Users size={15} /> User Management</Link>
            <button type="button" className="topbar-logout" onClick={handleLogout}><LogOut size={15} /> Log out</button>
          </div>
        </header>

        <main className="dashboard-content">
          <section className="dashboard-welcome">
            <div>
              <p className="dashboard-kicker">ADMINISTRATION</p>
              <h1>User Management<span>.</span></h1>
              <p>Review accounts and assign Admin or Operator roles.</p>
            </div>
          </section>

          <section className="dashboard-section">
            {error && <p className="form-error-banner" role="alert">{error}</p>}
            <article className="dashboard-card activity-card">
              <div className="dashboard-table-wrap">
                <table className="dashboard-table">
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Current role</th><th>Change role</th></tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.email}>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td><span className="role-badge">{user.role}</span></td>
                        <td>
                          <select
                            className="role-select"
                            value={user.role}
                            aria-label={`Role for ${user.email}`}
                            onChange={(event) => changeRole(user.email, event.target.value as UserRole)}
                          >
                            <option value="admin">Admin</option>
                            <option value="operator">Operator</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
