import { useState } from 'react';
import GlassPanel from '../common/GlassPanel';
import ToggleSwitch from './ToggleSwitch';

export default function ProfileDetailsCard() {
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
          HS
        </span>
        <div>
          <p className="profile-name">Hatchery Staff</p>
          <p className="settings-muted">Operator</p>
        </div>
      </div>

      <h3 className="settings-section-title">Profile Details</h3>
      <div className="settings-box">
        <p className="settings-info-row">hatcherystaff@gmail.com</p>
        <p className="settings-info-row">+63 9673 435 1738</p>
        <p className="settings-info-row">Sagay, Camiguin, Philippines</p>
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
