import { Link } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthHeader from '../../components/auth/AuthHeader';
import GlassPanel from '../../components/common/GlassPanel';

export default function WelcomePage() {
  return (
    <AuthLayout>
      <div className="welcome-page page-enter">
        <AuthHeader className="welcome-header" size={72} />
        <p className="brand-tagline">Real-Time Water Quality Monitoring</p>
        <GlassPanel className="welcome-panel">
          <h1>Let&apos;s Get Started</h1>
          <p>
            Monitor your water quality with confidence.
            <br />
            Stay informed, stay in control.
          </p>
          <div className="welcome-actions">
            <Link className="secondary-button" to="/signin">
              Sign In
            </Link>
            <Link className="secondary-button" to="/signup">
              Sign Up
            </Link>
          </div>
          <Link className="operator-entry-link" to="/operator">
            Operator workspace <span aria-hidden="true">→</span>
          </Link>
        </GlassPanel>
      </div>
    </AuthLayout>
  );
}
