import { Navigate, Route, Routes } from 'react-router-dom';
import type { Role } from '@hydrosense/shared';
import type { ReactNode } from 'react';
import { ROLE_ACCESS } from './config';
import { RoleGuard } from './auth/RoleGuard';
import { AppShell } from '../components/shell/AppShell';
import LiveMonitorPage from '../pages/LiveMonitorPage';
import TankOverviewPage from '../pages/TankOverviewPage';
import SystemHealthPage from '../pages/SystemHealthPage';
import TrendsPage from '../pages/TrendsPage';
import ProfilePage from '../pages/ProfilePage';
import {
  AlertsPage,
  CalibrationPage,
  HistoryPage,
  ManualEntriesPage,
  ReportsPage,
  ThresholdsPage,
  ValidationPage,
} from '../pages/RecordPages';
import { ComingSoonPage, AdminLogsPage, AdminUsersPage, NotificationSettingsPage } from '../pages/AdminPages';

function Guarded({ path, children }: { path: keyof typeof ROLE_ACCESS; children: ReactNode }) {
  return <RoleGuard roles={ROLE_ACCESS[path] as Role[]}>{children}</RoleGuard>;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<LiveMonitorPage />} />
        <Route path="tanks" element={<TankOverviewPage />} />
        <Route path="health" element={<SystemHealthPage />} />
        <Route path="trends" element={<TrendsPage />} />
        <Route path="history" element={<Guarded path="history"><HistoryPage /></Guarded>} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="entries" element={<ManualEntriesPage />} />
        <Route path="calibration" element={<CalibrationPage />} />
        <Route path="reports" element={<Guarded path="reports"><ReportsPage /></Guarded>} />
        <Route path="validation" element={<Guarded path="validation"><ValidationPage /></Guarded>} />
        <Route path="settings/thresholds" element={<Guarded path="thresholds"><ThresholdsPage /></Guarded>} />
        <Route path="admin/users" element={<Guarded path="users"><AdminUsersPage /></Guarded>} />
        <Route path="admin/logs" element={<Guarded path="logs"><AdminLogsPage /></Guarded>} />
        <Route path="settings/notifications" element={<Guarded path="notifications"><NotificationSettingsPage /></Guarded>} />
        <Route path="profile" element={<Guarded path="profile"><ProfilePage /></Guarded>} />
        <Route path="fleet" element={<Guarded path="enterpriseFeatures"><ComingSoonPage feature="Multi-site fleet view" /></Guarded>} />
        <Route path="batch" element={<Guarded path="enterpriseFeatures"><ComingSoonPage feature="Batch tracking" /></Guarded>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
