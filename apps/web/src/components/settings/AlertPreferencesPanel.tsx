import { useState } from 'react';
import { tierConfig } from '../../app/config';

export function AlertPreferencesPanel() {
  const [values, setValues] = useState({ sms: false, email: tierConfig.emailAlerts, voice: false });
  const channels = [
    { key: 'sms' as const, label: 'SMS alerts', available: tierConfig.smsAlerts },
    { key: 'email' as const, label: 'Email alerts', available: tierConfig.emailAlerts },
    { key: 'voice' as const, label: 'Voice alerts', available: tierConfig.voiceAlerts },
  ];
  return (
    <section className="card stack">
      {channels.map(({ key, label, available }) => (
        <label key={key} className="check-row">
          <input
            type="checkbox"
            checked={values[key]}
            disabled={!available}
            onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.checked }))}
          />
          <span>{label}</span>
          {!available && <small className="muted">Upgrade to premium or enterprise to enable this channel.</small>}
        </label>
      ))}
      <p className="small muted">Pilot preference only; delivery integrations require the backend.</p>
    </section>
  );
}