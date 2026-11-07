import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import AuthHeader from '../../components/auth/AuthHeader';
import AuthLayout from '../../components/auth/AuthLayout';
import FormInput from '../../components/common/FormInput';
import GlassPanel from '../../components/common/GlassPanel';
import PrimaryButton from '../../components/common/PrimaryButton';
import { useAuthForm } from '../../hooks/useAuthForm';
import { authService } from '../../services/authService';
import type { ForgotPasswordValues } from '../../types/auth.types';

const initialValues: ForgotPasswordValues = { email: '' };

function validate(values: ForgotPasswordValues) {
  const errors: Partial<Record<keyof ForgotPasswordValues, string>> = {};
  if (!values.email.trim()) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  return errors;
}

export default function ForgotPasswordPage() {
  const form = useAuthForm({
    initialValues,
    validate,
    onSubmit: async (values) => {
      const result = await authService.requestPasswordReset(values.email);
      form.setStatusMessage(result.message);
    },
  });

  return (
    <AuthLayout>
      <div className="auth-page page-enter">
        <AuthHeader />
        <GlassPanel className="auth-panel forgot-panel">
          <h1>Reset your password</h1>
          <p className="panel-description">
            Enter your email address and we&apos;ll help you get back in.
          </p>
          <form onSubmit={form.handleSubmit} noValidate>
            <FormInput
              label="Email"
              name="reset-email"
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
            <PrimaryButton type="submit" loading={form.isSubmitting}>
              Send Reset Link
            </PrimaryButton>
            {form.statusMessage && (
              <p className="form-status" role="status">
                {form.statusMessage}
              </p>
            )}
          </form>
          <div className="auth-footer">
            <Link to="/signin">Back to Sign In</Link>
          </div>
        </GlassPanel>
      </div>
    </AuthLayout>
  );
}
