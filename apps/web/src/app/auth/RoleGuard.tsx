import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Role } from '@hydrosense/shared';
import { canAccessRole } from '@hydrosense/shared';
import { useAuth } from './RoleContext';

export function RoleGuard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = useAuth();
  const location = useLocation();
  return user?.role && canAccessRole(user.role, roles)
    ? children
    : <Navigate to="/" replace state={{ deniedPath: location.pathname }} />;
}
