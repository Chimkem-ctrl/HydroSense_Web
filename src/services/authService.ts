import type {
  AuthUser,
  SignUpValues,
  StoredAccount,
} from '../types/auth.types';

export interface AuthResult {
  user: AuthUser;
  redirectPath: '/dashboard' | '/operator';
}

export const SUBSCRIBED_HATCHERIES = [
  {
    id: 'camiguin-sagay',
    name: 'Camihuin, Sagay Multispecies Hatchery',
  },
] as const;

export const DEMO_ADMIN_CREDENTIALS = {
  email: 'admin@hydrosense.demo',
  password: 'AdminDemo!2026',
} as const;

const ACCOUNTS_KEY = 'hydrosense.auth.accounts.v1';
const SESSION_KEY = 'hydrosense.auth.session.v1';

const adminUser: AuthUser = {
  id: 'demo-admin',
  firstName: 'Dario',
  lastName: 'Minoza',
  email: DEMO_ADMIN_CREDENTIALS.email,
  role: 'ADMINISTRATOR',
  position: 'System Administrator',
};

function isStoredAccount(value: unknown): value is StoredAccount {
  if (typeof value !== 'object' || value === null || !('user' in value) || !('passwordHash' in value)) {
    return false;
  }
  const account = value as { user?: unknown; passwordSalt?: unknown; passwordHash?: unknown };
  if (typeof account.user !== 'object' || account.user === null ||
      typeof account.passwordSalt !== 'string' || typeof account.passwordHash !== 'string') {
    return false;
  }
  const user = account.user as Partial<AuthUser>;
  return typeof user.id === 'string' &&
    typeof user.firstName === 'string' &&
    typeof user.lastName === 'string' &&
    typeof user.email === 'string' &&
    user.role === 'OPERATOR';
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

function rolePath(user: AuthUser): AuthResult['redirectPath'] {
  return user.role === 'ADMINISTRATOR' ? '/dashboard' : '/operator';
}

function saveSession(user: AuthUser) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch (error) {
    throw new Error(`Could not save your demo sign-in session: ${String(error)}`);
  }
}

export function getCurrentUser(): AuthUser | null {
  const saved = window.localStorage.getItem(SESSION_KEY);
  if (saved === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    throw new Error('The saved sign-in session is invalid. Sign in again.');
  }
  if (typeof parsed !== 'object' || parsed === null || !('role' in parsed) ||
      !('email' in parsed) || !('firstName' in parsed) || !('lastName' in parsed) ||
      !['ADMINISTRATOR', 'OPERATOR'].includes(String(parsed.role)) ||
      typeof parsed.email !== 'string' ||
      typeof parsed.firstName !== 'string' ||
      typeof parsed.lastName !== 'string') {
    throw new Error('The saved sign-in session is invalid. Sign in again.');
  }
  return parsed as AuthUser;
}

export function signOut() {
  window.localStorage.removeItem(SESSION_KEY);
}

export const authService = {
  async signIn(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const adminSalt = 'hydrosense-demo-admin-v1';
    const adminHash = await hashPassword(DEMO_ADMIN_CREDENTIALS.password, adminSalt);
    const accounts = readAccounts();
    const account = normalizedEmail === adminUser.email
      ? { user: adminUser, passwordSalt: adminSalt, passwordHash: adminHash }
      : accounts.find((item) => item.user.email.toLowerCase() === normalizedEmail);

    if (!account || account.passwordHash !== await hashPassword(password, account.passwordSalt)) {
      throw new Error('Email or password is incorrect. Check your details and try again.');
    }

    saveSession(account.user);
    return { user: account.user, redirectPath: rolePath(account.user) };
  },

  async signUp(values: SignUpValues): Promise<AuthResult> {
    const normalizedEmail = values.email.trim().toLowerCase();
    if (normalizedEmail === adminUser.email ||
        readAccounts().some((account) => account.user.email.toLowerCase() === normalizedEmail)) {
      throw new Error('An account with this email already exists. Sign in instead.');
    }
    if (!SUBSCRIBED_HATCHERIES.some((hatchery) => hatchery.id === values.hatcheryId)) {
      throw new Error('Select a subscribed hatchery to continue.');
    }

    const user: AuthUser = {
      id: `operator-${Date.now()}`,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: normalizedEmail,
      role: 'OPERATOR',
      employeeId: values.employeeId.trim(),
      phone: values.phone.trim(),
      position: values.position.trim(),
      hatcheryId: values.hatcheryId,
      address: values.address.trim(),
      emergencyContactName: values.emergencyContactName.trim(),
      emergencyContactPhone: values.emergencyContactPhone.trim(),
    };

    const accounts = readAccounts();
    const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
    const passwordSalt = Array.from(saltBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    accounts.push({
      user,
      passwordSalt,
      passwordHash: await hashPassword(values.password, passwordSalt),
    });
    try {
      window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch (error) {
      throw new Error(`Could not save this demo account in the browser: ${String(error)}`);
    }
    saveSession(user);
    return { user, redirectPath: rolePath(user) };
  },

  requestPasswordReset(email: string): Promise<{ message: string }> {
    if (!email.trim()) {
      return Promise.reject(new Error('Enter the email address for your account.'));
    }
    return Promise.resolve({
      message: 'Demo mode: password reset is not connected to an email service.',
    });
  },
};
