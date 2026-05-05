import React from 'react';
import { useTheme } from '../contexts/themeContext';

interface ToastProps {
  msg: string;
  type: 'success' | 'err';
}

export default function Toast({ msg, type }: ToastProps) {
  const { isDark } = useTheme();

  const bgColor = type === 'success' 
    ? isDark ? '#1b5e20' : '#c8e6c9'
    : isDark ? '#b71c1c' : '#ffcdd2';
  
  const textColor = type === 'success'
    ? isDark ? '#a5d6a7' : '#2e7d32'
    : isDark ? '#ef9a9a' : '#c62828';

  const toastStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    padding: '16px 24px',
    background: bgColor,
    color: textColor,
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 'bold',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: 9999,
    animation: 'slideIn 0.3s ease-out',
  };

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      <div style={toastStyle}>
        {type === 'success' ? '✅' : '❌'} {msg}
      </div>
    </>
  );
}
