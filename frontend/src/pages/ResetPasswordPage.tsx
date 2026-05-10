import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTheme } from '../contexts/themeContext';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { getTranslations, type LangCode } from '../i18n';

export default function ResetPasswordPage() {
  const { th, isDark, lang, setLanguage, toggleTheme, enabledLangs } = useTheme();
  const lt = getTranslations(lang as LangCode);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setError(lt.noResetToken);
      setValidating(false);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/v1/password-reset/verify/${token}`
      );
      const data = await response.json();

      if (data.valid) {
        setTokenValid(true);
      } else {
        setError(lt.linkExpired);
      }
    } catch (err) {
      setError(lt.failedValidateLink);
      console.error(err);
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(lt.passwordsNoMatch);
      return;
    }

    if (password.length < 8) {
      setError(lt.passwordMinLength);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/v1/password-reset/reset`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword: password }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(data.message || lt.networkError);
      }
    } catch (err) {
      setError(lt.networkError);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* ── Language + theme bar (reused across states) ── */
  const topBar = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {enabledLangs.map(l => (
          <button key={l}
            onClick={() => setLanguage(l)}
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
  );

  if (validating) {
    return (
      <div style={{
        minHeight: '100vh', background: th.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: '18px', color: th.text }}>{lt.loading}</div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div style={{
        minHeight: '100vh', backgroundColor: th.bg, color: th.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{
          width: '100%', maxWidth: '400px', padding: '40px 30px',
          backgroundColor: th.bgCard, borderRadius: '10px', textAlign: 'center',
          boxShadow: isDark ? '0 10px 40px rgba(0,0,0,0.3)' : '0 10px 40px rgba(0,0,0,0.1)',
        }}>
          {topBar}
          <AlertCircle size={48} style={{ color: '#ff6b6b', margin: '0 auto 20px' }} />
          <h1 style={{ marginBottom: '20px', fontSize: '24px' }}>{lt.invalidLink}</h1>
          <p style={{ marginBottom: '30px', opacity: 0.7 }}>{error}</p>
          <Link to="/forgot-password"
            style={{
              display: 'inline-block', padding: '10px 20px',
              backgroundColor: th.gold, color: '#fff',
              textDecoration: 'none', borderRadius: '6px', fontWeight: '600',
            }}
          >
            {lt.requestNewLink}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: th.bg, color: th.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: '400px', padding: '40px 30px',
        backgroundColor: th.bgCard, borderRadius: '10px',
        boxShadow: isDark ? '0 10px 40px rgba(0,0,0,0.3)' : '0 10px 40px rgba(0,0,0,0.1)',
      }}>
        {topBar}

        <h1 style={{ marginBottom: '10px', fontSize: '24px', fontWeight: '600' }}>
          {lt.setNewPassword}
        </h1>
        <p style={{ marginBottom: '30px', fontSize: '14px', opacity: 0.7 }}>
          {lt.newPasswordDesc}
        </p>

        {success ? (
          <div style={{
            padding: '20px',
            backgroundColor: isDark ? '#1a4d2e' : '#d4edda',
            color: isDark ? '#90ee90' : '#155724',
            borderRadius: '8px', textAlign: 'center',
          }}>
            <CheckCircle size={32} style={{ margin: '0 auto 10px' }} />
            <p style={{ fontWeight: '500', marginBottom: '10px' }}>{lt.passwordResetSuccess}</p>
            <p style={{ fontSize: '13px' }}>{lt.redirectingToLogin}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* New Password */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                {lt.newPassword}
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', opacity: 0.5 }} />
                <input
                  type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={lt.atLeastChars} required
                  style={{
                    width: '100%', padding: '12px 40px 12px 40px',
                    border: `1px solid ${th.border}`, borderRadius: '6px',
                    backgroundColor: isDark ? '#2a2a2a' : '#f8f8f8',
                    color: th.text, fontSize: '14px', outline: 'none',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = th.gold)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = th.border)}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: th.textMuted, display: 'flex' }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                {lt.confirmPassword}
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', opacity: 0.5 }} />
                <input
                  type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={lt.confirmYourPassword} required
                  style={{
                    width: '100%', padding: '12px 40px 12px 40px',
                    border: `1px solid ${th.border}`, borderRadius: '6px',
                    backgroundColor: isDark ? '#2a2a2a' : '#f8f8f8',
                    color: th.text, fontSize: '14px', outline: 'none',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = th.gold)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = th.border)}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: th.textMuted, display: 'flex' }}>
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                padding: '12px',
                backgroundColor: isDark ? '#4d1a1a' : '#f8d7da',
                color: isDark ? '#ff6b6b' : '#721c24',
                borderRadius: '6px', marginBottom: '20px', fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{
                width: '100%', padding: '12px',
                backgroundColor: loading ? '#999' : th.gold,
                color: '#fff', border: 'none', borderRadius: '6px',
                fontSize: '14px', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              {loading ? lt.resetting : lt.resetPassword}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
