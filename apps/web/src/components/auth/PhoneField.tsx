import { PHONE_COUNTRIES } from '@hydrosense/shared';
import type { PhoneCountryCode } from '@hydrosense/shared';

interface PhoneFieldProps {
  label: string;
  name: string;
  value: string;
  country: PhoneCountryCode;
  error?: string;
  onChange: (value: string) => void;
  onCountryChange: (country: PhoneCountryCode) => void;
}

export default function PhoneField({ label, name, value, country, error, onChange, onCountryChange }: PhoneFieldProps) {
  const errorId = `${name}-error`;
  const selected = PHONE_COUNTRIES.find((item) => item.code === country);
  if (!selected) throw new Error(`Unknown phone country: ${country}`);
  return <div className="form-field">
    <label className="form-label" htmlFor={name}>{label}</label>
    <div className={`form-control signup-phone-field${error ? ' has-error' : ''}`}>
      <div className="signup-phone-country">
        <img className="signup-phone-flag" alt="" src={`data:image/svg+xml,${encodeURIComponent(selected.flag)}`} />
        <span aria-hidden="true">{selected.callingCode}</span>
        <span className="signup-phone-arrow" aria-hidden="true" />
        <select aria-label={`${label} country code`} value={country}
        onChange={(event) => {
          const selected = PHONE_COUNTRIES.find((item) => item.code === event.target.value);
          if (selected) onCountryChange(selected.code);
        }}>
          {PHONE_COUNTRIES.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.callingCode})</option>)}
        </select>
      </div>
      <input id={name} name={name} type="tel" autoComplete={name === 'phone' ? 'tel-national' : 'off'}
        placeholder="National number" value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined} required />
    </div>
    {error && <span className="field-error" id={errorId} role="alert">{error}</span>}
  </div>;
}
