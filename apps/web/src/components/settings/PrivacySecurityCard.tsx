import { useState } from 'react';
import ToggleSwitch from './ToggleSwitch';

interface PrivacySecurityCardProps {
  onViewAuditTrail: () => void;
}

export default function PrivacySecurityCard({
  onViewAuditTrail,
}: PrivacySecurityCardProps) {
  const [twoFactor, setTwoFactor] = useState(false);
  const [requireOtp, setRequireOtp] = useState(false);
  const [shareLogs, setShareLogs] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);

  return (
    <section className="card settings-card" aria-labelledby="privacy-security-title">
      <h2 className="settings-card-title" id="privacy-security-title">Privacy &amp; Security</h2>

      <h3 className="settings-section-title">Security &amp; Authentication</h3>
      <div className="settings-box">
        <ToggleSwitch
          id="sec-2fa"
          label="Two-Factor Authentication (2FA)"
          checked={twoFactor}
          onChange={setTwoFactor}
        />
        <ToggleSwitch
          id="sec-otp"
          label="Require OTP for threshold changes"
          checked={requireOtp}
          onChange={setRequireOtp}
        />
        <button type="button" className="button settings-link-row">
          Change Password <span aria-hidden="true">&rsaquo;</span>
        </button>
      </div>

      <h3 className="settings-section-title">Active Sessions</h3>
      <div className="settings-box">
        <p className="session-group">
          Mobile App <em>(Current Device)</em>
        </p>
        <p className="settings-info-row">
          iPhone 17 &bull; <span className="status-good">Active Now</span>
        </p>
        <p className="settings-info-row">
          iPhone 18 &bull; <span className="status-bad">Not Active</span>
        </p>
        <p className="session-group">Web Dashboard</p>
        <p className="settings-info-row">
          Chrome - Hatchery Office &bull;{' '}
          <span className="status-bad">Not Active</span>
        </p>
        <button
          type="button"
          className="button button-danger danger-button-wide"
          onClick={() => setLoggedOut(true)}
        >
          Log Out All Sessions
        </button>
        {loggedOut && (
          <p className="form-status" role="status">
            All other sessions have been logged out.
          </p>
        )}
      </div>

      <h3 className="settings-section-title">System Log &amp; Data Access</h3>
      <div className="settings-box">
        <ToggleSwitch
          id="log-share"
          label="Share Diagnostic Logs"
          checked={shareLogs}
          onChange={setShareLogs}
        />
        <button
          type="button"
          className="button settings-link-row"
          onClick={onViewAuditTrail}
        >
          <span>
            Account Audit Trail <strong>(Admin Only)</strong>
          </span>
          <span aria-hidden="true">&rsaquo;</span>
        </button>
      </div>
    </section>
  );
}
