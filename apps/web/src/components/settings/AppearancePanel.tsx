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
    <section className="card stack">
      <fieldset className="stack" style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="card-title">Theme</legend>
        {OPTIONS.map(({ value, label, hint }) => (
          <label key={value} className="check-row">
            <input type="radio" name="theme" value={value} checked={choice === value} onChange={() => setChoice(value)} />
            <span>{label}</span>
            <small className="muted">{hint}</small>
          </label>
        ))}
      </fieldset>
    </section>
  );
}