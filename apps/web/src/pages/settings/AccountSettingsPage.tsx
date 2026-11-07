import { useState } from 'react';
import BackgroundLayout from '../../components/common/BackgroundLayout';
import ProfileDetailsCard from '../../components/settings/ProfileDetailsCard';
import PrivacySecurityCard from '../../components/settings/PrivacySecurityCard';
import ConnectedDevicesCard from '../../components/settings/ConnectedDevicesCard';
import AuditTrailModal from '../../components/settings/AuditTrailModal';
import { getCurrentUser } from '../../services/authService';

export default function AccountSettingsPage() {
  const [auditOpen, setAuditOpen] = useState(false);
  const user = getCurrentUser();
  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Administrator';
  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : 'AD';

  return (
    <BackgroundLayout>
      <div className="auth-content settings-content">
        <div className="settings-page page-enter">
          <header className="settings-header">
            <h1>Account Settings</h1>
            <div className="user-pill">
              <span className="avatar" aria-hidden="true">
                {initials}
              </span>
              <span>{fullName}</span>
            </div>
          </header>
          <div className="settings-grid">
            <ProfileDetailsCard />
            <PrivacySecurityCard onViewAuditTrail={() => setAuditOpen(true)} />
            <ConnectedDevicesCard />
          </div>
        </div>
      </div>
      <AuditTrailModal open={auditOpen} onClose={() => setAuditOpen(false)} />
    </BackgroundLayout>
  );
}
