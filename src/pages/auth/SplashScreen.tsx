import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout';
import Logo from '../../components/common/Logo';

export default function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => navigate('/welcome', { replace: true }), 2000);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <AuthLayout>
      <div className="splash-mark" aria-label="HydroSense loading">
        <Logo size={80} />
      </div>
    </AuthLayout>
  );
}
