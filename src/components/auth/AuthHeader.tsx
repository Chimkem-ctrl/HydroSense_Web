import Logo from '../common/Logo';

interface AuthHeaderProps {
  size?: number;
  className?: string;
}

export default function AuthHeader({
  size = 64,
  className = '',
}: AuthHeaderProps) {
  return (
    <header className={`auth-header ${className}`.trim()}>
      <Logo size={size} />
    </header>
  );
}
