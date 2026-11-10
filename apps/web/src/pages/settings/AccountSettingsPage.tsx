import { useState } from 'react';
import { PageHeading } from '../../components/common/PageHeading';
import ProfileDetailsCard from '../../components/settings/ProfileDetailsCard';
import PrivacySecurityCard from '../../components/settings/PrivacySecurityCard';
import ConnectedDevicesCard from '../../components/settings/ConnectedDevicesCard';
import AuditTrailModal from '../../components/settings/AuditTrailModal';
import '../../styles/account-settings.css';

export default function AccountSettingsPage() {
  const [auditOpen, setAuditOpen] = useState(false);

  return (
    <div className="stack settings-page">
      <PageHeading title="Account settings" description="Manage profile, security, sessions, and connected hardware." />
      <div className="settings-grid">
        <ProfileDetailsCard />
        <PrivacySecurityCard onViewAuditTrail={() => setAuditOpen(true)} />
        <ConnectedDevicesCard />
      </div>
      <AuditTrailModal open={auditOpen} onClose={() => setAuditOpen(false)} />
    </div>
  );
}
