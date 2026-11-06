import { Navigate, Route, Routes } from 'react-router-dom';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import SignInPage from '../pages/auth/SignInPage';
import SignUpPage from '../pages/auth/SignUpPage';
import SplashScreen from '../pages/auth/SplashScreen';
import WelcomePage from '../pages/auth/WelcomePage';
import DashboardPage from '../pages/DashboardPage';
import AccountSettingsPage from '../pages/settings/AccountSettingsPage';
import UserManagementPage from '../pages/admin/UserManagementPage';
import RoleGuard from './RoleGuard';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<SplashScreen />} />
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route element={<RoleGuard allowedRoles={['admin', 'operator']} />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={<AccountSettingsPage />} />
      </Route>
      <Route element={<RoleGuard allowedRoles={['admin']} />}>
        <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
        <Route path="/admin/users" element={<UserManagementPage />} />
      </Route>
      <Route path="/operator" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/welcome" replace />} />
    </Routes>
  );
}
