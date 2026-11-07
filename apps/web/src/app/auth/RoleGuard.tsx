import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Role } from '@hydrosense/shared';
import { canAccessRole } from '@hydrosense/shared';
import { useRole } from './RoleContext';

export function RoleGuard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { role } = useRole();
  const location = useLocation();
  return canAccessRole(role, roles)
    ? children
    : <Navigate to="/" replace state={{ deniedPath: location.pathname }} />;
}
