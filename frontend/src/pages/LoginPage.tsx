import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../contexts/themeContext';
import { useAuthStore } from '../contexts/authStore';
import { themes, T } from '../i18n/translations';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

export function LoginPage() {
  const { t, isDark } = useTheme();
  const th = isDark ? themes.dark : themes.light;
  const navigate = useNavigate();
  const { login, loading, error: authError } = useAuthStore();
  
  const [email, setEmail] = useState('admin@emmenegger.ch');
  const [password, setPassword] = useState('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const setDevAccount = () => {
    setEmail('admin@emmenegger.ch');
    setPassword('admin');
  };

  const setMarcoAccount = () => {
    setEmail('marco.cancela@emmenegger.ch');
    setPassword('emmenegger2026');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      navigate('/schedule');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: th.bg,
        color: th.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '40px 30px',
          backgroundColor: th.bgCard,
          borderRadius: '10px',
          boxShadow: `0 10px 40px ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)'}`,
        }}
      >
        <h1 style={{ marginBottom: '10px', fontSize: '28px', fontWeight: '700', color: th.gold }}>
          🏗️ {t.brand}
        </h1>
        <p style={{ marginBottom: '30px', fontSize: '13px', color: th.textMuted }}>
          {t.sub}
        </p>

        <form onSubmit={handleSubmit}>
          {/* Email Input */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: '500',
                color: th.text,
              }}
            >
              Email
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  color: th.textMuted,
                }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@emmenegger.ch"
                required
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 40px',
                  border: `1px solid ${th.border}`,
                  borderRadius: '6px',
                  backgroundColor: isDark ? '#1a1a1a' : '#fafaf8',
                  color: th.text,
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = th.gold)}
                onBlur={(e) => (e.target.style.borderColor = th.border)}
              />
            </div>
          </div>

          {/* Password Input */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: '500',
                color: th.text,
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  color: th.textMuted,
                }}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  padding: '12px 40px 12px 40px',
                  border: `1px solid ${th.border}`,
                  borderRadius: '6px',
                  backgroundColor: isDark ? '#1a1a1a' : '#fafaf8',
                  color: th.text,
                  fontSize: '14px',
                  outline: 'none',
                }}
                onFocus={(e) => (e.target.style.borderColor = th.gold)}
                onBlur={(e) => (e.target.style.borderColor = th.border)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: th.textMuted,
                  display: 'flex',
                  padding: '0',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Forgot Password Link */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
            <Link
              to="/forgot-password"
              style={{
                fontSize: '13px',
                color: th.gold,
                textDecoration: 'none',
              }}
              onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              Forgot password?
            </Link>
          </div>

          {/* Error Message */}
          {(error || authError) && (
            <div
              style={{
                padding: '12px',
                backgroundColor: isDark ? 'rgba(139,58,58,0.3)' : 'rgba(248,215,218,0.8)',
                color: isDark ? '#ff9999' : '#721c24',
                borderRadius: '6px',
                marginBottom: '20px',
                fontSize: '13px',
              }}
            >
              {error || authError}
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? th.textMuted : th.gold,
              color: isDark ? '#0a0a0a' : '#1a1a0a',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s',
              marginBottom: '20px',
            }}
            onMouseOver={(e) =>
              !loading && (e.currentTarget.style.opacity = '0.9')
            }
            onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Dev Quick Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={setDevAccount}
            style={{
              padding: '10px',
              backgroundColor: th.btnBg,
              border: `1px solid ${th.border}`,
              borderRadius: '6px',
              color: th.text,
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = th.btnBgHover)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = th.btnBg)}
          >
            Admin
          </button>
          <button
            onClick={setMarcoAccount}
            style={{
              padding: '10px',
              backgroundColor: th.btnBg,
              border: `1px solid ${th.border}`,
              borderRadius: '6px',
              color: th.text,
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = th.btnBgHover)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = th.btnBg)}
          >
            Marco
          </button>
        </div>

        {/* Default Password Note */}
        <p style={{ fontSize: '11px', color: th.textMuted, textAlign: 'center', marginBottom: '0' }}>
          🔑 Dev: <code style={{ color: th.gold }}>admin</code> / <code style={{ color: th.gold }}>emmenegger2026</code>
        </p>
      </div>
    </div>
  );
}
