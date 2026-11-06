import type { ManagedUser } from './profileData';

interface AdminManagementProps {
  users: ManagedUser[];
  onChange: (id: string, status: ManagedUser['status']) => void;
}

const action = {
  pending: { label: 'Approve', next: 'active' as const, cls: 'approve' },
  active: { label: 'Deactivate', next: 'inactive' as const, cls: 'deactivate' },
  inactive: { label: 'Reactivate', next: 'active' as const, cls: 'reactivate' },
};

export default function AdminManagement({ users, onChange }: AdminManagementProps) {
  return (
    <section className="dashboard-card profile-card" aria-label="User management">
      <h2 className="profile-card-title">User Management</h2>
      {users.length === 0 && <p className="profile-empty">No users match your search.</p>}
      <ul className="user-list">
        {users.map((user) => {
          const act = action[user.status];
          return (
            <li key={user.id} className="user-item">
              <div className="user-item-top">
                <strong>{user.email}</strong>
                <span className={`user-role user-role--${user.role.toLowerCase()}`}>{user.role}</span>
              </div>
              <div className="user-item-meta">
                <span><i className={`user-dot user-dot--${user.status}`} />{user.name}</span>
                <span>Joined {user.joined}</span>
              </div>
              <button type="button" className={`user-action user-action--${act.cls}`} onClick={() => onChange(user.id, act.next)}>
                {act.label}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
