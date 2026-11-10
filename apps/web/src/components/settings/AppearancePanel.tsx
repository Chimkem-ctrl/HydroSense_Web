import { useTheme } from '../../app/ThemeContext';
import type { ThemeChoice } from '../../app/ThemeContext';

const OPTIONS: { value: ThemeChoice; label: string; hint: string }[] = [
  { value: 'system', label: 'System', hint: 'Match your device setting' },
  { value: 'light', label: 'Light', hint: 'Light background' },
  { value: 'dark', label: 'Dark', hint: 'Dark background, easier to read at night' },
];

export function AppearancePanel() {
  const { choice, setChoice } = useTheme();
  return (
    <section className="card profile-preferences">
      <fieldset className="profile-theme">
        <legend>Theme</legend>
        <p className="profile-theme-description">Choose how HydroSense appears on this device.</p>
        <div className="profile-options">
        {OPTIONS.map(({ value, label, hint }) => (
          <label key={value} className="check-row">
            <input type="radio" name="theme" value={value} checked={choice === value} onChange={() => setChoice(value)} />
            <span>{label}</span>
            <small className="muted">{hint}</small>
          </label>
        ))}
        </div>
      </fieldset>
    </section>
  );
}