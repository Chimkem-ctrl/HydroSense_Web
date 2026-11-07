import { Link } from 'react-router-dom';
import AuthHeader from '../../components/auth/AuthHeader';
import AuthLayout from '../../components/auth/AuthLayout';
import GlassPanel from '../../components/common/GlassPanel';

export default function PendingApprovalPage() {
  return (
    <AuthLayout>
      <div className="auth-page page-enter">
        <AuthHeader />
        <GlassPanel className="auth-panel">
          <h1 className="glass-title">Request submitted</h1>
          <p className="panel-description">
            Your account is awaiting administrator approval. You can sign in after your request is approved.
          </p>
          <div className="auth-footer">
            <Link to="/signin">Back to Sign In</Link>
          </div>
        </GlassPanel>
      </div>
    </AuthLayout>
  );
}
