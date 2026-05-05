import { useState } from 'react';
import { useTheme } from '../../contexts/themeContext';
import { JOB_COLORS, ABS } from '../../i18n/translations';

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const { t, th, isDark } = useTheme();

  return (
    <aside
      style={{
        width: isOpen ? 240 : 52,
        background: th.bgCard,
        borderRight: `1px solid ${th.border}`,
        transition: 'width 0.3s cubic-bezier(0.16,1,0.3,1), background 0.4s ease',
        overflow: 'hidden',
        flexShrink: 0,
        minHeight: 'calc(100vh - 72px)',
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '16px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: th.goldDim,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontFamily: "'Outfit',sans-serif",
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: 'uppercase',
            transition: 'opacity 0.2s',
            opacity: isOpen ? 1 : 0,
          }}
        >
          {t.objekte}
        </span>
        <span
          style={{
            fontSize: 14,
            transition: 'transform 0.3s ease',
            transform: isOpen ? 'rotate(0)' : 'rotate(180deg)',
          }}
        >
          ◂
        </span>
      </button>

      {isOpen && (
        <div style={{ padding: '0 14px 20px', animation: 'fadeIn 0.4s ease' }}>
          {Object.entries(JOB_COLORS).map(([code, job]) => (
            <div
              key={code}
              draggable
              style={{
                padding: '9px 11px',
                marginBottom: 3,
                background: isDark ? job.bgD : job.bgL,
                color: isDark ? job.textD : job.textL,
                borderRadius: 2,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "'Outfit',sans-serif",
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transition: 'transform 0.15s ease',
                letterSpacing: 0.2,
                boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.08)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateX(3px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateX(0)')}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 2,
                  background: 'rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {code.toUpperCase()}
              </span>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 10,
                }}
              >
                {job.label}
              </span>
            </div>
          ))}

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${th.border}` }}>
            <p
              style={{
                fontSize: 8,
                color: th.goldDim,
                marginBottom: 10,
                letterSpacing: 3,
                textTransform: 'uppercase',
                fontFamily: "'Outfit',sans-serif",
                fontWeight: 600,
              }}
            >
              {t.absenzen}
            </p>
            {Object.entries(ABS).map(([code, abs]) => (
              <div
                key={code}
                style={{
                  padding: '6px 10px',
                  marginBottom: 2,
                  background: th.btnBg,
                  borderLeft: `2px solid ${abs.bg}`,
                  borderRadius: '0 2px 2px 0',
                  fontSize: 10,
                  color: th.textMuted,
                  fontFamily: "'Outfit',sans-serif",
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 12 }}>{abs.icon}</span>
                <span>{t.abs[code]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </aside>
  );
}
