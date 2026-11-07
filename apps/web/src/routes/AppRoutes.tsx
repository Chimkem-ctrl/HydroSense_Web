import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import SignInPage from '../pages/auth/SignInPage';
import SignUpPage from '../pages/auth/SignUpPage';
import SplashScreen from '../pages/auth/SplashScreen';
import WelcomePage from '../pages/auth/WelcomePage';
import DashboardPage from '../pages/DashboardPage';
import OperatorDashboardPage from '../pages/OperatorDashboardPage';
import OperatorProfilePage from '../pages/OperatorProfilePage';
import AccountSettingsPage from '../pages/settings/AccountSettingsPage';
import { getCurrentUser } from '../services/authService';
import type { AccountRole } from '../types/auth.types';

function RoleRoute({ role, children }: { role: AccountRole; children: ReactNode }) {
  const user = getCurrentUser();
  return user?.role === role
    ? children
    : <Navigate to="/signin" replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<SplashScreen />} />
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/dashboard/*" element={<RoleRoute role="ADMINISTRATOR"><DashboardPage /></RoleRoute>} />
      <Route path="/operator/profile" element={<RoleRoute role="OPERATOR"><OperatorProfilePage /></RoleRoute>} />
      <Route path="/operator/*" element={<RoleRoute role="OPERATOR"><OperatorDashboardPage /></RoleRoute>} />
      <Route path="/settings" element={<RoleRoute role="ADMINISTRATOR"><AccountSettingsPage /></RoleRoute>} />
      <Route path="*" element={<Navigate to="/welcome" replace />} />
    </Routes>
  );
}
