import type { AuthSession, UserRole } from '../types/auth.types';
import { userService } from './userService';

const STORAGE_KEY = 'hydrosense.session';

export const homeForRole: Record<UserRole, string> = {
  admin: '/dashboard',
  operator: '/dashboard',
};

export const sessionService = {
  // Only the email is stored; the role is always resolved from the user store.
  get(): AuthSession | null {
    try {
      const email = window.sessionStorage.getItem(STORAGE_KEY);
      const user = email ? userService.find(email) : undefined;
      return user ? { email: user.email, role: user.role } : null;
    } catch {
      return null;
    }
  },
  set(email: string) {
    window.sessionStorage.setItem(STORAGE_KEY, email);
  },
  clear() {
    window.sessionStorage.removeItem(STORAGE_KEY);
  },
};
