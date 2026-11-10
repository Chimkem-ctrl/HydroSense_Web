import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { ADDRESS_PROVINCES, EMPTY_SIGNUP_ADDRESS, addressBarangays, addressCities, formatSignupAddress, formatSignupPhone } from '@hydrosense/shared';
import type { PhoneCountryCode } from '@hydrosense/shared';
import { Link, useNavigate } from 'react-router-dom';
import AuthFooter from '../../components/auth/AuthFooter';
import AuthHeader from '../../components/auth/AuthHeader';
import AuthLayout from '../../components/auth/AuthLayout';
import PasswordInput from '../../components/auth/PasswordInput';
import PhoneField from '../../components/auth/PhoneField';
import FormInput from '../../components/common/FormInput';
import GlassPanel from '../../components/common/GlassPanel';
import PrimaryButton from '../../components/common/PrimaryButton';
import { useAuthForm } from '../../hooks/useAuthForm';
import { authService, SUBSCRIBED_HATCHERIES } from '../../services/authService';
import type { SignUpValues } from '../../types/auth.types';

const initialValues: SignUpValues = {
  firstName: '',
  lastName: '',
  employeeId: '',
  phone: '',
  email: '',
  hatcheryId: '',
  address: EMPTY_SIGNUP_ADDRESS,
  emergencyContactName: '',
  emergencyContactPhone: '',
  password: '',
  confirmPassword: '',
  termsAccepted: false,
};

function validate(values: SignUpValues, phoneCountry: PhoneCountryCode, emergencyCountry: PhoneCountryCode) {
  const errors: Partial<Record<keyof SignUpValues, string>> = {};

  if (!values.firstName.trim()) errors.firstName = 'First name is required.';
  if (!values.lastName.trim()) errors.lastName = 'Last name is required.';
  if (!values.employeeId.trim()) errors.employeeId = 'Staff or employee ID is required.';
  if (!values.phone.trim()) errors.phone = 'Contact number is required.';
  else if (!formatSignupPhone(phoneCountry, values.phone)) errors.phone = 'Enter a valid national contact number for the selected country.';
  if (!values.email.trim()) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (!values.hatcheryId) errors.hatcheryId = 'Select your subscribed hatchery.';
  if (!formatSignupAddress(values.address)) errors.address = 'Select a valid country, province, city and barangay, and enter a street address.';
  if (!values.emergencyContactName.trim()) {
    errors.emergencyContactName = 'Emergency contact name is required.';
  }
  if (!values.emergencyContactPhone.trim()) {
    errors.emergencyContactPhone = 'Emergency contact number is required.';
  } else if (!formatSignupPhone(emergencyCountry, values.emergencyContactPhone)) {
    errors.emergencyContactPhone = 'Enter a valid national emergency contact number for the selected country.';
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
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountryCode>('PH');
  const [emergencyCountry, setEmergencyCountry] = useState<PhoneCountryCode>('PH');
  const navigate = useNavigate();
  const form = useAuthForm({
    initialValues,
    validate: (values) => validate(values, phoneCountry, emergencyCountry),
    onSubmit: async (values) => {
      const phone = formatSignupPhone(phoneCountry, values.phone);
      const emergencyContactPhone = formatSignupPhone(emergencyCountry, values.emergencyContactPhone);
      if (!phone || !emergencyContactPhone) throw new Error('Enter valid phone numbers for the selected countries.');
      const result = await authService.signUp({ ...values, phone, emergencyContactPhone });
      navigate(result.redirectPath, { replace: true });
    },
  });

  return (
    <AuthLayout>
      <div className="auth-page page-enter">
        <AuthHeader size={52} showBrand />
        <GlassPanel className="auth-panel signup-panel operator-signup-panel">
          <h1>Request an account</h1>
          <p className="operator-signup-intro">
            Submit your staff details for administrator approval. An administrator will assign your role.
          </p>
          <form onSubmit={form.handleSubmit} noValidate>
            <div className="operator-signup-grid">
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
              <PhoneField
                label="Contact number"
                name="phone"
                value={form.values.phone}
                country={phoneCountry}
                onCountryChange={(country) => { setPhoneCountry(country); form.setField('phone', form.values.phone); }}
                onChange={(value) => form.setField('phone', value)}
                error={form.errors.phone}
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
              {([
                { key: 'country', label: 'Country', options: [{ id: 'PH', name: 'Philippines' }], disabled: false },
                { key: 'province', label: 'Province / region', options: ADDRESS_PROVINCES, disabled: !form.values.address.country },
                { key: 'city', label: 'City / municipality / district', options: addressCities(form.values.address.province), disabled: !form.values.address.province },
                { key: 'barangay', label: 'Barangay', options: addressBarangays(form.values.address.city), disabled: !form.values.address.city },
              ] as const).map(({ key, label, options, disabled }) => <div className="form-field" key={key}>
                <label className="form-label" htmlFor={`address-${key}`}>{label}</label>
                <select id={`address-${key}`} className="form-control" value={form.values.address[key]} disabled={disabled} required
                  onChange={(event) => form.setField('address', {
                    ...form.values.address, [key]: event.target.value,
                    ...(key === 'country' ? { province: '', city: '', barangay: '' } : key === 'province' ? { city: '', barangay: '' } : key === 'city' ? { barangay: '' } : {}),
                  })}>
                  <option value="">Select {label.toLowerCase()}</option>
                  {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </div>)}
              <FormInput className="operator-signup-wide" label="Street address" name="street" type="text" placeholder="House number and street"
                autoComplete="street-address" value={form.values.address.street}
                onChange={(event: ChangeEvent<HTMLInputElement>) => form.setField('address', { ...form.values.address, street: event.target.value })}
                error={form.errors.address} required />
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
              <PhoneField
                label="Emergency contact number"
                name="emergencyContactPhone"
                value={form.values.emergencyContactPhone}
                country={emergencyCountry}
                onCountryChange={(country) => { setEmergencyCountry(country); form.setField('emergencyContactPhone', form.values.emergencyContactPhone); }}
                onChange={(value) => form.setField('emergencyContactPhone', value)}
                error={form.errors.emergencyContactPhone}
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
