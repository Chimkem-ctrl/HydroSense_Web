import { useState } from 'react';
import { ASSETS } from '../../config/assets';

interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 100, className = '' }: LogoProps) {
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={`logo-frame${hasError ? ' logo-missing' : ''} ${className}`.trim()}
      style={{ width: size, aspectRatio: '700 / 1000' }}
      aria-label="HydroSense logo"
    >
      {!hasError && (
        <img
          src={ASSETS.logo}
          alt="HydroSense"
          className="hydrosense-logo"
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
}
