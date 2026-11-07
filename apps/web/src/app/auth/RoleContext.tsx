import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Role } from '@hydrosense/shared';

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
  userName: string;
}

const STORAGE_KEY = 'hydrosense.dashboard.role.v1';
const RoleContext = createContext<RoleContextValue | null>(null);

function initialRole(): Role {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === 'operator' || saved === 'manager' || saved === 'admin' ? saved : 'admin';
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(initialRole);
  const setRole = (nextRole: Role) => {
    window.localStorage.setItem(STORAGE_KEY, nextRole);
    setRoleState(nextRole);
  };
  const userName = role === 'operator' ? 'Juan Dela Cruz' : role === 'manager' ? 'Maria Santos' : 'Dario Minoza';
  const value = useMemo(() => ({ role, setRole, userName }), [role]);
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const value = useContext(RoleContext);
  if (!value) throw new Error('useRole must be used within RoleProvider.');
  return value;
}
