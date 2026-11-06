import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import AuthFooter from '../../components/auth/AuthFooter';
import AuthHeader from '../../components/auth/AuthHeader';
import AuthLayout from '../../components/auth/AuthLayout';
import PasswordInput from '../../components/auth/PasswordInput';
import FormInput from '../../components/common/FormInput';
import GlassPanel from '../../components/common/GlassPanel';
import PrimaryButton from '../../components/common/PrimaryButton';
import { useAuthForm } from '../../hooks/useAuthForm';
import { authService } from '../../services/authService';
import type { SignInValues } from '../../types/auth.types';

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
  const form = useAuthForm({
    initialValues,
    validate,
    onSubmit: async () => {
      const result = await authService.signIn();
      form.setStatusMessage(result.message);
    },
  });

  return (
    <AuthLayout>
      <div className="auth-page page-enter">
        <AuthHeader />
        <GlassPanel className="auth-panel signin-panel">
          <h1 className="glass-title">Welcome Back!</h1>
          <h2 className="glass-subtitle">Sign in to your account</h2>
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
        </GlassPanel>
      </div>
    </AuthLayout>
  );
}
