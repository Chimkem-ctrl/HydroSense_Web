import { useState } from 'react';
import { PageHeading } from '../../components/common/PageHeading';
import ProfileDetailsCard from '../../components/settings/ProfileDetailsCard';
import PrivacySecurityCard from '../../components/settings/PrivacySecurityCard';
import ConnectedDevicesCard from '../../components/settings/ConnectedDevicesCard';
import AuditTrailModal from '../../components/settings/AuditTrailModal';

export default function AccountSettingsPage() {
  const [auditOpen, setAuditOpen] = useState(false);

  return (
    <div className="stack settings-page page-enter">
      <PageHeading title="Account settings" description="Manage profile, security, sessions, and connected hardware." />
      <div className="settings-grid">
        <div className="settings-column">
          <ProfileDetailsCard />
        </div>
        <div className="settings-column">
          <PrivacySecurityCard onViewAuditTrail={() => setAuditOpen(true)} />
        </div>
        <div className="settings-column settings-column-wide">
          <ConnectedDevicesCard />
        </div>
      </div>
      <AuditTrailModal open={auditOpen} onClose={() => setAuditOpen(false)} />
    </div>
  );
}
