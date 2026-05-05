import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../contexts/themeContext';
import { Mail, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { t, th, isDark } = useTheme();
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
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
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
        setError(data.message || 'Failed to send reset email');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
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
          boxShadow: isDark
            ? '0 10px 40px rgba(0,0,0,0.3)'
            : '0 10px 40px rgba(0,0,0,0.1)',
        }}
      >
        <Link 
          to="/login" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            color: th.primary, 
            textDecoration: 'none', 
            marginBottom: '30px', 
            fontSize: '14px' 
          }}
        >
          <ArrowLeft size={16} />
          Back to login
        </Link>

        <h1 style={{ marginBottom: '10px', fontSize: '24px', fontWeight: '600', color: th.text }}>
          Reset Password
        </h1>
        <p style={{ marginBottom: '30px', fontSize: '14px', color: th.textDim }}>
          Enter your email address and we'll send you a link to reset your password.
        </p>

        {submitted ? (
          <div
            style={{
              padding: '20px',
              backgroundColor: isDark ? '#1a4d2e' : '#d4edda',
              color: isDark ? '#90ee90' : '#155724',
              borderRadius: '8px',
              textAlign: 'center',
            }}
          >
            <p style={{ marginBottom: '10px', fontWeight: '500' }}>✅ Email sent!</p>
            <p style={{ fontSize: '13px' }}>
              Check your inbox for the password reset link. Redirecting to login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: th.text,
                }}
              >
                Email Address
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Mail
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    color: th.textDim,
                  }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@emmenegger.ch"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 40px',
                    border: `1px solid ${th.border}`,
                    borderRadius: '6px',
                    backgroundColor: isDark ? '#2a2a2a' : '#f8f8f8',
                    color: th.text,
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = th.primary)
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = th.border)
                  }
                />
              </div>
            </div>

            {error && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: th.toastErrBg,
                  color: th.toastErrText,
                  borderRadius: '6px',
                  marginBottom: '20px',
                  fontSize: '13px',
                }}
              >
                {error}
              </div>
            )}

            {message && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: isDark ? '#1a4d2e' : '#d4edda',
                  color: isDark ? '#90ee90' : '#155724',
                  borderRadius: '6px',
                  marginBottom: '20px',
                  fontSize: '13px',
                }}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: loading ? th.textDim : th.primary,
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                opacity: loading ? 0.6 : 1,
              }}
              onMouseOver={(e) => !loading && (e.currentTarget.style.opacity = '0.9')}
              onMouseOut={(e) => (e.currentTarget.style.opacity = loading ? '0.6' : '1')}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
