import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { homeForRole, sessionService } from '../services/sessionService';
import type { UserRole } from '../types/auth.types';

interface RoleGuardProps {
  allowedRoles: UserRole[];
}

export default function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const location = useLocation();
  const session = sessionService.get();

  if (!session) {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }
  if (!allowedRoles.includes(session.role)) {
    return <Navigate to={homeForRole[session.role]} replace />;
  }
  return <Outlet />;
}
