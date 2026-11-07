import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthFooter from '../../components/auth/AuthFooter';
import AuthHeader from '../../components/auth/AuthHeader';
import AuthLayout from '../../components/auth/AuthLayout';
import PasswordInput from '../../components/auth/PasswordInput';
import FormInput from '../../components/common/FormInput';
import GlassPanel from '../../components/common/GlassPanel';
import PrimaryButton from '../../components/common/PrimaryButton';
import { useAuthForm } from '../../hooks/useAuthForm';
import { authService, POSITIONS_BY_ROLE, SUBSCRIBED_HATCHERIES } from '../../services/authService';
import type { RequestedRole, SignUpValues } from '../../types/auth.types';

const initialValues: SignUpValues = {
  firstName: '',
  lastName: '',
  employeeId: '',
  phone: '',
  email: '',
  requestedRole: 'operator',
  position: POSITIONS_BY_ROLE.operator[0],
  hatcheryId: '',
  address: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  password: '',
  confirmPassword: '',
  termsAccepted: false,
};

function validate(values: SignUpValues) {
  const errors: Partial<Record<keyof SignUpValues, string>> = {};
  const validPhone = /^[+()\d\s.-]{7,20}$/;

  if (!values.firstName.trim()) errors.firstName = 'First name is required.';
  if (!values.lastName.trim()) errors.lastName = 'Last name is required.';
  if (!values.employeeId.trim()) errors.employeeId = 'Staff or employee ID is required.';
  if (!values.phone.trim()) errors.phone = 'Contact number is required.';
  else if (!validPhone.test(values.phone.trim())) errors.phone = 'Enter a valid contact number.';
  if (!values.email.trim()) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (values.requestedRole !== 'operator' && values.requestedRole !== 'manager') {
    errors.requestedRole = 'Select Operator or Manager as your requested role.';
  }
  if (!POSITIONS_BY_ROLE[values.requestedRole]?.includes(values.position)) {
    errors.position = 'Select a position available for your requested role.';
  }
  if (!values.hatcheryId) errors.hatcheryId = 'Select your subscribed hatchery.';
  if (!values.address.trim()) errors.address = 'Address is required.';
  if (!values.emergencyContactName.trim()) {
    errors.emergencyContactName = 'Emergency contact name is required.';
  }
  if (!values.emergencyContactPhone.trim()) {
    errors.emergencyContactPhone = 'Emergency contact number is required.';
  } else if (!validPhone.test(values.emergencyContactPhone.trim())) {
    errors.emergencyContactPhone = 'Enter a valid emergency contact number.';
  }
  if (!values.password) errors.password = 'Password is required.';
  else if (values.password.length < 8) errors.password = 'Use at least 8 characters.';
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
  const navigate = useNavigate();
  const form = useAuthForm({
    initialValues,
    validate,
    onSubmit: async (values) => {
      const result = await authService.signUp(values);
      navigate(result.redirectPath, { replace: true });
    },
  });

  return (
    <AuthLayout>
      <div className="auth-page page-enter">
        <AuthHeader size={56} />
        <GlassPanel className="auth-panel signup-panel operator-signup-panel">
          <h1>Request an account</h1>
          <p className="operator-signup-intro">
            Submit your staff details for administrator approval. Your requested role is not active until approved.
          </p>
          <form onSubmit={form.handleSubmit} noValidate>
            <div className="operator-signup-grid">
              <div className="form-field">
                <label className="form-label" htmlFor="requestedRole">Requested role</label>
                <select
                  id="requestedRole"
                  className={`form-control${form.errors.requestedRole ? ' has-error' : ''}`}
                  value={form.values.requestedRole}
                  onChange={(event) => {
                    const role = event.target.value as RequestedRole;
                    form.setField('requestedRole', role);
                    form.setField('position', POSITIONS_BY_ROLE[role][0]);
                  }}
                  aria-invalid={Boolean(form.errors.requestedRole)}
                  required
                >
                  <option value="operator">Operator</option>
                  <option value="manager">Manager</option>
                </select>
                {form.errors.requestedRole && <span className="field-error" role="alert">{form.errors.requestedRole}</span>}
              </div>
              <FormInput
                label="First name"
                name="firstName"
                type="text"
                placeholder="First name"
                autoComplete="given-name"
                value={form.values.firstName}
                onChange={(event: ChangeEvent<HTMLInputElement>) => form.setField('firstName', event.target.value)}
                error={form.errors.firstName}
                required
              />
              <FormInput
                label="Last name"
                name="lastName"
                type="text"
                placeholder="Last name"
                autoComplete="family-name"
                value={form.values.lastName}
                onChange={(event: ChangeEvent<HTMLInputElement>) => form.setField('lastName', event.target.value)}
                error={form.errors.lastName}
                required
              />
              <FormInput
                label="Employee / staff ID"
                name="employeeId"
                type="text"
                placeholder="e.g. SAG-OP-014"
                value={form.values.employeeId}
                onChange={(event: ChangeEvent<HTMLInputElement>) => form.setField('employeeId', event.target.value)}
                error={form.errors.employeeId}
                required
              />
              <div className="form-field">
                <label className="form-label" htmlFor="position">Position</label>
                <select
                  id="position"
                  className={`form-control${form.errors.position ? ' has-error' : ''}`}
                  value={form.values.position}
                  onChange={(event) => form.setField('position', event.target.value)}
                  aria-invalid={Boolean(form.errors.position)}
                  required
                >
                  {POSITIONS_BY_ROLE[form.values.requestedRole].map((position) => (
                    <option key={position} value={position}>{position}</option>
                  ))}
                </select>
                {form.errors.position && <span className="field-error" role="alert">{form.errors.position}</span>}
              </div>
              <FormInput
                label="Contact number"
                name="phone"
                type="tel"
                placeholder="+63 9XX XXX XXXX"
                autoComplete="tel"
                value={form.values.phone}
                onChange={(event: ChangeEvent<HTMLInputElement>) => form.setField('phone', event.target.value)}
                error={form.errors.phone}
                required
              />
              <FormInput
                label="Work email"
                name="signup-email"
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                value={form.values.email}
                onChange={(event: ChangeEvent<HTMLInputElement>) => form.setField('email', event.target.value)}
                error={form.errors.email}
                required
              />
              <div className="form-field operator-signup-wide">
                <label className="form-label" htmlFor="hatcheryId">Subscribed hatchery</label>
                <select
                  id="hatcheryId"
                  className={`form-control${form.errors.hatcheryId ? ' has-error' : ''}`}
                  value={form.values.hatcheryId}
                  onChange={(event) => form.setField('hatcheryId', event.target.value)}
                  aria-invalid={Boolean(form.errors.hatcheryId)}
                  required
                >
                  <option value="">Select a subscribed hatchery</option>
                  {SUBSCRIBED_HATCHERIES.map((hatchery) => (
                    <option key={hatchery.id} value={hatchery.id}>{hatchery.name}</option>
                  ))}
                </select>
                {form.errors.hatcheryId && <span className="field-error" role="alert">{form.errors.hatcheryId}</span>}
              </div>
              <FormInput
                className="operator-signup-wide"
                label="Home address"
                name="address"
                type="text"
                placeholder="Barangay, municipality, province"
                autoComplete="street-address"
                value={form.values.address}
                onChange={(event: ChangeEvent<HTMLInputElement>) => form.setField('address', event.target.value)}
                error={form.errors.address}
                required
              />
              <FormInput
                label="Emergency contact name"
                name="emergencyContactName"
                type="text"
                placeholder="Full name"
                autoComplete="off"
                value={form.values.emergencyContactName}
                onChange={(event: ChangeEvent<HTMLInputElement>) => form.setField('emergencyContactName', event.target.value)}
                error={form.errors.emergencyContactName}
                required
              />
              <FormInput
                label="Emergency contact number"
                name="emergencyContactPhone"
                type="tel"
                placeholder="+63 9XX XXX XXXX"
                autoComplete="off"
                value={form.values.emergencyContactPhone}
                onChange={(event: ChangeEvent<HTMLInputElement>) => form.setField('emergencyContactPhone', event.target.value)}
                error={form.errors.emergencyContactPhone}
                required
              />
              <PasswordInput
                label="Password"
                name="signup-password"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                value={form.values.password}
                onChange={(event) => form.setField('password', event.target.value)}
                error={form.errors.password}
                required
              />
              <PasswordInput
                label="Confirm password"
                name="confirmPassword"
                placeholder="Re-enter your password"
                autoComplete="new-password"
                value={form.values.confirmPassword}
                onChange={(event) => form.setField('confirmPassword', event.target.value)}
                error={form.errors.confirmPassword}
                required
              />
            </div>
            <div className="terms-field">
              <div className="terms-row">
                <input
                  id="termsAccepted"
                  type="checkbox"
                  checked={form.values.termsAccepted}
                  onChange={(event) => form.setField('termsAccepted', event.target.checked)}
                  aria-label="I have read and agree to the Terms and Conditions"
                  aria-invalid={Boolean(form.errors.termsAccepted)}
                  aria-describedby={form.errors.termsAccepted ? 'terms-error' : undefined}
                />
                <span>
                  <label htmlFor="termsAccepted">I have read and agree to the{' '}</label>
                  <button className="inline-link" type="button" onClick={() => setShowTerms(true)}>Terms and Conditions</button>.
                </span>
              </div>
              {form.errors.termsAccepted && <span className="field-error" id="terms-error" role="alert">{form.errors.termsAccepted}</span>}
            </div>
            <PrimaryButton type="submit" loading={form.isSubmitting} className="signup-submit">
              Submit Request
            </PrimaryButton>
            {form.statusMessage && <p className="form-status" role="alert">{form.statusMessage}</p>}
          </form>
          <AuthFooter>
            Already registered? <Link to="/signin">Sign In</Link>
          </AuthFooter>
          <p className="auth-demo-disclaimer">Demo only: account details are stored in this browser, not sent to a server. Do not use a real password.</p>
        </GlassPanel>
      </div>
      {showTerms && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowTerms(false);
        }}>
          <section className="terms-modal glass-panel" role="dialog" aria-modal="true" aria-labelledby="terms-title">
            <h2 id="terms-title">Terms and Conditions</h2>
            <p>
              This is a demonstration application. Account details and password hashes are saved in
              this browser only. There is no server-side authentication or account recovery. Do not enter real
              passwords or sensitive personal information.
            </p>
            <button className="secondary-button" type="button" onClick={() => setShowTerms(false)}>Close</button>
          </section>
        </div>
      )}
    </AuthLayout>
  );
}
