import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Role } from '@hydrosense/shared';
import { getCurrentUser } from '../../services/authService';

const AuthRefreshContext = createContext<number | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setRevision((current) => current + 1);
    window.addEventListener('hydrosense:auth-change', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('hydrosense:auth-change', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return <AuthRefreshContext.Provider value={revision}>{children}</AuthRefreshContext.Provider>;
}

export function useAuth() {
  useContext(AuthRefreshContext);
  return getCurrentUser();
}

export function useRole() {
  const user = useAuth();
  if (!user || !user.role) throw new Error('useRole must be used by an authenticated user.');
  const role: Role = user.role;
  return {
    role,
    userName: `${user.firstName} ${user.lastName}`,
  };
}
