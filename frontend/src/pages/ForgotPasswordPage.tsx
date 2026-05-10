import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../contexts/themeContext';
import { Mail, ArrowLeft } from 'lucide-react';
import { getTranslations, type LangCode } from '../i18n';

export default function ForgotPasswordPage() {
  const { th, isDark, lang, setLanguage, toggleTheme, enabledLangs } = useTheme();
  const lt = getTranslations(lang as LangCode);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(
        `${apiUrl}/api/v1/password-reset/forgot`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessage(data.message);
        setSubmitted(true);
        setTimeout(() => navigate('/login'), 3000);
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
        {/* Top controls: language + theme */}
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

        <Link
          to="/login"
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            color: th.gold, textDecoration: 'none', marginBottom: '30px', fontSize: '14px',
          }}
        >
          <ArrowLeft size={16} />
          {lt.backToLogin}
        </Link>

        <h1 style={{ marginBottom: '10px', fontSize: '24px', fontWeight: '600', color: th.text }}>
          {lt.resetPassword}
        </h1>
        <p style={{ marginBottom: '30px', fontSize: '14px', color: th.textDim }}>
          {lt.resetPasswordDesc}
        </p>

        {submitted ? (
          <div style={{
            padding: '20px',
            backgroundColor: isDark ? '#1a4d2e' : '#d4edda',
            color: isDark ? '#90ee90' : '#155724',
            borderRadius: '8px', textAlign: 'center',
          }}>
            <p style={{ marginBottom: '10px', fontWeight: '500' }}>✅ {lt.emailSent}</p>
            <p style={{ fontSize: '13px' }}>{lt.emailSentDesc}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block', marginBottom: '8px', fontSize: '14px',
                fontWeight: '500', color: th.text,
              }}>
                {lt.email}
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Mail size={18} style={{ position: 'absolute', left: '12px', color: th.textDim }} />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@emmenegger.ch" required
                  style={{
                    width: '100%', padding: '12px 12px 12px 40px',
                    border: `1px solid ${th.border}`, borderRadius: '6px',
                    backgroundColor: isDark ? '#2a2a2a' : '#f8f8f8',
                    color: th.text, fontSize: '14px', outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = th.gold)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = th.border)}
                />
              </div>
            </div>

            {error && (
              <div style={{
                padding: '12px', backgroundColor: th.toastErrBg,
                color: th.toastErrText, borderRadius: '6px',
                marginBottom: '20px', fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            {message && (
              <div style={{
                padding: '12px',
                backgroundColor: isDark ? '#1a4d2e' : '#d4edda',
                color: isDark ? '#90ee90' : '#155724',
                borderRadius: '6px', marginBottom: '20px', fontSize: '13px',
              }}>
                {message}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{
                width: '100%', padding: '12px',
                backgroundColor: loading ? th.textDim : th.gold,
                color: '#fff', border: 'none', borderRadius: '6px',
                fontSize: '14px', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                opacity: loading ? 0.6 : 1,
              }}
              onMouseOver={(e) => !loading && (e.currentTarget.style.opacity = '0.9')}
              onMouseOut={(e) => (e.currentTarget.style.opacity = loading ? '0.6' : '1')}
            >
              {loading ? lt.sending : lt.sendResetLink}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
