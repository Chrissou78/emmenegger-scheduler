// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/themeContext';
import { useAuthStore } from './contexts/authStore';
import { useRolesStore } from './store/rolesStore';
import { useEffect, useMemo } from 'react';
import { resolvePermissions, type Role, type Permission } from '../../shared/constants/roles';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { SchedulePage } from './pages/SchedulePage';
import { MachinesPage } from './pages/MachinesPage';
import { ReportsPage } from './pages/ReportsPage';
import AdminPage from './pages/AdminPage';
import { StatsPage } from './pages/StatsPage';
import { ProfilePage } from './pages/ProfilePage';
import { TasksPage } from './pages/TasksPage';
import { CustomersPage } from './pages/CustomersPage';
import { QuotationsPage } from './pages/QuotationsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import HRPage from './pages/HRPage';
import CrmPage from './pages/CrmPage';
import SettingsPage from './pages/settings';

/* ─── Map legacy DB roles to the 6-role system ─── */
function normalizeRole(raw: string): Role {
  const upper = (raw || '').toUpperCase();
  switch (upper) {
    case 'GLOBAL_MANAGER': return 'ADMIN';
    case 'LOCAL_MANAGER':  return 'MANAGER';
    case 'ARBEITER':       return 'EMPLOYEE';
    default:               return (upper as Role) || 'EMPLOYEE';
  }
}

/* ─── Auth guard ─── */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/* ─── Permission guard ─── */
function RequirePermission({
  children,
  permission,
  fallback = "/reports",
}: {
  children: React.ReactNode;
  permission: Permission;
  fallback?: string;
}) {
  const { user } = useAuthStore();
  const { permissionMap } = useRolesStore();

  const hasPermission = useMemo(() => {
    if (!user) return false;
    const role = normalizeRole(user.role);
    const perms = resolvePermissions(role, user.custom_permissions, permissionMap);
    return perms.has(permission);
  }, [user, permissionMap, permission]);

  if (!hasPermission) return <Navigate to={fallback} replace />;
  return <>{children}</>;
}

function AppContent() {
  const { token, user, checkAuth } = useAuthStore();
  const { fetchRoles } = useRolesStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (token) {
      fetchRoles(token);
    }
  }, [token, fetchRoles]);

  const getDefaultRoute = () => {
    if (!user) return '/login';
    const role = normalizeRole(user.role);
    switch (role) {
      case 'ADMIN':
      case 'MANAGER':
        return '/schedule';
      case 'HR':
        return '/hr';
      case 'FINANCE':
        return '/invoices';
      case 'SALES':
        return '/customers';
      case 'EMPLOYEE':
      default:
        return '/reports';
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
            <RequirePermission permission="schedule.view">
              <SchedulePage />
            </RequirePermission>
          } />

          <Route path="/machines" element={
            <RequirePermission permission="machines.view">
              <MachinesPage />
            </RequirePermission>
          } />

          <Route path="/tasks" element={
            <RequirePermission permission="tasks.view">
              <TasksPage />
            </RequirePermission>
          } />

          <Route path="/customers" element={
            <RequirePermission permission="customers.view">
              <CustomersPage />
            </RequirePermission>
          } />

          <Route path="/quotations" element={
            <RequirePermission permission="quotations.view">
              <QuotationsPage />
            </RequirePermission>
          } />

          <Route path="/invoices" element={
            <RequirePermission permission="invoices.view">
              <InvoicesPage />
            </RequirePermission>
          } />

          <Route path="/stats" element={
            <RequirePermission permission="reports.team">
              <StatsPage />
            </RequirePermission>
          } />

          <Route path="/hr" element={
            <RequirePermission permission="hr.view">
              <HRPage />
            </RequirePermission>
          } />

          <Route path="/admin" element={
            <RequirePermission permission="admin.view">
              <AdminPage />
            </RequirePermission>
          } />

          <Route path="/settings" element={
            <RequirePermission permission="admin.roles">
              <SettingsPage />
            </RequirePermission>
          } />

          {/* Available to all authenticated users */}
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/crm" element={<CrmPage />} />

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
