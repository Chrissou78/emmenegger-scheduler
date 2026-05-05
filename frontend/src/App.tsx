import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/themeContext';
import { useAuthStore } from './contexts/authStore';
import { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { SchedulePage } from './pages/SchedulePage';
import { MachinesPage } from './pages/MachinesPage';
import { ReportsPage } from './pages/ReportsPage';
import { AdminPage } from './pages/AdminPage';
import { StatsPage } from './pages/StatsPage';
import { ProfilePage } from './pages/ProfilePage';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, token } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppContent() {
  const { token, user, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const getDefaultRoute = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'ARBEITER': return '/reports';
      case 'LOCAL_MANAGER': return '/schedule';
      case 'GLOBAL_MANAGER': return '/schedule';
      default: return '/schedule';
    }
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes (no layout) */}
        <Route path="/login" element={token ? <Navigate to={getDefaultRoute()} /> : <LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected Routes (with AppShell layout) */}
        <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route path="/schedule" element={
            <ProtectedRoute roles={['LOCAL_MANAGER', 'GLOBAL_MANAGER']}>
              <SchedulePage />
            </ProtectedRoute>
          } />

          <Route path="/machines" element={
            <ProtectedRoute roles={['LOCAL_MANAGER', 'GLOBAL_MANAGER']}>
              <MachinesPage />
            </ProtectedRoute>
          } />

          <Route path="/reports" element={<ReportsPage />} />

          <Route path="/admin" element={
            <ProtectedRoute roles={['GLOBAL_MANAGER']}>
              <AdminPage />
            </ProtectedRoute>
          } />

          <Route path="/stats" element={
            <ProtectedRoute roles={['LOCAL_MANAGER', 'GLOBAL_MANAGER']}>
              <StatsPage />
            </ProtectedRoute>
          } />

          <Route path="/profile" element={<ProfilePage />} />

          <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
