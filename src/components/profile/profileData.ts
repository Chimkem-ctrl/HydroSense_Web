import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export type AuditIcon = 'config' | 'user' | 'key' | 'session' | 'profile';

export interface AuditEntry {
  id: string;
  category: 'Security & Configuration';
  title: string;
  description: string;
  by: string;
  time: string;
  icon: AuditIcon;
}

export type ManagedUserStatus = 'pending' | 'active' | 'inactive';

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: 'Admin' | 'User';
  joined: string;
  status: ManagedUserStatus;
}

export interface ProfileData {
  name: string;
  email: string;
  phone: string;
  location: string;
}

export const CURRENT_USER_EMAIL = 'dario.minoza@gmail.com';

export const defaultProfile: ProfileData = {
  name: 'Dario Miñoza',
  email: CURRENT_USER_EMAIL,
  phone: '+63 9673 435 1738',
  location: 'Sagay, Camiguin, Philippines',
};

export const initialUsers: ManagedUser[] = [
  { id: 'u1', email: 'm.santos@bfar.gov', name: 'Maria Santos', role: 'User', joined: 'Aug 20, 2026', status: 'pending' },
  { id: 'u2', email: 'j.delacruz@bfar.gov', name: 'Juan Delacruz', role: 'Admin', joined: 'Jun 2, 2026', status: 'active' },
  { id: 'u3', email: 'r.cruz@bfar.gov', name: 'Rico Cruz', role: 'User', joined: 'Mar 14, 2026', status: 'inactive' },
  { id: 'u4', email: 'a.reyes@bfar.gov', name: 'Ana Reyes', role: 'User', joined: 'Jul 9, 2026', status: 'active' },
];

export const initialAudit: AuditEntry[] = [
  { id: 'a1', category: 'Security & Configuration', title: 'Parameter Threshold Modified', description: 'DO Minimum updated: 3.5 to 4.0 mg/L', by: 'j.delacruz@bfar.gov (Admin)', time: 'Aug 24, 2026 • 09:15 AM', icon: 'config' },
  { id: 'a2', category: 'Security & Configuration', title: 'User Account Approved', description: 'Approved m.santos@bfar.gov as Manager', by: 'j.delacruz@bfar.gov (Admin)', time: 'Aug 20, 2026 • 02:10 PM', icon: 'user' },
  { id: 'a3', category: 'Security & Configuration', title: 'User Password Reset', description: 'Account password update requested', by: 'dario.minoza@gmail.com (Operator)', time: 'Aug 19, 2026 • 04:30 PM', icon: 'key' },
  { id: 'a4', category: 'Security & Configuration', title: 'New Session Authenticated', description: 'Signed in via Chrome Web Dashboard', by: 'dario.minoza@gmail.com (Operator)', time: 'Aug 18, 2026 • 08:00 AM', icon: 'session' },
];

export function formatAuditTime(date = new Date()) {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true }).format(date);
  return `${day} • ${time}`;
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function usePersistentState<T>(key: string, fallback: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be full or unavailable; state still works for the session.
    }
  }, [key, value]);

  return [value, setValue];
}
