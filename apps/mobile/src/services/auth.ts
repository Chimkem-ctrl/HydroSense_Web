import type { Role } from '@hydrosense/shared';

export interface AuthenticatedUser {
  id: string;
  name: string;
  role: Role;
}

export type RequestedRole = 'operator' | 'manager';
export interface SignUpValues {
  firstName: string;
  lastName: string;
  employeeId: string;
  phone: string;
  email: string;
  requestedRole: RequestedRole;
  position: string;
  hatcheryId: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

export const POSITIONS_BY_ROLE: Record<RequestedRole, readonly string[]> = {
  operator: ['Hatchery Operator', 'Senior Operator', 'Water Quality Technician', 'Shift Supervisor'],
  manager: ['Hatchery Manager', 'Operations Manager', 'Site Manager'],
};
export const HATCHERY = { id: 'camiguin-sagay', name: 'Camiguin, Sagay Multispecies Hatchery' } as const;

function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.';
  return null;
}

export function validateSignIn(email: string, password: string): string | null {
  const emailIssue = validateEmail(email);
  if (emailIssue) return emailIssue;
  if (!password) return 'Password is required.';
  return null;
}

export function validateSignUp(values: SignUpValues): string | null {
  const phone = /^[+()\d\s.-]{7,20}$/;
  if (!values.firstName.trim()) return 'First name is required.';
  if (!values.lastName.trim()) return 'Last name is required.';
  if (!values.employeeId.trim()) return 'Staff or employee ID is required.';
  if (!values.phone.trim()) return 'Contact number is required.';
  if (!phone.test(values.phone.trim())) return 'Enter a valid contact number.';
  if (!values.email.trim()) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) return 'Enter a valid email address.';
  if (values.requestedRole !== 'operator' && values.requestedRole !== 'manager') return 'Select Operator or Manager as your requested role.';
  if (!POSITIONS_BY_ROLE[values.requestedRole].includes(values.position)) return 'Select a position available for your requested role.';
  if (values.hatcheryId !== HATCHERY.id) return 'Select your subscribed hatchery.';
  if (!values.address.trim()) return 'Address is required.';
  if (!values.emergencyContactName.trim()) return 'Emergency contact name is required.';
  if (!values.emergencyContactPhone.trim()) return 'Emergency contact number is required.';
  if (!phone.test(values.emergencyContactPhone.trim())) return 'Enter a valid emergency contact number.';
  if (!values.password) return 'Password is required.';
  if (values.password.length < 8) return 'Use at least 8 characters.';
  if (!values.confirmPassword) return 'Please confirm your password.';
  if (values.confirmPassword !== values.password) return 'Passwords do not match.';
  if (!values.termsAccepted) return 'You must accept the Terms and Conditions.';
  return null;
}

async function postAuth(baseUrl: string, apiKey: string | undefined, path: string, body: object): Promise<unknown> {
  if (!apiKey?.trim()) throw new Error('Supabase publishable key is not configured.');
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify(body),
  });
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error(`The server returned an invalid response (HTTP ${response.status}).`);
  }
  if (typeof result !== 'object' || result === null) throw new Error('The server response is invalid.');
  if (!response.ok) {
    if ('status' in result && result.status === 'rejected') throw new Error('Request not approved.');
    const message = 'error' in result && typeof result.error === 'string' ? result.error : 'Please try again.';
    throw new Error(`Request failed (HTTP ${response.status}): ${message}`);
  }
  return result;
}

export async function authenticate(baseUrl: string, apiKey: string | undefined, email: string, password: string): Promise<{ user: AuthenticatedUser; accessToken: string } | { status: 'pending' }> {
  const result = await postAuth(baseUrl, apiKey, 'signin', { email: email.trim().toLowerCase(), password });
  if (typeof result !== 'object' || result === null) throw new Error('The sign-in response is invalid.');
  if ('status' in result && result.status === 'pending') return { status: 'pending' };
  if (!('accessToken' in result) || typeof result.accessToken !== 'string' || !result.accessToken.trim() ||
      !('user' in result) || typeof result.user !== 'object' || result.user === null) {
    throw new Error('The sign-in response is missing an access token or user.');
  }
  const user = result.user;
  if (!('id' in user) || typeof user.id !== 'string' || !user.id.trim() ||
      !('role' in user) || (user.role !== 'operator' && user.role !== 'manager' && user.role !== 'admin')) {
    throw new Error('This account does not have a valid approved role.');
  }
  const firstName = 'firstName' in user && typeof user.firstName === 'string' ? user.firstName : '';
  const lastName = 'lastName' in user && typeof user.lastName === 'string' ? user.lastName : '';
  const name = `${firstName} ${lastName}`.trim() || email.trim();
  return { user: { id: user.id, name, role: user.role }, accessToken: result.accessToken };
}

export async function requestAccount(baseUrl: string, apiKey: string | undefined, values: SignUpValues): Promise<void> {
  const validationError = validateSignUp(values);
  if (validationError) throw new Error(validationError);
  const result = await postAuth(baseUrl, apiKey, 'signup', {
    email: values.email.trim().toLowerCase(),
    password: values.password,
    requestedRole: values.requestedRole,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    position: values.position.trim(),
    employeeId: values.employeeId.trim(),
    phone: values.phone.trim(),
    address: values.address.trim(),
    emergencyContactName: values.emergencyContactName.trim(),
    emergencyContactPhone: values.emergencyContactPhone.trim(),
    hatcheryId: values.hatcheryId,
  });
  if (typeof result !== 'object' || result === null || !('status' in result) || result.status !== 'pending') {
    throw new Error('The server did not confirm a pending account request.');
  }
}

export async function requestPasswordReset(baseUrl: string, apiKey: string | undefined, email: string): Promise<void> {
  const issue = validateEmail(email);
  if (issue) throw new Error(issue);
  if (!apiKey?.trim()) throw new Error('Supabase publishable key is not configured.');
  const match = baseUrl.match(/^(https?:\/\/[^/]+)\/functions\/v1\/api\/?$/);
  if (!match) throw new Error('Password reset requires a Supabase Edge Function API URL.');
  const response = await fetch(`${match[1]}/auth/v1/recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey, Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  if (!response.ok) {
    let result: unknown;
    try { result = await response.json(); } catch { throw new Error(`Unable to send password reset (HTTP ${response.status}).`); }
    const message = typeof result === 'object' && result !== null && 'error_description' in result && typeof result.error_description === 'string'
      ? result.error_description : typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
        ? result.error : 'Unable to send password reset.';
    throw new Error(message);
  }
}
