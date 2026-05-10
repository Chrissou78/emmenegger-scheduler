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

  const [email, setEmail] = useState('ceo@emmenegger.ch');
  const [password, setPassword] = useState('emmenegger2026');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const setCeoAccount = () => { setEmail('ceo@emmenegger.ch'); setPassword('emmenegger2026'); };
  const setExecAccount = () => { setEmail('admin@emmenegger.ch'); setPassword('admin'); };
  const setMarcoAccount = () => { setEmail('marco.cancela@emmenegger.ch'); setPassword('emmenegger2026'); };
  const setWorkerAccount = () => { setEmail('worker@emmenegger.ch'); setPassword('worker2026'); };
  const setHrAccount = () => { setEmail('hr@emmenegger.ch'); setPassword('emmenegger2026'); };
  const setFinanceAccount = () => { setEmail('finance@emmenegger.ch'); setPassword('emmenegger2026'); };
  const setSalesAccount = () => { setEmail('sales@emmenegger.ch'); setPassword('emmenegger2026'); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      const user = useAuthStore.getState().user;
      const role = (user?.role || '').toUpperCase();
      switch (role) {
        case 'CEO': navigate('/schedule'); break;
        case 'ADMIN':
        case 'GLOBAL_MANAGER': navigate('/schedule'); break;
        case 'MANAGER':
        case 'LOCAL_MANAGER': navigate('/schedule'); break;
        case 'HR': navigate('/hr'); break;
        case 'FINANCE': navigate('/invoices'); break;
        case 'SALES': navigate('/customers'); break;
        default: navigate('/reports');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

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
                placeholder="ceo@emmenegger.ch" required
                style={{
                  width: '100%', padding: '12px 12px 12px 40px', border: `1px solid ${th.border}`,
                  borderRadius: '6px', backgroundColor: isDark ? '#1a1a1a' : '#fafaf8',
                  color: th.text, fontSize: '14px', outline: 'none', transition: 'border-color 0.2s',
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
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
                style={{
                  width: '100%', padding: '12px 40px 12px 40px', border: `1px solid ${th.border}`,
                  borderRadius: '6px', backgroundColor: isDark ? '#1a1a1a' : '#fafaf8',
                  color: th.text, fontSize: '14px', outline: 'none',
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
          <button type="submit" disabled={loading}
            style={{
              width: '100%', padding: '12px', backgroundColor: loading ? th.textMuted : th.gold,
              color: isDark ? '#0a0a0a' : '#1a1a0a', border: 'none', borderRadius: '6px',
              fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s', marginBottom: '20px',
            }}
            onMouseOver={(e) => !loading && (e.currentTarget.style.opacity = '0.9')}
            onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}>
            {loading ? lt.signingIn : lt.signIn}
          </button>
        </form>

        {/* Dev Quick Buttons — row 1: CEO, Executive, Manager */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <button onClick={setCeoAccount}
            style={{ padding: '10px 6px', backgroundColor: th.btnBg, border: `1px solid ${th.border}`, borderRadius: '6px', color: th.gold, fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = th.btnBgHover)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = th.btnBg)}>
            👑 {lt.ceo}
          </button>
          <button onClick={setExecAccount}
            style={{ padding: '10px 6px', backgroundColor: th.btnBg, border: `1px solid ${th.border}`, borderRadius: '6px', color: '#3b82f6', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = th.btnBgHover)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = th.btnBg)}>
            👔 {lt.executive}
          </button>
          <button onClick={setMarcoAccount}
            style={{ padding: '10px 6px', backgroundColor: th.btnBg, border: `1px solid ${th.border}`, borderRadius: '6px', color: '#6495ed', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = th.btnBgHover)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = th.btnBg)}>
            🔧 {lt.manager}
          </button>
        </div>

        {/* Dev Quick Buttons — row 2: Worker, HR, Finance, Sales */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '20px' }}>
          <button onClick={setWorkerAccount}
            style={{ padding: '10px 6px', backgroundColor: th.btnBg, border: `1px solid ${th.border}`, borderRadius: '6px', color: '#4caf50', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = th.btnBgHover)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = th.btnBg)}>
            👤 {lt.worker}
          </button>
          <button onClick={setHrAccount}
            style={{ padding: '10px 6px', backgroundColor: th.btnBg, border: `1px solid ${th.border}`, borderRadius: '6px', color: '#e891b2', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = th.btnBgHover)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = th.btnBg)}>
            🧑‍💼 {lt.hr}
          </button>
          <button onClick={setFinanceAccount}
            style={{ padding: '10px 6px', backgroundColor: th.btnBg, border: `1px solid ${th.border}`, borderRadius: '6px', color: '#f0b347', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = th.btnBgHover)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = th.btnBg)}>
            💰 {lt.finance}
          </button>
          <button onClick={setSalesAccount}
            style={{ padding: '10px 6px', backgroundColor: th.btnBg, border: `1px solid ${th.border}`, borderRadius: '6px', color: '#42b883', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = th.btnBgHover)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = th.btnBg)}>
            🤝 {lt.sales}
          </button>
        </div>

        {/* Credentials hint */}
        <div style={{ fontSize: '11px', color: th.textMuted, textAlign: 'center', lineHeight: 1.8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{lt.devHint}</div>
          <div>👑 <code style={{ color: th.gold }}>ceo@emmenegger.ch</code> / <code style={{ color: th.gold }}>emmenegger2026</code></div>
          <div>👔 <code style={{ color: '#3b82f6' }}>admin@emmenegger.ch</code> / <code style={{ color: '#3b82f6' }}>admin</code></div>
          <div>🔧 <code style={{ color: '#6495ed' }}>marco.cancela@emmenegger.ch</code> / <code style={{ color: '#6495ed' }}>emmenegger2026</code></div>
          <div>👤 <code style={{ color: '#4caf50' }}>worker@emmenegger.ch</code> / <code style={{ color: '#4caf50' }}>worker2026</code></div>
          <div>🧑‍💼 <code style={{ color: '#e891b2' }}>hr@emmenegger.ch</code> / <code style={{ color: '#e891b2' }}>emmenegger2026</code></div>
          <div>💰 <code style={{ color: '#f0b347' }}>finance@emmenegger.ch</code> / <code style={{ color: '#f0b347' }}>emmenegger2026</code></div>
          <div>🤝 <code style={{ color: '#42b883' }}>sales@emmenegger.ch</code> / <code style={{ color: '#42b883' }}>emmenegger2026</code></div>
        </div>
      </div>
    </div>
  );
}
