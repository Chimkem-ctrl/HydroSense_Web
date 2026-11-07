import { useState } from 'react';

const CHANNELS = [
  { key: 'sms', label: 'SMS alerts' },
  { key: 'email', label: 'Email alerts' },
  { key: 'voice', label: 'Voice alerts' },
] as const;

type ChannelKey = (typeof CHANNELS)[number]['key'];

export function AlertPreferencesPanel() {
  const [values, setValues] = useState<Record<ChannelKey, boolean>>({ sms: false, email: true, voice: false });
  return (
    <section className="card stack">
      {CHANNELS.map(({ key, label }) => (
        <label key={key} className="check-row">
          <input
            type="checkbox"
            checked={values[key]}
            onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.checked }))}
          />
          <span>{label}</span>
        </label>
      ))}
      <p className="small muted">Pilot preference only; delivery integrations require the backend.</p>
    </section>
  );
}