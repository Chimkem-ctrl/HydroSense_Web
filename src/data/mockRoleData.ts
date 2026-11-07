import { operatorActivities } from './mockDashboardData';
import type { OperatorActivity } from './mockDashboardData';
import type { UserRole } from '../types/auth.types';

export type NavIconKey =
  | 'dashboard'
  | 'monitoring'
  | 'alerts'
  | 'logs'
  | 'devices'
  | 'reports'
  | 'settings';

export type MetricIconKey = 'tanks' | 'gauge' | 'wifi' | 'alert' | 'shield' | 'clipboard';

export interface RoleProfile {
  fullName: string;
  firstName: string;
  initials: string;
  title: string;
  shortTitle: string;
  consoleLabel: string;
}

export interface RoleNavItem {
  label: string;
  icon: NavIconKey;
  target: string;
}

export interface RoleMetric {
  label: string;
  value: string;
  note: string;
  icon: MetricIconKey;
  tone: string;
}

export interface RoleMockData {
  profile: RoleProfile;
  navigation: RoleNavItem[];
  metrics: RoleMetric[];
  activities: OperatorActivity[];
}

const OPERATOR_NAME = 'Juan Dela Cruz';

const roleData: Record<UserRole, RoleMockData> = {
  admin: {
    profile: {
      fullName: 'Dario Miñoza',
      firstName: 'Dario',
      initials: 'DM',
      title: 'System Administrator',
      shortTitle: 'Administrator',
      consoleLabel: 'ADMIN CONSOLE',
    },
    navigation: [
      { label: 'Dashboard', icon: 'dashboard', target: 'dashboard-top' },
      { label: 'Monitoring', icon: 'monitoring', target: 'water-quality' },
      { label: 'Alerts', icon: 'alerts', target: 'active-alerts' },
      { label: 'Operator Logs', icon: 'logs', target: 'operator-activity' },
      { label: 'Devices', icon: 'devices', target: 'connected-devices' },
      { label: 'Reports', icon: 'reports', target: 'water-trends' },
      { label: 'Settings', icon: 'settings', target: 'quick-actions' },
    ],
    metrics: [
      { label: 'Total Tanks', value: '3', note: 'Across this hatchery', icon: 'tanks', tone: 'aqua' },
      { label: 'Monitoring Devices', value: '3', note: 'Active monitoring', icon: 'gauge', tone: 'blue' },
      { label: 'Online Sensors', value: '3', note: 'All systems online', icon: 'wifi', tone: 'green' },
      { label: 'Active Alerts', value: '2', note: '1 critical · 1 warning', icon: 'alert', tone: 'orange' },
      { label: 'Critical Alerts', value: '1', note: 'Requires verification', icon: 'shield', tone: 'critical' },
      { label: 'Registered Operators', value: '5', note: 'Team members', icon: 'clipboard', tone: 'violet' },
    ],
    activities: operatorActivities,
  },
  operator: {
    profile: {
      fullName: OPERATOR_NAME,
      firstName: 'Juan',
      initials: 'JD',
      title: 'Hatchery Operator',
      shortTitle: 'Operator',
      consoleLabel: 'OPERATOR CONSOLE',
    },
    navigation: [
      { label: 'Dashboard', icon: 'dashboard', target: 'dashboard-top' },
      { label: 'Monitoring', icon: 'monitoring', target: 'water-quality' },
      { label: 'Alerts', icon: 'alerts', target: 'active-alerts' },
      { label: 'My Logs', icon: 'logs', target: 'operator-activity' },
      { label: 'Devices', icon: 'devices', target: 'connected-devices' },
      { label: 'Settings', icon: 'settings', target: 'quick-actions' },
    ],
    metrics: [
      { label: 'Assigned Tanks', value: '3', note: 'Under your care', icon: 'tanks', tone: 'aqua' },
      { label: 'Sensors Reporting', value: '3', note: 'Live readings', icon: 'gauge', tone: 'blue' },
      { label: 'Online Sensors', value: '3', note: 'All systems online', icon: 'wifi', tone: 'green' },
      { label: 'Open Alerts', value: '2', note: 'Awaiting acknowledgment', icon: 'alert', tone: 'orange' },
      { label: 'Critical Alerts', value: '1', note: 'Verify on site', icon: 'shield', tone: 'critical' },
      {
        label: 'My Logs Today',
        value: String(operatorActivities.filter((a) => a.operator === OPERATOR_NAME && a.time !== 'Yesterday').length),
        note: 'Entries recorded',
        icon: 'clipboard',
        tone: 'violet',
      },
    ],
    activities: operatorActivities.filter((a) => a.operator === OPERATOR_NAME),
  },
};

export function getMockDataByRole(role: UserRole): RoleMockData {
  return roleData[role];
}
