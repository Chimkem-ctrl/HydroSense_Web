import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

interface PrimaryButtonProps
  extends PropsWithChildren,
    ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export default function PrimaryButton({
  children,
  loading = false,
  disabled,
  className = '',
  ...buttonProps
}: PrimaryButtonProps) {
  return (
    <button
      {...buttonProps}
      className={`primary-button ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      {loading ? (
        <>
          <span className="button-spinner" aria-hidden="true" />
          <span>Working…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
