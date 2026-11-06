import type { ChangeEvent, InputHTMLAttributes } from 'react';

interface FormInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  error?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export default function FormInput({
  label,
  error,
  id,
  className = '',
  ...inputProps
}: FormInputProps) {
  const inputId = id ?? inputProps.name;
  const errorId = `${inputId}-error`;

  return (
    <div className={`form-field ${className}`.trim()}>
      <label className="form-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        {...inputProps}
        id={inputId}
        className={`form-control${error ? ' has-error' : ''}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
