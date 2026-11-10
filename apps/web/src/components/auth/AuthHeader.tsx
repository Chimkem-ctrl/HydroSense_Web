import Logo from '../common/Logo';

interface AuthHeaderProps {
  size?: number;
  className?: string;
  showBrand?: boolean;
}

export default function AuthHeader({
  size = 20,
  className = '',
  showBrand = false,
}: AuthHeaderProps) {
  return (
    <header className={`auth-header${showBrand ? ' auth-header--branded' : ''} ${className}`.trim()}>
      <Logo size={size} />
      {showBrand && (
        <div className="auth-brand-text">
          <span className="auth-brand-name">HydroSense</span>
          <span className="auth-brand-caption">WATER QUALITY MONITORING</span>
        </div>
      )}
    </header>
  );
}
