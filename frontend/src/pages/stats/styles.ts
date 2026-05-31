// frontend/src/pages/stats/styles.ts

import React from 'react';

export function getStatsStyles(isDark: boolean, th: Record<string, string>) {
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: isDark
      ? 'linear-gradient(135deg,rgba(20,30,28,0.95),rgba(15,22,20,0.98))'
      : 'linear-gradient(135deg,rgba(255,255,255,0.98),rgba(245,250,248,0.95))',
    border: `1px solid ${isDark ? 'rgba(0,229,160,0.12)' : 'rgba(0,229,160,0.18)'}`,
    borderRadius: 16,
    padding: 24,
    boxShadow: isDark
      ? '0 4px 24px rgba(0,0,0,.3), 0 0 0 1px rgba(0,229,160,0.05)'
      : '0 4px 24px rgba(0,0,0,.06), 0 0 0 1px rgba(0,229,160,0.08)',
    backdropFilter: 'blur(12px)',
    ...extra,
  });

  const kpiCard = (): React.CSSProperties => ({
    background: isDark
      ? 'linear-gradient(135deg,rgba(20,30,28,0.95),rgba(12,18,16,0.98))'
      : 'linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,248,245,0.95))',
    border: `1px solid ${isDark ? 'rgba(0,229,160,0.1)' : 'rgba(0,229,160,0.15)'}`,
    borderRadius: 16,
    padding: '20px 24px',
    display: 'flex', alignItems: 'center', gap: 16, cursor: 'default',
    transition: 'transform .25s cubic-bezier(.4,0,.2,1),box-shadow .25s',
    boxShadow: isDark
      ? '0 2px 16px rgba(0,0,0,.25)'
      : '0 2px 16px rgba(0,0,0,.04)',
  });

  const periodBtn = (active: boolean): React.CSSProperties => ({
    padding: '7px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, letterSpacing: .3,
    background: active
      ? 'linear-gradient(135deg,#00e5a0,#00bcd4)'
      : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    color: active ? '#0a1612' : isDark ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.45)',
    transition: 'all .25s cubic-bezier(.4,0,.2,1)',
    boxShadow: active ? '0 2px 12px rgba(0,229,160,0.3)' : 'none',
  });

  const sectionTitle: React.CSSProperties = {
    fontSize: 14, fontWeight: 700, color: th.text, marginBottom: 16,
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
  };

  const subtab = (active: boolean): React.CSSProperties => ({
    fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 8,
    border: 'none', cursor: 'pointer', transition: 'all .2s',
    background: active
      ? 'linear-gradient(135deg,#00e5a0,#00bcd4)'
      : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    color: active ? '#0a1612' : isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.4)',
    boxShadow: active ? '0 2px 8px rgba(0,229,160,0.25)' : 'none',
  });

  const sectionBtn = (active: boolean): React.CSSProperties => ({
    padding: '10px 22px', borderRadius: 10, border: 'none',
    background: active
      ? 'linear-gradient(135deg,#00e5a0,#00bcd4)'
      : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    color: active ? '#0a1612' : isDark ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.45)',
    fontWeight: 700, cursor: 'pointer', fontSize: 15,
    transition: 'all .15s',
  });

  const kpiHoverIn = (e: React.MouseEvent<HTMLDivElement>, glowColor: string) => {
    e.currentTarget.style.transform = 'translateY(-3px)';
    e.currentTarget.style.boxShadow = `0 8px 32px ${glowColor}`;
  };

  const kpiHoverOut = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = '';
    e.currentTarget.style.boxShadow = isDark ? '0 2px 16px rgba(0,0,0,.25)' : '0 2px 16px rgba(0,0,0,.04)';
  };

  return { card, kpiCard, periodBtn, sectionTitle, subtab, sectionBtn, kpiHoverIn, kpiHoverOut };
}
