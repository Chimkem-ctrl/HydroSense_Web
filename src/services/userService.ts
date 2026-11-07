import type { UserRole } from '../types/auth.types';

export interface UserAccount {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

const STORAGE_KEY = 'hydrosense.users';

// Demo accounts only. Replace with a real backend before production use.
const seedUsers: UserAccount[] = [
  { name: 'Dario Miñoza', email: 'admin@hydrosense.com', password: 'Admin@12345', role: 'admin' },
  { name: 'Juan Dela Cruz', email: 'operator@hydrosense.com', password: 'Operator@12345', role: 'operator' },
];

const normalize = (email: string) => email.trim().toLowerCase();

function load(): UserAccount[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as UserAccount[];
  } catch {
    // fall through to seed data
  }
  save(seedUsers);
  return [...seedUsers];
}

function save(users: UserAccount[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

export const userService = {
  list(): UserAccount[] {
    return load();
  },
  find(email: string): UserAccount | undefined {
    return load().find((user) => user.email === normalize(email));
  },
  authenticate(email: string, password: string): UserAccount {
    const user = this.find(email);
    if (!user || user.password !== password) {
      throw new Error('Invalid email or password.');
    }
    return user;
  },
  // Self-registration always creates an operator; only admins can change roles.
  register(name: string, email: string, password: string): UserAccount {
    if (this.find(email)) throw new Error('An account with this email already exists.');
    const user: UserAccount = { name, email: normalize(email), password, role: 'operator' };
    save([...load(), user]);
    return user;
  },
  setRole(actingEmail: string, targetEmail: string, role: UserRole): UserAccount[] {
    const users = load();
    const actor = users.find((user) => user.email === normalize(actingEmail));
    if (actor?.role !== 'admin') throw new Error('Only administrators can change roles.');
    const target = users.find((user) => user.email === normalize(targetEmail));
    if (!target) throw new Error('User not found.');
    if (
      target.role === 'admin' &&
      role !== 'admin' &&
      users.filter((user) => user.role === 'admin').length === 1
    ) {
      throw new Error('At least one administrator is required.');
    }
    const next = users.map((user) => (user === target ? { ...user, role } : user));
    save(next);
    return next;
  },
};
