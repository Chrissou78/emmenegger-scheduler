import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/themeContext';
import { useAuthStore } from '../../contexts/authStore';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { path: '/schedule',  label: 'Disposition',        icon: '📅', roles: ['GLOBAL_MANAGER', 'LOCAL_MANAGER'] },
  { path: '/machines',  label: 'Maschinen',          icon: '🚜', roles: ['GLOBAL_MANAGER', 'LOCAL_MANAGER'] },
  { path: '/reports',   label: 'Meine Woche',        icon: '📋' },
  { path: '/stats',     label: 'Statistiken',        icon: '📊', roles: ['GLOBAL_MANAGER', 'LOCAL_MANAGER'] },
  { path: '/admin',     label: 'Benutzerverwaltung', icon: '👥', roles: ['GLOBAL_MANAGER'] },
  { path: '/profile',   label: 'Profil',             icon: '👤' },
];

export function AppShell() {
  const { isDark, th, t, lang, toggleTheme, setLanguage } = useTheme();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const gold = th.gold;
  const sideW = collapsed ? 64 : 220;
  const userRole = (user?.role || '').toUpperCase();
  const isWorker = userRole === 'ARBEITER';

  /* ─── Redirect workers away from manager-only pages ─── */
  useEffect(() => {
    const managerOnlyPaths = ['/schedule', '/machines', '/stats', '/admin'];
    if (isWorker && managerOnlyPaths.some(p => location.pathname.startsWith(p))) {
      navigate('/reports', { replace: true });
    }
  }, [location.pathname, isWorker, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = NAV_ITEMS.filter(item => {
    if (!item.roles) return true;
    return item.roles.some(r => r.toUpperCase() === userRole);
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: th.bg }}>
      {/* ─── SIDEBAR ─── */}
      <aside style={{
        width: sideW, minHeight: '100vh', background: th.bgCard,
        borderRight: `1px solid ${th.border}`, display: 'flex', flexDirection: 'column',
        transition: 'width .25s ease', overflow: 'hidden', flexShrink: 0,
        position: 'sticky', top: 0, height: '100vh',
      }}>
        {/* logo */}
        <div style={{
          padding: collapsed ? '20px 0' : '20px 18px', display: 'flex', alignItems: 'center',
          gap: 12, borderBottom: `1px solid ${th.border}`, minHeight: 72,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <div style={{ width: 36, height: 36, position: 'relative', flexShrink: 0 }}>
            <div style={{
              position: 'absolute', inset: 0,
              border: `1.5px solid ${isDark ? 'rgba(200,169,110,.3)' : 'rgba(200,169,110,.5)'}`,
              borderRadius: 2, transform: 'rotate(45deg)',
            }} />
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, color: gold,
            }}>E</div>
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: 16, fontWeight: 300, letterSpacing: 2, color: gold, textTransform: 'uppercase' }}>
                {t.brand}
              </div>
              <div style={{ fontSize: 8, color: th.textDim, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 500 }}>
                {t.sub}
              </div>
            </div>
          )}
        </div>

        {/* nav */}
        <nav style={{ flex: 1, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visibleItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: collapsed ? '12px 0' : '12px 18px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: active
                    ? (isDark ? 'rgba(200,169,110,.12)' : 'rgba(200,169,110,.1)')
                    : 'transparent',
                  border: 'none', cursor: 'pointer', width: '100%',
                  borderLeft: active ? `3px solid ${gold}` : '3px solid transparent',
                  color: active ? gold : th.text,
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  transition: 'all .15s', textAlign: 'left',
                  fontFamily: "'Inter','Segoe UI',sans-serif",
                }}
                onMouseEnter={e => {
                  if (!active) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)';
                }}
                onMouseLeave={e => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
                title={collapsed ? item.label : undefined}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* bottom */}
        <div style={{
          borderTop: `1px solid ${th.border}`, padding: collapsed ? '12px 0' : '12px 18px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {!collapsed && user && (
            <div style={{ padding: '8px 0', marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: th.text }}>{user.email}</div>
              <div style={{ fontSize: 11, color: th.textDim }}>{
                userRole === 'GLOBAL_MANAGER' ? 'Global Manager' :
                userRole === 'LOCAL_MANAGER' ? 'Lokal Manager' : 'Arbeiter'
              }</div>
            </div>
          )}

          <div style={{
            display: 'flex', gap: 4, justifyContent: collapsed ? 'center' : 'flex-start',
            flexWrap: 'wrap',
          }}>
            {!collapsed && ['de', 'en', 'fr', 'pt'].map(l => (
              <button key={l} onClick={() => setLanguage?.(l as any)}
                style={{
                  padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  fontSize: 10, fontWeight: 700, letterSpacing: .5,
                  background: lang === l ? gold : 'transparent',
                  color: lang === l ? '#fff' : th.textDim,
                  transition: 'all .15s',
                }}
              >{l.toUpperCase()}</button>
            ))}
            <button onClick={toggleTheme}
              style={{
                padding: '4px 8px', borderRadius: 4, border: `1px solid ${th.border}`,
                background: 'transparent', color: gold, cursor: 'pointer', fontSize: 14,
              }}
            >{isDark ? '☀' : '☽'}</button>
          </div>

          <button onClick={() => setCollapsed(c => !c)}
            style={{
              padding: '8px', borderRadius: 4, border: `1px solid ${th.border}`,
              background: 'transparent', color: th.textDim, cursor: 'pointer',
              fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >{collapsed ? '»' : '«'}</button>

          <button onClick={handleLogout}
            style={{
              padding: '10px', borderRadius: 4, border: `1px solid ${th.border}`,
              background: 'transparent', color: th.text, cursor: 'pointer',
              fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 14 }}>🚪</span>
            {!collapsed && <span>{t.logout}</span>}
          </button>
        </div>
      </aside>

      {/* ─── MAIN ─── */}
      <main style={{ flex: 1, minHeight: '100vh', overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
