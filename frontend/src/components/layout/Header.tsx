import { useTheme } from '../../contexts/themeContext';
import { useAuthStore } from '../../contexts/authStore';
import { Pill } from '../shared/Pill';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  view: string;
  setView: (view: string) => void;
  dept: string;
  setDept: (dept: string) => void;
}

export function Header({ view, setView, dept, setDept }: HeaderProps) {
  const { mode, lang, toggleTheme, setLanguage, t, th, isDark } = useTheme();
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header
      style={{
        background: th.bgHeader,
        borderBottom: `1px solid ${th.border}`,
        padding: '0 28px',
        height: 72,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        transition: 'background 0.4s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ position: 'relative', width: 38, height: 38 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              border: `1.5px solid ${th.logoRotateBorder}`,
              borderRadius: 2,
              transform: 'rotate(45deg)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 19,
              fontWeight: 700,
              color: th.gold,
            }}
          >
            E
          </div>
        </div>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 21,
              fontWeight: 300,
              letterSpacing: 3,
              color: th.gold,
              textTransform: 'uppercase',
            }}
          >
            {t.brand}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 9,
              color: th.goldDim,
              letterSpacing: 4,
              textTransform: 'uppercase',
              fontFamily: "'Outfit',sans-serif",
              fontWeight: 500,
            }}
          >
            {t.sub}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* View tabs */}
        <div style={{ display: 'flex', gap: 1, background: th.switchBg, borderRadius: 2, padding: 2 }}>
          {[
            ['day', t.day],
            ['week', t.week],
            ['month', t.month],
            ['year', t.year],
          ].map(([v, l]) => (
            <Pill key={v} active={view === v} onClick={() => setView(v)}>
              {l}
            </Pill>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: th.goldFaint }} />

        {/* Dept */}
        <div style={{ display: 'flex', gap: 1, background: th.switchBg, borderRadius: 2, padding: 2 }}>
          {[
            ['all', t.all],
            ['garten', t.garten],
            ['unterhalt', t.unterhalt],
          ].map(([v, l]) => (
            <Pill key={v} active={dept === v} onClick={() => setDept(v)}>
              {l}
            </Pill>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: th.goldFaint }} />

        {/* Lang */}
        <div style={{ display: 'flex', gap: 1, background: th.switchBg, borderRadius: 2, padding: 2 }}>
          {['de', 'en', 'fr', 'pt'].map((l) => (
            <Pill key={l} active={lang === l} onClick={() => setLanguage(l as any)}>
              {l.toUpperCase()}
            </Pill>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: th.goldFaint }} />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={{
            width: 36,
            height: 36,
            borderRadius: 2,
            border: `1px solid ${th.goldFaint}`,
            background: 'transparent',
            color: th.gold,
            cursor: 'pointer',
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = th.switchActive;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          {isDark ? '☀' : '☽'}
        </button>

        <div style={{ width: 1, height: 24, background: th.goldFaint }} />

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 16px',
            borderRadius: 2,
            border: `1px solid ${th.goldFaint}`,
            background: 'transparent',
            color: th.gold,
            cursor: 'pointer',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 1,
            textTransform: 'uppercase',
            fontFamily: "'Outfit',sans-serif",
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = th.switchActive;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          {t.logout}
        </button>
      </div>
    </header>
  );
}
