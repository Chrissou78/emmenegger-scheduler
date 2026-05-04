import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { SchedulePage } from './pages/SchedulePage';
import { MachinesPage } from './pages/MachinesPage';
import { ReportsPage } from './pages/ReportsPage';
import { AdminPage } from './pages/AdminPage';
import { StatsPage } from './pages/StatsPage';
import { ProfilePage } from './pages/ProfilePage';
import { useAuthStore } from './contexts/authStore';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, token } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { token, user } = useAuthStore();

  // Determine default landing page based on role
  const getDefaultRoute = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'ARBEITER': return '/reports';       // Workers land on their report page
      case 'LOCAL_MANAGER': return '/schedule';  // Team leads land on schedule
      case 'GLOBAL_MANAGER': return '/schedule'; // Directors land on schedule
      default: return '/schedule';
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={token ? <Navigate to={getDefaultRoute()} /> : <LoginPage />} />

          <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            {/* Schedule: managers see global, workers see personal */}
            <Route path="/schedule" element={
              <ProtectedRoute roles={['LOCAL_MANAGER', 'GLOBAL_MANAGER']}>
                <SchedulePage />
              </ProtectedRoute>
            } />

            {/* Machines: managers only */}
            <Route path="/machines" element={
              <ProtectedRoute roles={['LOCAL_MANAGER', 'GLOBAL_MANAGER']}>
                <MachinesPage />
              </ProtectedRoute>
            } />

            {/* Reports: all roles, but scoped by role */}
            <Route path="/reports" element={<ReportsPage />} />

            {/* Admin: global managers only */}
            <Route path="/admin" element={
              <ProtectedRoute roles={['GLOBAL_MANAGER']}>
                <AdminPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/:section" element={
              <ProtectedRoute roles={['GLOBAL_MANAGER']}>
                <AdminPage />
              </ProtectedRoute>
            } />

            {/* Stats: managers */}
            <Route path="/stats" element={
              <ProtectedRoute roles={['LOCAL_MANAGER', 'GLOBAL_MANAGER']}>
                <StatsPage />
              </ProtectedRoute>
            } />

            {/* Profile: all */}
            <Route path="/profile" element={<ProfilePage />} />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
