import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../contexts/themeContext';
import { useAuthStore } from '../contexts/authStore';
import { themes } from '../i18n/visual';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { getTranslations, type LangCode } from '../i18n';

export function LoginPage() {
  const { t, isDark, lang, setLanguage, toggleTheme, enabledLangs } = useTheme();
  const th = isDark ? themes.dark : themes.light;
  const navigate = useNavigate();
  const { login, loading, error: authError } = useAuthStore();
  const lt = getTranslations(lang as LangCode);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [quickLoading, setQuickLoading] = useState<string | null>(null);

  /* ─── Navigate based on role after login ─── */
  const navigateByRole = () => {
    const user = useAuthStore.getState().user;
    const role = (user?.role || '').toUpperCase();
    switch (role) {
      case 'CEO':
      case 'ADMIN':
      case 'GLOBAL_MANAGER':
      case 'MANAGER':
      case 'LOCAL_MANAGER':
        navigate('/schedule'); break;
      case 'HR': navigate('/hr'); break;
      case 'FINANCE': navigate('/invoices'); break;
      case 'SALES': navigate('/customers'); break;
      default: navigate('/reports');
    }
  };

  /* ─── Form submit ─── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigateByRole();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  /* ─── Direct login helper for test buttons ─── */
  const quickLogin = async (qEmail: string, qPassword: string, label: string) => {
    setError('');
    setQuickLoading(label);
    try {
      await login(qEmail, qPassword);
      navigateByRole();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Login as ${label} failed`);
    } finally {
      setQuickLoading(null);
    }
  };

  const isLoading = loading || !!quickLoading;

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: th.bg, color: th.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: '400px', padding: '40px 30px',
        backgroundColor: th.bgCard, borderRadius: '10px',
        boxShadow: `0 10px 40px ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)'}`,
      }}>
        {/* Top controls: language + theme */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {enabledLangs.map(l => (
              <button key={l}
                onClick={() => { if (setLanguage) setLanguage(l); }}
                style={{
                  padding: '5px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700, letterSpacing: .5,
                  background: lang === l ? th.gold : 'transparent',
                  color: lang === l ? '#fff' : th.textMuted,
                  transition: 'all .15s',
                }}
              >{l.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={toggleTheme}
            style={{
              padding: '5px 10px', borderRadius: 4, border: `1px solid ${th.border}`,
              background: 'transparent', color: th.gold, cursor: 'pointer', fontSize: 16,
            }}
          >{isDark ? '☀' : '☽'}</button>
        </div>

        {/* Brand */}
        <h1 style={{ marginBottom: '10px', fontSize: '28px', fontWeight: '700', color: th.gold }}>
          🏗️ {t.brand}
        </h1>
        <p style={{ marginBottom: '30px', fontSize: '13px', color: th.textMuted }}>
          {t.sub}
        </p>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '500', color: th.text }}>
              {lt.email}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', color: th.textMuted }} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="email@emmenegger.ch" required disabled={isLoading}
                style={{
                  width: '100%', padding: '12px 12px 12px 40px', border: `1px solid ${th.border}`,
                  borderRadius: '6px', backgroundColor: isDark ? '#1a1a1a' : '#fafaf8',
                  color: th.text, fontSize: '14px', outline: 'none', transition: 'border-color 0.2s',
                  opacity: isLoading ? 0.6 : 1,
                }}
                onFocus={(e) => (e.target.style.borderColor = th.gold)}
                onBlur={(e) => (e.target.style.borderColor = th.border)}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '500', color: th.text }}>
              {lt.password}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', color: th.textMuted }} />
              <input type={showPassword ? 'text' : 'password'} value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required disabled={isLoading}
                style={{
                  width: '100%', padding: '12px 40px 12px 40px', border: `1px solid ${th.border}`,
                  borderRadius: '6px', backgroundColor: isDark ? '#1a1a1a' : '#fafaf8',
                  color: th.text, fontSize: '14px', outline: 'none',
                  opacity: isLoading ? 0.6 : 1,
                }}
                onFocus={(e) => (e.target.style.borderColor = th.gold)}
                onBlur={(e) => (e.target.style.borderColor = th.border)}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: th.textMuted, display: 'flex', padding: '0', alignItems: 'center' }}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Forgot Password */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
            <Link to="/forgot-password"
              style={{ fontSize: '13px', color: th.gold, textDecoration: 'none' }}
              onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}>
              {lt.forgotPassword}
            </Link>
          </div>

          {/* Error */}
          {(error || authError) && (
            <div style={{
              padding: '12px', backgroundColor: isDark ? 'rgba(139,58,58,0.3)' : 'rgba(248,215,218,0.8)',
              color: isDark ? '#ff9999' : '#721c24', borderRadius: '6px', marginBottom: '20px', fontSize: '13px',
            }}>
              {error || authError}
            </div>
          )}

          {/* Login Button */}
          <button type="submit" disabled={isLoading}
            style={{
              width: '100%', padding: '12px', backgroundColor: isLoading ? th.textMuted : th.gold,
              color: isDark ? '#0a0a0a' : '#1a1a0a', border: 'none', borderRadius: '6px',
              fontSize: '14px', fontWeight: '600', cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s', marginBottom: '20px',
            }}
            onMouseOver={(e) => !isLoading && (e.currentTarget.style.opacity = '0.9')}
            onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}>
            {isLoading ? lt.signingIn : lt.signIn}
          </button>
        </form>

        {/* ★ Quick login section label */}
        <div style={{
          fontSize: 10, fontWeight: 700, color: th.textMuted, textAlign: 'center',
          letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10,
        }}>
          {lt.quickAccess ?? 'Quick Access'}
        </div>

        {/* ★ Direct login buttons — row 1: CEO, Executive, Manager */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          {([
            { label: lt.ceo ?? 'CEO', icon: '👑', color: th.gold, email: 'ceo@emmenegger.ch', pw: 'emmenegger2026' },
            { label: lt.executive ?? 'Executive', icon: '👔', color: '#3b82f6', email: 'admin@emmenegger.ch', pw: 'admin' },
            { label: lt.manager ?? 'Manager', icon: '🔧', color: '#6495ed', email: 'marco.cancela@emmenegger.ch', pw: 'emmenegger2026' },
          ] as const).map(acc => (
            <button
              key={acc.email}
              disabled={isLoading}
              onClick={() => quickLogin(acc.email, acc.pw, acc.label)}
              style={{
                padding: '10px 6px', backgroundColor: th.btnBg,
                border: `1px solid ${quickLoading === acc.label ? acc.color : th.border}`,
                borderRadius: '6px', color: acc.color, fontSize: '11px', fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                opacity: isLoading && quickLoading !== acc.label ? 0.5 : 1,
                position: 'relative',
              }}
              onMouseOver={(e) => !isLoading && (e.currentTarget.style.backgroundColor = th.btnBgHover)}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = th.btnBg)}
            >
              {quickLoading === acc.label ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{
                    width: 12, height: 12, border: `2px solid ${acc.color}44`,
                    borderTopColor: acc.color, borderRadius: '50%',
                    animation: 'ql-spin .6s linear infinite', display: 'inline-block',
                  }} />
                  …
                </span>
              ) : (
                <>{acc.icon} {acc.label}</>
              )}
            </button>
          ))}
        </div>

        {/* ★ Direct login buttons — row 2: Worker, HR, Finance, Sales */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
          {([
            { label: lt.worker ?? 'Worker', icon: '👤', color: '#4caf50', email: 'worker@emmenegger.ch', pw: 'worker2026' },
            { label: lt.hr ?? 'HR', icon: '🧑‍💼', color: '#e891b2', email: 'hr@emmenegger.ch', pw: 'emmenegger2026' },
            { label: lt.finance ?? 'Finance', icon: '💰', color: '#f0b347', email: 'finance@emmenegger.ch', pw: 'emmenegger2026' },
            { label: lt.sales ?? 'Sales', icon: '🤝', color: '#42b883', email: 'sales@emmenegger.ch', pw: 'emmenegger2026' },
          ] as const).map(acc => (
            <button
              key={acc.email}
              disabled={isLoading}
              onClick={() => quickLogin(acc.email, acc.pw, acc.label)}
              style={{
                padding: '10px 6px', backgroundColor: th.btnBg,
                border: `1px solid ${quickLoading === acc.label ? acc.color : th.border}`,
                borderRadius: '6px', color: acc.color, fontSize: '11px', fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                opacity: isLoading && quickLoading !== acc.label ? 0.5 : 1,
              }}
              onMouseOver={(e) => !isLoading && (e.currentTarget.style.backgroundColor = th.btnBgHover)}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = th.btnBg)}
            >
              {quickLoading === acc.label ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{
                    width: 12, height: 12, border: `2px solid ${acc.color}44`,
                    borderTopColor: acc.color, borderRadius: '50%',
                    animation: 'ql-spin .6s linear infinite', display: 'inline-block',
                  }} />
                  …
                </span>
              ) : (
                <>{acc.icon} {acc.label}</>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ★ Spinner keyframes for quick-login buttons */}
      <style>{`@keyframes ql-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
