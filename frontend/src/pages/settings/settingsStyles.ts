// frontend/src/pages/settings/settingsStyles.ts
import type React from 'react';

export function makeStyles(th: any, isDark: boolean, gold: string) {
  const dimText = isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.4)';
  const inputBg = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.04)';

  const sInput: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${th.border}`, background: inputBg,
    color: th.text, fontSize: 14, boxSizing: 'border-box',
  };
  const sSelect: React.CSSProperties = { ...sInput };
  const sLabel: React.CSSProperties = {
    display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 12, color: dimText,
  };
  const sBtn = (bg: string): React.CSSProperties => ({
    padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontWeight: 600, color: '#fff', background: bg, fontSize: 14,
  });
  const sBtnOutline: React.CSSProperties = {
    padding: '8px 20px', borderRadius: 8, border: `1px solid ${th.border}`,
    background: 'transparent', color: th.text, fontWeight: 600, cursor: 'pointer', fontSize: 14,
  };
  const sCard: React.CSSProperties = {
    background: isDark ? '#1e1e3a' : '#fff', borderRadius: 14,
    border: `1px solid ${th.border}`, padding: 24, marginBottom: 20,
  };
  const sOverlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const sModal: React.CSSProperties = {
    background: isDark ? '#1e1e3a' : '#fff', color: th.text, borderRadius: 12,
    padding: 24, width: '90%', maxWidth: 700, maxHeight: '90vh',
    overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    border: `1px solid ${th.border}`,
  };
  const sTh: React.CSSProperties = {
    textAlign: 'left', padding: '10px 12px', fontSize: 12, color: dimText,
    borderBottom: `2px solid ${th.border}`, fontWeight: 700,
  };
  const sTd: React.CSSProperties = {
    padding: '8px 12px', fontSize: 14, borderBottom: `1px solid ${th.border}`,
  };

  return { dimText, inputBg, sInput, sSelect, sLabel, sBtn, sBtnOutline, sCard, sOverlay, sModal, sTh, sTd };
}

export type Styles = ReturnType<typeof makeStyles>;
