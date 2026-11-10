import { PageHeading } from '../../components/common/PageHeading';
import ProfileDetailsCard from '../../components/settings/ProfileDetailsCard';
import PrivacySecurityCard from '../../components/settings/PrivacySecurityCard';
import ConnectedDevicesCard from '../../components/settings/ConnectedDevicesCard';
import '../../styles/account-settings.css';

export default function AccountSettingsPage() {
  return (
    <div className="stack settings-page">
      <PageHeading title="Account settings" description="Manage profile, security, sessions, and connected hardware." />
      <div className="settings-grid">
        <ProfileDetailsCard />
        <PrivacySecurityCard />
        <ConnectedDevicesCard />
      </div>
    </div>
  );
}
