import { Navigate, Route, Routes } from 'react-router-dom';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import SignInPage from '../pages/auth/SignInPage';
import SignUpPage from '../pages/auth/SignUpPage';
import SplashScreen from '../pages/auth/SplashScreen';
import WelcomePage from '../pages/auth/WelcomePage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<SplashScreen />} />
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="*" element={<Navigate to="/welcome" replace />} />
    </Routes>
  );
}
