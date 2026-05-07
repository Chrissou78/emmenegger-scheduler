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

/* ─── Auth guard ─── */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/* ─── Role guard ─── */
function RequireRole({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { user } = useAuthStore();
  const userRole = (user?.role || '').toUpperCase();
  if (!roles.some(r => r.toUpperCase() === userRole)) {
    const fallback = userRole === 'ARBEITER' ? '/reports' : '/schedule';
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}

function AppContent() {
  const { token, user, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const getDefaultRoute = () => {
    if (!user) return '/login';
    switch ((user.role || '').toUpperCase()) {
      case 'ARBEITER': return '/reports';
      case 'LOCAL_MANAGER': return '/schedule';
      case 'GLOBAL_MANAGER': return '/schedule';
      default: return '/reports';
    }
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={token ? <Navigate to={getDefaultRoute()} /> : <LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* All protected routes inside AppShell */}
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>

          <Route path="/schedule" element={
            <RequireRole roles={['LOCAL_MANAGER', 'GLOBAL_MANAGER']}>
              <SchedulePage />
            </RequireRole>
          } />

          <Route path="/machines" element={
            <RequireRole roles={['LOCAL_MANAGER', 'GLOBAL_MANAGER']}>
              <MachinesPage />
            </RequireRole>
          } />

          <Route path="/stats" element={
            <RequireRole roles={['LOCAL_MANAGER', 'GLOBAL_MANAGER']}>
              <StatsPage />
            </RequireRole>
          } />

          <Route path="/admin" element={
            <RequireRole roles={['GLOBAL_MANAGER']}>
              <AdminPage />
            </RequireRole>
          } />

          {/* Available to all authenticated users */}
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
        </Route>

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
