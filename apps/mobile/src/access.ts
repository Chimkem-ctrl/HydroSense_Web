import { canAccessRole } from '@hydrosense/shared';
import type { Role } from '@hydrosense/shared';

const access: Record<'history' | 'thresholds' | 'validation' | 'admin', Role[]> = {
  history: ['manager', 'admin'],
  thresholds: ['manager', 'admin'],
  validation: ['manager', 'admin'],
  admin: ['admin'],
};

export function canAccess(role: Role | null, feature: keyof typeof access): boolean {
  return canAccessRole(role, access[feature]);
}
