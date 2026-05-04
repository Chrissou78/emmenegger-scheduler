export type ThemeMode = 'dark' | 'light';

export interface Theme {
  mode: ThemeMode;
  bg: string;
  bgCard: string;
  bgHeader: string;
  bgSidebar: string;
  gold: string;
  goldDim: string;
  goldFaint: string;
  goldGhost: string;
  silver: string;
  silverDim: string;
  text: string;
  textMuted: string;
  textDim: string;
  textGhost: string;
  border: string;
  borderFaint: string;
  rowHover: string;
  cellHover: string;
  empName: string;
  empNameSel: string;
  modalBg: string;
  modalCard: string;
  btnBg: string;
  btnBgHover: string;
  scrollThumb: string;
  inputBg: string;
  inputBorder: string;
  danger: string;
  dangerBg: string;
  success: string;
  successBg: string;
  shadow: string;
  shadowLg: string;
}

export const darkTheme: Theme = {
  mode: 'dark',
  bg: '#0a0a0a',
  bgCard: '#0e0e0e',
  bgHeader: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)',
  bgSidebar: '#0c0c0c',
  gold: '#C8A96E',
  goldDim: 'rgba(200,169,110,0.35)',
  goldFaint: 'rgba(200,169,110,0.08)',
  goldGhost: 'rgba(200,169,110,0.03)',
  silver: '#A8A8A8',
  silverDim: 'rgba(168,168,168,0.3)',
  text: '#d4d0c8',
  textMuted: '#888',
  textDim: '#444',
  textGhost: '#2a2a2a',
  border: 'rgba(200,169,110,0.08)',
  borderFaint: 'rgba(255,255,255,0.02)',
  rowHover: 'rgba(200,169,110,0.012)',
  cellHover: 'rgba(200,169,110,0.04)',
  empName: '#bbb',
  empNameSel: '#C8A96E',
  modalBg: 'rgba(0,0,0,0.75)',
  modalCard: '#111',
  btnBg: 'rgba(255,255,255,0.025)',
  btnBgHover: 'rgba(200,169,110,0.05)',
  scrollThumb: 'rgba(200,169,110,0.12)',
  inputBg: 'rgba(255,255,255,0.04)',
  inputBorder: 'rgba(200,169,110,0.12)',
  danger: '#C44',
  dangerBg: 'rgba(204,68,68,0.1)',
  success: '#4A6741',
  successBg: 'rgba(74,103,65,0.1)',
  shadow: '0 2px 20px rgba(0,0,0,0.3)',
  shadowLg: '0 20px 60px rgba(0,0,0,0.6)',
};

export const lightTheme: Theme = {
  mode: 'light',
  bg: '#F5F2EB',
  bgCard: '#FFFFFF',
  bgHeader: 'linear-gradient(180deg, #FDFBF7 0%, #F5F2EB 100%)',
  bgSidebar: '#FAF8F4',
  gold: '#96783C',
  goldDim: 'rgba(150,120,60,0.5)',
  goldFaint: 'rgba(150,120,60,0.1)',
  goldGhost: 'rgba(150,120,60,0.03)',
  silver: '#6B6B6B',
  silverDim: 'rgba(107,107,107,0.3)',
  text: '#2C2418',
  textMuted: '#6B5D4A',
  textDim: '#A89B88',
  textGhost: '#D5CFBE',
  border: 'rgba(150,120,60,0.12)',
  borderFaint: 'rgba(0,0,0,0.04)',
  rowHover: 'rgba(150,120,60,0.03)',
  cellHover: 'rgba(150,120,60,0.06)',
  empName: '#3D3225',
  empNameSel: '#96783C',
  modalBg: 'rgba(245,242,235,0.85)',
  modalCard: '#FFFFFF',
  btnBg: 'rgba(0,0,0,0.03)',
  btnBgHover: 'rgba(150,120,60,0.08)',
  scrollThumb: 'rgba(150,120,60,0.2)',
  inputBg: 'rgba(0,0,0,0.02)',
  inputBorder: 'rgba(150,120,60,0.15)',
  danger: '#8B3A3A',
  dangerBg: 'rgba(139,58,58,0.08)',
  success: '#4A6741',
  successBg: 'rgba(74,103,65,0.08)',
  shadow: '0 2px 12px rgba(0,0,0,0.04)',
  shadowLg: '0 20px 60px rgba(0,0,0,0.1)',
};

export function getTheme(mode: ThemeMode): Theme {
  return mode === 'dark' ? darkTheme : lightTheme;
}
