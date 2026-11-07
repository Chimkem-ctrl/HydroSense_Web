import type { Role } from '@hydrosense/shared';
import { DATA_MODE } from '../app/config';
import type {
  AccountStatus,
  AuthUser,
  PendingRequest,
  RequestedRole,
  SignUpValues,
  StoredAccount,
} from '../types/auth.types';

export interface AuthResult {
  status: 'approved' | 'pending';
  user?: AuthUser;
  redirectPath: '/' | '/pending-approval';
}

export const SUBSCRIBED_HATCHERIES = [
  {
    id: 'camiguin-sagay',
    name: 'Camiguin, Sagay Multispecies Hatchery',
  },
] as const;

export const POSITIONS_BY_ROLE: Record<RequestedRole, readonly string[]> = {
  operator: [
    'Hatchery Operator',
    'Senior Operator',
    'Water Quality Technician',
    'Shift Supervisor',
  ],
  manager: [
    'Hatchery Manager',
    'Operations Manager',
    'Site Manager',
  ],
};

export const DEMO_ADMIN_CREDENTIALS = {
  email: import.meta.env.VITE_ADMIN_EMAIL?.trim() || 'admin@hydrosense.demo',
  password: import.meta.env.VITE_ADMIN_PASSWORD || 'AdminDemo!2026',
} as const;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  || 'https://iafooterjwbihuzwakoc.supabase.co';
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || 'sb_publishable_Dagoxgq2hOU3RFsE8RJGaA_jUtn8oJn';

const ACCOUNTS_KEY = 'hydrosense.auth.accounts.v2';
const SESSION_KEY = 'hydrosense.auth.session.v2';
const ADMIN_ID = 'demo-admin';
const ADMIN_SALT = 'hydrosense-demo-admin-v2';
const DUMMY_SALT = 'hydrosense-auth-invalid-account-v2';
const AUTH_CHANGE_EVENT = 'hydrosense:auth-change';

type ReviewRole = Exclude<Role, 'admin'>;

const adminUser: AuthUser & { role: 'admin'; status: 'approved' } = {
  id: ADMIN_ID,
  firstName: 'Dario',
  lastName: 'Minoza',
  email: DEMO_ADMIN_CREDENTIALS.email.trim().toLowerCase(),
  role: 'admin',
  requestedRole: null,
  status: 'approved',
  position: 'System Administrator',
  createdAt: '2026-01-01T00:00:00.000Z',
};

async function listApiAdminProfiles(status: 'pending' | 'approved'): Promise<AuthUser[]> {
  const token = window.localStorage.getItem('hydrosense.auth.access-token');
  const response = await fetch(`${SUPABASE_URL}/functions/v1/api/v1/admin/users?status=${status}`, {
    headers: {
      apikey: API_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  const profiles = await response.json();
  if (!response.ok) throw new Error(profiles.error ?? 'Unable to load users.');
  return (profiles as Array<Record<string, unknown>>).map((profile) => ({
    id: String(profile.id),
    firstName: String(profile.firstName ?? '').split(' ')[0] ?? '',
    lastName: String(profile.firstName ?? '').split(' ').slice(1).join(' ') ?? '',
    email: String(profile.email ?? ''),
    role: profile.role as Role,
    requestedRole: null,
    status,
    position: profile.position as string | undefined,
    employeeId: profile.employeeId as string | undefined,
    phone: profile.phone as string | undefined,
    address: profile.address as string | undefined,
    emergencyContactName: profile.emergencyContactName as string | undefined,
    emergencyContactPhone: profile.emergencyContactPhone as string | undefined,
    createdAt: new Date().toISOString(),
  }));
}

async function updateApiProfile(userId: string, status: AccountStatus, role: RequestedRole | null): Promise<AuthUser> {
  const token = window.localStorage.getItem('hydrosense.auth.access-token');
  const response = await fetch(`${SUPABASE_URL}/functions/v1/api/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: {
      apikey: API_KEY,
      Authorization: "Bearer " + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status,
      role,
      requested_role: role,
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? 'Unable to update account request.');
  const profile = Array.isArray(result) ? result[0] : result;
  return {
    id: String(profile.id),
    firstName: String(profile.first_name ?? ''),
    lastName: String(profile.last_name ?? ''),
    email: String(profile.email ?? ''),
    role: profile.role as Role,
    requestedRole: profile.requested_role as RequestedRole | null,
    status: profile.status as AccountStatus,
    position: profile.position as string | undefined,
    createdAt: String(profile.created_at ?? ''),
  };
}

function isRequestedRole(value: unknown): value is RequestedRole {
  return value === 'operator' || value === 'manager';
}

async function removeApiAccount(userId: string): Promise<void> {
  const token = window.localStorage.getItem('hydrosense.auth.access-token');
  const response = await fetch(`${SUPABASE_URL}/functions/v1/api/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: {
      apikey: API_KEY,
      Authorization: `Bearer ${token ?? ''}`,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? result.message ?? 'Unable to remove account.');
}

function isStoredAccount(value: unknown): value is StoredAccount {
  if (typeof value !== 'object' || value === null ||
      !('user' in value) || !('passwordSalt' in value) || !('passwordHash' in value)) {
    return false;
  }
  const account = value as {
    user?: Partial<AuthUser>;
    passwordSalt?: unknown;
    passwordHash?: unknown;
  };
  const user = account.user;
  if (typeof user !== 'object' || user === null ||
      typeof account.passwordSalt !== 'string' || typeof account.passwordHash !== 'string') {
    return false;
  }
  const roleMatchesStatus = user.status === 'approved'
    ? user.role === 'operator' || user.role === 'manager'
    : user.role === null;
  return typeof user.id === 'string' &&
    typeof user.firstName === 'string' &&
    typeof user.lastName === 'string' &&
    typeof user.email === 'string' &&
    typeof user.status === 'string' &&
    ['pending', 'approved', 'rejected'].includes(user.status) &&
    (user.role === null || user.role === 'operator' || user.role === 'manager') &&
    isRequestedRole(user.requestedRole) &&
    roleMatchesStatus &&
    typeof user.createdAt === 'string';
}

function readAccounts(): StoredAccount[] {
  const saved = window.localStorage.getItem(ACCOUNTS_KEY);
  if (saved === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    throw new Error('Saved demo accounts could not be read. Clear this site’s local storage and try again.');
  }
  if (!Array.isArray(parsed) || !parsed.every(isStoredAccount)) {
    throw new Error('Saved demo account data is invalid. Clear this site’s local storage and try again.');
  }
  return parsed;
}

function writeAccounts(accounts: StoredAccount[]) {
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (error) {
    throw new Error(`Could not save this demo account in the browser: ${String(error)}`);
  }
}

function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

async function hashPassword(password: string, salt: string): Promise<string> {
  if (!window.crypto?.subtle) {
    throw new Error('Secure browser storage is unavailable. Use localhost or HTTPS to sign in.');
  }
  const passwordBytes = new TextEncoder().encode(password);
  const key = await window.crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveBits']);
  const digest = await window.crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: new TextEncoder().encode(salt),
    iterations: 100_000,
    hash: 'SHA-256',
  }, key, 256);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function secureEquals(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function saveSession(userId: string) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ userId }));
  } catch (error) {
    throw new Error(`Could not save your demo sign-in session: ${String(error)}`);
  }
  notifyAuthChanged();
}

function readSessionUserId(): string | null {
  const saved = window.localStorage.getItem(SESSION_KEY);
  if (saved === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    throw new Error('The saved sign-in session is invalid. Sign in again.');
  }
  if (typeof parsed !== 'object' || parsed === null ||
      !('userId' in parsed) || typeof parsed.userId !== 'string') {
    throw new Error('The saved sign-in session is invalid. Sign in again.');
  }
  return parsed.userId;
}

function assertAdmin() {
  if (getCurrentUser()?.role !== 'admin') {
    throw new Error('Only the administrator may review account requests.');
  }
}

function validReviewRole(role: Role): role is ReviewRole {
  return role === 'operator' || role === 'manager';
}

function assertStatusRole(status: AccountStatus, role: Role | null) {
  if (status === 'approved' && role === null) {
    throw new Error('An approved account must have an assigned role.');
  }
  if (status !== 'approved' && role !== null) {
    throw new Error('Only approved accounts can have an assigned role.');
  }
}

export function getCurrentUser(): AuthUser | null {
  if (DATA_MODE === 'api') {
    const stored = window.localStorage.getItem('hydrosense.auth.user');
    if (!stored || !window.localStorage.getItem('hydrosense.auth.access-token')) return null;
    try {
      return JSON.parse(stored) as AuthUser;
    } catch {
      return null;
    }
  }
  const userId = readSessionUserId();
  if (!userId) return null;
  if (userId === ADMIN_ID) return { ...adminUser };
  const account = readAccounts().find((item) => item.user.id === userId);
  if (!account || account.user.status !== 'approved' || account.user.role === null) return null;
  return { ...account.user };
}

export function signOut() {
  if (DATA_MODE === 'api') {
    window.localStorage.removeItem('hydrosense.auth.access-token');
    window.localStorage.removeItem('hydrosense.auth.user');
    notifyAuthChanged();
    return;
  }
  window.localStorage.removeItem(SESSION_KEY);
  notifyAuthChanged();
}

export const authService = {
  async signIn(email: string, password: string): Promise<AuthResult> {
    if (DATA_MODE === 'api') {
      if (!API_KEY) throw new Error('Supabase publishable key is not configured.');
      const supabaseUrl = SUPABASE_URL;

      const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: API_KEY,
          Authorization: "Bearer " + API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const authResult = await authResponse.json();
      if (!authResponse.ok) {
        throw new Error(authResult.error_description ?? authResult.error ?? 'Email or password is incorrect.');
      }

      const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(authResult.user.id)}&select=*`, {
        headers: {
          apikey: API_KEY,
          Authorization: "Bearer " + authResult.access_token,
        },
      });
      const profiles = await profileResponse.json();
      const profile = Array.isArray(profiles) ? profiles[0] : undefined;
      if (!profile || profile.status !== 'approved' || !profile.role) {
        return { status: 'pending', redirectPath: '/pending-approval' };
      }

      const user: AuthUser = {
        id: profile.id,
        firstName: profile.first_name ?? '',
        lastName: profile.last_name ?? '',
        email: profile.email,
        role: profile.role,
        requestedRole: profile.requested_role,
        status: profile.status,
        position: profile.position ?? undefined,
        employeeId: profile.employee_id ?? undefined,
        phone: profile.phone ?? undefined,
        address: profile.address ?? undefined,
        emergencyContactName: profile.emergency_contact_name ?? undefined,
        emergencyContactPhone: profile.emergency_contact_phone ?? undefined,
        createdAt: profile.created_at,
      };
      window.localStorage.setItem('hydrosense.auth.access-token', authResult.access_token);
      window.localStorage.setItem('hydrosense.auth.user', JSON.stringify(user));
      notifyAuthChanged();
      return { status: 'approved', user, redirectPath: '/' };
    }
    const normalizedEmail = email.trim().toLowerCase();
    const accounts = readAccounts();
    const isAdmin = normalizedEmail === adminUser.email;
    const account = isAdmin
      ? {
        user: adminUser,
        passwordSalt: ADMIN_SALT,
        passwordHash: await hashPassword(DEMO_ADMIN_CREDENTIALS.password, ADMIN_SALT),
      }
      : accounts.find((item) => item.user.email.toLowerCase() === normalizedEmail);

    const passwordSalt = account?.passwordSalt ?? DUMMY_SALT;
    const expectedHash = account?.passwordHash ?? await hashPassword('invalid-account-password', DUMMY_SALT);
    const suppliedHash = await hashPassword(password, passwordSalt);
    if (!account || !secureEquals(suppliedHash, expectedHash)) {
      throw new Error('Email or password is incorrect.');
    }

    if (account.user.status === 'pending') {
      return { status: 'pending', redirectPath: '/pending-approval' };
    }
    if (account.user.status === 'rejected') {
      throw new Error('Request not approved.');
    }
    saveSession(account.user.id);
    return { status: 'approved', user: { ...account.user }, redirectPath: '/' };
  },

  async signUp(values: SignUpValues): Promise<AuthResult> {
    if (DATA_MODE === 'api') {
      if (!API_KEY) throw new Error('Supabase publishable key is not configured.');
      const supabaseUrl = SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/api/v1/auth/signup`, {
        method: 'POST',
        headers: {
          apikey: API_KEY,
          Authorization: "Bearer " + API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 429 || result.error_code === 'over_email_send_rate_limit') {
          throw new Error('Too many signup attempts. Wait a few minutes before trying again.');
        }
        throw new Error(result.error ?? result.msg ?? 'Unable to create account.');
      }
      return { status: 'pending', redirectPath: '/pending-approval' };
    }
    if (!isRequestedRole(values.requestedRole)) {
      throw new Error('Select Operator or Manager as your requested role.');
    }
    if (!POSITIONS_BY_ROLE[values.requestedRole].includes(values.position)) {
      throw new Error('Select a position available for your requested role.');
    }
    const normalizedEmail = values.email.trim().toLowerCase();
    const accounts = readAccounts();
    if (!normalizedEmail || normalizedEmail === adminUser.email ||
        accounts.some((account) => account.user.email.toLowerCase() === normalizedEmail)) {
      throw new Error('An account with this email already exists. Sign in instead.');
    }
    if (!SUBSCRIBED_HATCHERIES.some((hatchery) => hatchery.id === values.hatcheryId)) {
      throw new Error('Select a subscribed hatchery to continue.');
    }

    const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
    const passwordSalt = Array.from(saltBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const user: AuthUser = {
      id: `account-${window.crypto.randomUUID()}`,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: normalizedEmail,
      role: null,
      requestedRole: values.requestedRole,
      status: 'pending',
      employeeId: values.employeeId.trim(),
      phone: values.phone.trim(),
      position: values.position.trim(),
      hatcheryId: values.hatcheryId,
      address: values.address.trim(),
      emergencyContactName: values.emergencyContactName.trim(),
      emergencyContactPhone: values.emergencyContactPhone.trim(),
      createdAt: new Date().toISOString(),
    };

    accounts.push({
      user,
      passwordSalt,
      passwordHash: await hashPassword(values.password, passwordSalt),
    });
    writeAccounts(accounts);
    return { status: 'pending', redirectPath: '/pending-approval' };
  },

  listPendingRequests(): PendingRequest[] {
    assertAdmin();
    if (DATA_MODE === 'api') {
      return listApiAdminProfiles('pending').then((users) =>
        users.filter((user): user is PendingRequest =>
          user.status === 'pending' && user.role === null && user.requestedRole !== null),
      ) as unknown as PendingRequest[];
    }
    return readAccounts()
      .map(({ user }) => user)
      .filter((user): user is PendingRequest => user.status === 'pending' && user.role === null && user.requestedRole !== null)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  },

  listApprovedUsers(): Array<AuthUser & { role: Role; status: 'approved' }> {
    assertAdmin();
    if (DATA_MODE === 'api') {
      return listApiAdminProfiles('approved').then((users) =>
        users.filter((user): user is AuthUser & { role: Role; status: 'approved' } =>
          user.status === 'approved' && user.role !== null),
      ) as unknown as Array<AuthUser & { role: Role; status: 'approved' }>;
    }
    return [
      { ...adminUser },
      ...readAccounts()
        .map(({ user }) => user)
        .filter((user): user is AuthUser & { role: Role; status: 'approved' } => user.status === 'approved' && user.role !== null),
    ];
  },

  updateApprovedUserRole(userId: string, role: Role): AuthUser {
    assertAdmin();
    if (!validReviewRole(role)) {
      throw new Error('Users may only be assigned the Operator or Manager role.');
    }
    if (userId === ADMIN_ID) {
      throw new Error('The administrator role cannot be changed.');
    }
    if (DATA_MODE === 'api') return updateApiProfile(userId, 'approved', role) as unknown as AuthUser;
    const accounts = readAccounts();
    const index = accounts.findIndex((account) => account.user.id === userId);
    if (index < 0 || accounts[index].user.status !== 'approved') {
      throw new Error('Approved account was not found.');
    }
    const user = { ...accounts[index].user, role };
    accounts[index] = { ...accounts[index], user };
    writeAccounts(accounts);
    notifyAuthChanged();
    return { ...user };
  },

  removeAccount(userId: string): Promise<void> | void {
    assertAdmin();
    if (userId === ADMIN_ID) {
      throw new Error('The administrator account cannot be removed.');
    }
    if (DATA_MODE === 'api') return removeApiAccount(userId);
    const accounts = readAccounts();
    const index = accounts.findIndex((account) => account.user.id === userId);
    if (index < 0) {
      throw new Error('Account was not found.');
    }
    writeAccounts(accounts.filter((account) => account.user.id !== userId));
    notifyAuthChanged();
  },

  approveRequest(userId: string, role: Role): AuthUser {
    assertAdmin();
    if (!validReviewRole(role)) {
      throw new Error('Account requests can only be approved as Operator or Manager.');
    }
    if (DATA_MODE === 'api') return updateApiProfile(userId, 'approved', role) as unknown as AuthUser;
    const accounts = readAccounts();
    const index = accounts.findIndex((account) => account.user.id === userId);
    if (index < 0 || accounts[index].user.status !== 'pending') {
      throw new Error('Pending account request was not found.');
    }
    const user = { ...accounts[index].user, status: 'approved' as const, role };
    assertStatusRole(user.status, user.role);
    accounts[index] = { ...accounts[index], user };
    writeAccounts(accounts);
    notifyAuthChanged();
    return { ...user };
  },

  rejectRequest(userId: string): AuthUser {
    assertAdmin();
    if (DATA_MODE === 'api') return updateApiProfile(userId, 'rejected', null) as unknown as AuthUser;
    const accounts = readAccounts();
    const index = accounts.findIndex((account) => account.user.id === userId);
    if (index < 0 || accounts[index].user.status !== 'pending') {
      throw new Error('Pending account request was not found.');
    }
    const user = { ...accounts[index].user, status: 'rejected' as const, role: null };
    assertStatusRole(user.status, user.role);
    accounts[index] = { ...accounts[index], user };
    writeAccounts(accounts);
    notifyAuthChanged();
    return { ...user };
  },

  requestPasswordReset(email: string): Promise<{ message: string }> {
    if (!email.trim()) {
      return Promise.reject(new Error('Enter the email address for your account.'));
    }
    if (DATA_MODE === 'api') {
      if (!API_KEY) return Promise.reject(new Error('Supabase publishable key is not configured.'));
      const supabaseUrl = SUPABASE_URL;
      return fetch(`${supabaseUrl}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          apikey: API_KEY,
          Authorization: "Bearer " + API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      }).then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error_description ?? result.error ?? 'Unable to send password reset.');
        return { message: 'Password reset instructions have been sent.' };
      });
    }
    return Promise.resolve({
      message: 'Demo mode: password reset is not connected to an email service.',
    });
  },
};
