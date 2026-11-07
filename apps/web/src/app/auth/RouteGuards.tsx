import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './RoleContext';

export function getSafeInAppPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null;
  }
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuth();
  const location = useLocation();
  if (user?.role) return children;
  const from = getSafeInAppPath(`${location.pathname}${location.search}${location.hash}`);
  return <Navigate to="/signin" replace state={{ from: from ?? '/' }} />;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const user = useAuth();
  return user?.role ? <Navigate to="/" replace /> : children;
}
