import type { ChangeEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthFooter from '../../components/auth/AuthFooter';
import AuthHeader from '../../components/auth/AuthHeader';
import AuthLayout from '../../components/auth/AuthLayout';
import PasswordInput from '../../components/auth/PasswordInput';
import FormInput from '../../components/common/FormInput';
import GlassPanel from '../../components/common/GlassPanel';
import PrimaryButton from '../../components/common/PrimaryButton';
import { useAuthForm } from '../../hooks/useAuthForm';
import { authService, DEMO_ADMIN_CREDENTIALS } from '../../services/authService';
import type { SignInValues } from '../../types/auth.types';
import { getSafeInAppPath } from '../../app/auth/RouteGuards';

const initialValues: SignInValues = { email: '', password: '' };

function validate(values: SignInValues) {
  const errors: Partial<Record<keyof SignInValues, string>> = {};
  if (!values.email.trim()) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (!values.password) errors.password = 'Password is required.';
  return errors;
}

export default function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = getSafeInAppPath(location.state?.from);
  const form = useAuthForm({
    initialValues,
    validate,
    onSubmit: async (values) => {
      const result = await authService.signIn(values.email, values.password);
      navigate(result.status === 'approved' ? (from ?? result.redirectPath) : result.redirectPath, { replace: true });
    },
  });

  return (
    <AuthLayout>
      <div className="auth-page page-enter">
        <AuthHeader />
        <GlassPanel className="auth-panel signin-panel">
          <h1 className="glass-title">Welcome Back</h1>
          <h2 className="glass-subtitle">Sign in to your HydroSense account</h2>
          <form onSubmit={form.handleSubmit} noValidate>
            <FormInput
              label="Email"
              name="email"
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
              value={form.values.email}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                form.setField('email', event.target.value)
              }
              error={form.errors.email}
              required
            />
            <PasswordInput
              label="Password"
              name="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              value={form.values.password}
              onChange={(event) =>
                form.setField('password', event.target.value)
              }
              error={form.errors.password}
              required
            />
            <div className="forgot-link-row">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
            <PrimaryButton type="submit" loading={form.isSubmitting}>
              Sign In
            </PrimaryButton>
            {form.statusMessage && (
              <p className="form-status" role="status">
                {form.statusMessage}
              </p>
            )}
          </form>
          <AuthFooter>
            Don&apos;t have an account? <Link to="/signup">Sign Up</Link>
          </AuthFooter>
          {import.meta.env.DEV && <div className="demo-login-box">
            <strong>Administrator demo access</strong>
            <span>Email: {DEMO_ADMIN_CREDENTIALS.email}</span>
            <span>Password: {DEMO_ADMIN_CREDENTIALS.password}</span>
          </div>}
          <p className="auth-demo-disclaimer">Demo only: credentials are checked in this browser. Do not use a real password.</p>
        </GlassPanel>
      </div>
    </AuthLayout>
  );
}
