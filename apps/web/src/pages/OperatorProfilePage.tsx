import { Link } from 'react-router-dom';
import BackgroundLayout from '../components/common/BackgroundLayout';
import ProfileDetailsCard from '../components/settings/ProfileDetailsCard';
import { getCurrentUser } from '../services/authService';

export default function OperatorProfilePage() {
  const user = getCurrentUser();
  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Operator';
  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : 'OP';

  return (
    <BackgroundLayout>
      <div className="auth-content settings-content">
        <div className="settings-page page-enter">
          <header className="settings-header">
            <div>
              <h1>Operator Profile</h1>
              <Link to="/operator" className="operator-profile-back">Back to dashboard</Link>
            </div>
            <div className="user-pill">
              <span className="avatar" aria-hidden="true">{initials}</span>
              <span>{fullName}</span>
            </div>
          </header>
          <div className="operator-profile-grid">
            <ProfileDetailsCard />
          </div>
        </div>
      </div>
    </BackgroundLayout>
  );
}
