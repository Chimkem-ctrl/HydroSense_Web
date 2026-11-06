import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ChevronRight, Eye, EyeOff, KeyRound, X } from 'lucide-react';
import { Toggle } from './ProfileCard';
import { usePersistentState } from './profileData';

interface Session {
  id: string;
  group: 'Mobile App' | 'Web Dashboard';
  device: string;
  active: boolean;
  current?: boolean;
}

const initialSessions: Session[] = [
  { id: 's1', group: 'Mobile App', device: 'iPhone 17', active: true, current: true },
  { id: 's2', group: 'Mobile App', device: 'iPhone 18', active: false },
  { id: 's3', group: 'Web Dashboard', device: 'Chrome - Hatchery Office', active: true },
];

function PasswordModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!current) return setError('Enter your current password.');
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) {
      return setError('New password must be at least 8 characters with a letter and a number.');
    }
    if (next === current) return setError('New password must be different from the current one.');
    if (next !== confirm) return setError('New password and confirmation do not match.');
    onSuccess();
  }

  const type = show ? 'text' : 'password';

  return (
    <div className="dashboard-modal-backdrop" role="presentation" onClick={onClose}>
      <form className="dashboard-modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="pw-title" onClick={(event) => event.stopPropagation()} onSubmit={submit} noValidate>
        <div className="dashboard-modal-heading">
          <span className="modal-alert-icon"><KeyRound size={17} /></span>
          <button type="button" className="dashboard-icon-button" aria-label="Close" onClick={onClose}><X size={17} /></button>
        </div>
        <h2 id="pw-title">Change Password</h2>
        <label className="profile-field"><span>Current password</span><input type={type} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></label>
        <label className="profile-field"><span>New password</span><input type={type} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></label>
        <label className="profile-field"><span>Confirm new password</span><input type={type} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
        <button type="button" className="profile-text-button" onClick={() => setShow((v) => !v)}>
          {show ? <EyeOff size={12} /> : <Eye size={12} />} {show ? 'Hide' : 'Show'} passwords
        </button>
        {error && <p className="profile-error" role="alert">{error}</p>}
        <div className="profile-form-actions">
          <button type="button" className="dashboard-button dashboard-button--subtle" onClick={onClose}>Cancel</button>
          <button type="submit" className="dashboard-button dashboard-button--primary">Update password</button>
        </div>
      </form>
    </div>
  );
}

interface SecurityCardProps {
  onViewAudit: () => void;
  onNotice: (message: string) => void;
  onLog: (title: string, description: string, icon: 'key' | 'session' | 'config') => void;
}

export default function SecurityCard({ onViewAudit, onNotice, onLog }: SecurityCardProps) {
  const [settings, setSettings] = usePersistentState('hydrosense.security', { twoFactor: false, requireOtp: false, shareLogs: false });
  const [sessions, setSessions] = useState(initialSessions);
  const [pwOpen, setPwOpen] = useState(false);

  const endSession = (id: string) => {
    setSessions((list) => list.map((s) => (s.id === id ? { ...s, active: false } : s)));
    onNotice('Session signed out.');
  };

  const endAll = () => {
    setSessions((list) => list.map((s) => (s.current ? s : { ...s, active: false })));
    onNotice('All other sessions have been logged out.');
    onLog('All Sessions Logged Out', 'Signed out every session except the current device', 'session');
  };

  const groups = ['Mobile App', 'Web Dashboard'] as const;

  return (
    <section className="dashboard-card profile-card" aria-label="Privacy and security">
      <h2 className="profile-card-title">Privacy &amp; Security</h2>

      <h3 className="profile-section-title">Security &amp; Authentication</h3>
      <div className="profile-box">
        <Toggle id="sec-2fa" label="Two-Factor Authentication (2FA)" checked={settings.twoFactor} onChange={(v) => { setSettings({ ...settings, twoFactor: v }); onNotice(`Two-factor authentication ${v ? 'enabled' : 'disabled'}.`); }} />
        <Toggle id="sec-otp" label="Require OTP for threshold changes" checked={settings.requireOtp} onChange={(v) => { setSettings({ ...settings, requireOtp: v }); onNotice(`OTP for threshold changes ${v ? 'required' : 'not required'}.`); }} />
        <button type="button" className="profile-link-row" onClick={() => setPwOpen(true)}>Change Password <ChevronRight size={15} /></button>
      </div>

      <h3 className="profile-section-title">Active Sessions</h3>
      <div className="profile-box">
        {groups.map((group) => (
          <div key={group}>
            <p className="profile-group">{group}{group === 'Mobile App' && <em> (Current Device)</em>}</p>
            {sessions.filter((s) => s.group === group).map((s) => (
              <div className="profile-row" key={s.id}>
                <span>{s.device} &bull; <b className={s.active ? 'is-good' : 'is-muted'}>{s.active ? (s.current ? 'Active Now' : 'Active') : 'Not Active'}</b></span>
                {s.active && !s.current && <button type="button" className="profile-text-button" onClick={() => endSession(s.id)}>Sign out</button>}
              </div>
            ))}
          </div>
        ))}
        <button type="button" className="profile-danger profile-danger--wide" onClick={endAll}>Log Out All Sessions</button>
      </div>

      <h3 className="profile-section-title">System Log &amp; Data Access</h3>
      <div className="profile-box">
        <Toggle id="log-share" label="Share Diagnostic Logs" checked={settings.shareLogs} onChange={(v) => { setSettings({ ...settings, shareLogs: v }); onNotice(`Diagnostic log sharing ${v ? 'enabled' : 'disabled'}.`); }} />
        <button type="button" className="profile-link-row" onClick={onViewAudit}>
          <span>Account Audit Trail <strong>(Admin Only)</strong></span><ChevronRight size={15} />
        </button>
      </div>

      {pwOpen && (
        <PasswordModal
          onClose={() => setPwOpen(false)}
          onSuccess={() => {
            setPwOpen(false);
            onNotice('Password updated. (Demo mode: no server was contacted.)');
            onLog('User Password Reset', 'Account password was changed', 'key');
          }}
        />
      )}
    </section>
  );
}
