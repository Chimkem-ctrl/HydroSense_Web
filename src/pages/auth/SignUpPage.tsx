import type { ChangeEvent } from 'react';
import { useState } from 'react';
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
import type { SignUpValues } from '../../types/auth.types';

const initialValues: SignUpValues = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  termsAccepted: false,
};

function validate(values: SignUpValues) {
  const errors: Partial<Record<keyof SignUpValues, string>> = {};
  if (!values.firstName.trim()) errors.firstName = 'First name is required.';
  if (!values.lastName.trim()) errors.lastName = 'Last name is required.';
  if (!values.email.trim()) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (!values.password) errors.password = 'Password is required.';
  else if (values.password.length < 8) {
    errors.password = 'Use at least 8 characters.';
  }
  if (!values.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  if (!values.termsAccepted) {
    errors.termsAccepted = 'You must accept the Terms and Conditions.';
  }
  return errors;
}

export default function SignUpPage() {
  const [showTerms, setShowTerms] = useState(false);
  const form = useAuthForm({
    initialValues,
    validate,
    onSubmit: async () => {
      const result = await authService.signUp();
      form.setStatusMessage(result.message);
    },
  });

  return (
    <AuthLayout>
      <div className="auth-page page-enter">
        <AuthHeader size={68} />
        <GlassPanel className="auth-panel signup-panel">
          <h1>Create an account</h1>
          <form onSubmit={form.handleSubmit} noValidate>
            <div className="name-fields">
              <FormInput
                label="First Name"
                name="firstName"
                type="text"
                placeholder="First name"
                autoComplete="given-name"
                value={form.values.firstName}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  form.setField('firstName', event.target.value)
                }
                error={form.errors.firstName}
                required
              />
              <FormInput
                label="Last Name"
                name="lastName"
                type="text"
                placeholder="Last name"
                autoComplete="family-name"
                value={form.values.lastName}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  form.setField('lastName', event.target.value)
                }
                error={form.errors.lastName}
                required
              />
            </div>
            <FormInput
              label="Email"
              name="signup-email"
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
              name="signup-password"
              placeholder="Enter your password"
              autoComplete="new-password"
              value={form.values.password}
              onChange={(event) =>
                form.setField('password', event.target.value)
              }
              error={form.errors.password}
              required
            />
            <PasswordInput
              label="Confirm Password"
              name="confirmPassword"
              placeholder="Confirm your password"
              autoComplete="new-password"
              value={form.values.confirmPassword}
              onChange={(event) =>
                form.setField('confirmPassword', event.target.value)
              }
              error={form.errors.confirmPassword}
              required
            />
            <div className="terms-field">
              <div className="terms-row">
                <input
                  id="termsAccepted"
                  type="checkbox"
                  checked={form.values.termsAccepted}
                  onChange={(event) =>
                    form.setField('termsAccepted', event.target.checked)
                  }
                  aria-label="I have read and agree to the Terms and Conditions"
                  aria-invalid={Boolean(form.errors.termsAccepted)}
                  aria-describedby={
                    form.errors.termsAccepted ? 'terms-error' : undefined
                  }
                />
                <span>
                  <label htmlFor="termsAccepted">
                    I have read and agree to the{' '}
                  </label>
                  <button
                    className="inline-link"
                    type="button"
                    onClick={() => setShowTerms(true)}
                  >
                    Terms and Conditions
                  </button>
                  .
                </span>
              </div>
              {form.errors.termsAccepted && (
                <span className="field-error" id="terms-error" role="alert">
                  {form.errors.termsAccepted}
                </span>
              )}
            </div>
            <PrimaryButton
              type="submit"
              loading={form.isSubmitting}
              className="signup-submit"
            >
              Sign Up
            </PrimaryButton>
            {form.statusMessage && (
              <p className="form-status" role="status">
                {form.statusMessage}
              </p>
            )}
          </form>
          <AuthFooter>
            Already have an account? <Link to="/signin">Sign In</Link>
          </AuthFooter>
        </GlassPanel>
      </div>
      {showTerms && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowTerms(false);
          }}
        >
          <section
            className="terms-modal glass-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="terms-title"
          >
            <h2 id="terms-title">Terms and Conditions</h2>
            <p>
              This authentication experience is a prototype. Account details
              are not sent to or stored by a server.
            </p>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setShowTerms(false)}
            >
              Close
            </button>
          </section>
        </div>
      )}
    </AuthLayout>
  );
}
