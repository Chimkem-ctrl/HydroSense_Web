import type { ReactNode } from 'react';

interface ToggleSwitchProps {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id: string;
}

export default function ToggleSwitch({
  label,
  checked,
  onChange,
  id,
}: ToggleSwitchProps) {
  return (
    <div className="settings-row">
      <label className="settings-row-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="toggle-switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}
