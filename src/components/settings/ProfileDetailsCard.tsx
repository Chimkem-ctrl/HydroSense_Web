import { useState } from 'react';
import GlassPanel from '../common/GlassPanel';
import { getCurrentUser, SUBSCRIBED_HATCHERIES } from '../../services/authService';
import ToggleSwitch from './ToggleSwitch';

export default function ProfileDetailsCard() {
  const user = getCurrentUser();
  const hatchery = SUBSCRIBED_HATCHERIES.find((item) => item.id === user?.hatcheryId);
  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Account details unavailable';
  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : 'HS';
  const [prefs, setPrefs] = useState({
    critical: true,
    weekly: false,
    maintenance: false,
  });
  const [notice, setNotice] = useState('');

  const setPref = (key: keyof typeof prefs) => (value: boolean) =>
    setPrefs((current) => ({ ...current, [key]: value }));

  return (
    <GlassPanel className="settings-card">
      <div className="profile-identity">
        <span className="avatar avatar-lg" aria-hidden="true">
          {initials}
        </span>
        <div>
          <p className="profile-name">{fullName}</p>
          <p className="settings-muted">{user?.position ?? (user?.role === 'ADMINISTRATOR' ? 'Administrator' : 'Operator')}</p>
        </div>
      </div>

      <h3 className="settings-section-title">Profile Details</h3>
      <div className="settings-box">
        <p className="settings-info-row"><b>Email</b><span>{user?.email ?? 'Not provided'}</span></p>
        <p className="settings-info-row"><b>Employee ID</b><span>{user?.employeeId ?? 'Not provided'}</span></p>
        <p className="settings-info-row"><b>Phone</b><span>{user?.phone ?? 'Not provided'}</span></p>
        <p className="settings-info-row"><b>Position</b><span>{user?.position ?? (user?.role === 'ADMINISTRATOR' ? 'Administrator' : 'Not provided')}</span></p>
        {user?.role === 'OPERATOR' && (
          <>
            <p className="settings-info-row"><b>Hatchery</b><span>{hatchery?.name ?? 'Not provided'}</span></p>
            <p className="settings-info-row"><b>Address</b><span>{user.address || 'Not provided'}</span></p>
            <p className="settings-info-row"><b>Emergency contact</b><span>{user.emergencyContactName || 'Not provided'}</span></p>
            <p className="settings-info-row"><b>Emergency contact phone</b><span>{user.emergencyContactPhone || 'Not provided'}</span></p>
          </>
        )}
      </div>

      <h3 className="settings-section-title">Notification Preferences</h3>
      <div className="settings-box">
        <ToggleSwitch
          id="pref-critical"
          label="Critical Alerts"
          checked={prefs.critical}
          onChange={setPref('critical')}
        />
        <ToggleSwitch
          id="pref-weekly"
          label="Weekly Reports"
          checked={prefs.weekly}
          onChange={setPref('weekly')}
        />
        <ToggleSwitch
          id="pref-maintenance"
          label="Maintenance Reminders"
          checked={prefs.maintenance}
          onChange={setPref('maintenance')}
        />
      </div>

      <h3 className="settings-section-title">Maintenance Actions</h3>
      <div className="settings-box settings-actions">
        <button
          type="button"
          className="danger-button"
          onClick={() => setNotice('Sensor calibration requested.')}
        >
          Request Calibrate Sensors
        </button>
        <button
          type="button"
          className="danger-button"
          onClick={() => setNotice('Hardware node reboot requested.')}
        >
          Request Reboot Hardware Node
        </button>
      </div>
      {notice && (
        <p className="form-status" role="status">
          {notice}
        </p>
      )}
    </GlassPanel>
  );
}
