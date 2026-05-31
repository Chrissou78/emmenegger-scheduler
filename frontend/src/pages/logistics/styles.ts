// frontend/src/pages/logistics/styles.ts
import type { CSSProperties } from 'react';

export function getLogStyles(isDark: boolean) {
  const bg = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const text = isDark ? '#e2e8f0' : '#1e293b';
  const muted = isDark ? '#94a3b8' : '#64748b';
  const border = isDark ? '#334155' : '#e2e8f0';
  const accent = '#3b82f6';

  const card: CSSProperties = {
    background: cardBg, borderRadius: 12, padding: 20,
    border: `1px solid ${border}`,
  };

  const kpiCard: CSSProperties = {
    ...card, textAlign: 'center', padding: 16,
  };

  const input: CSSProperties = {
    padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${border}`, background: isDark ? '#0f172a' : '#fff',
    color: text, fontSize: 14, outline: 'none',
  };

  const btnPrimary: CSSProperties = {
    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: accent, color: '#fff', fontWeight: 600, fontSize: 14,
  };

  const btnSecondary: CSSProperties = {
    ...btnPrimary, background: isDark ? '#334155' : '#e2e8f0', color: text,
  };

  const btnDanger: CSSProperties = {
    ...btnPrimary, background: '#ef4444',
  };

  const thStyle: CSSProperties = {
    padding: '10px 12px', textAlign: 'left', fontSize: 12,
    fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
    borderBottom: `2px solid ${border}`, color: muted,
  };

  const tdStyle: CSSProperties = {
    padding: '10px 12px', borderBottom: `1px solid ${border}`, fontSize: 14,
  };

  const tabBtn = (active: boolean): CSSProperties => ({
    padding: '10px 18px', border: 'none', borderRadius: 8, cursor: 'pointer',
    fontWeight: active ? 700 : 500, fontSize: 14,
    background: active ? accent : 'transparent',
    color: active ? '#fff' : text,
    transition: 'all .2s',
    display: 'flex', alignItems: 'center', gap: 6,
  });

  const badge = (color: string): CSSProperties => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 9999,
    fontSize: 11, fontWeight: 700, background: `${color}22`, color,
  });

  return { bg, cardBg, text, muted, border, accent, card, kpiCard, input, btnPrimary, btnSecondary, btnDanger, thStyle, tdStyle, tabBtn, badge };
}