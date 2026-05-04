import type { AbsenceType, MachineCategory } from '../types';

// ─── ABSENCE TYPES (matching Excel codes 1-6) ───
export const ABSENCE_TYPES: AbsenceType[] = [
  { code: 1, key: 'absence.vacation', color: '#C8A96E', icon: '☀' },
  { code: 2, key: 'absence.school',   color: '#6B7B8D', icon: '📖' },
  { code: 3, key: 'absence.course',   color: '#8B7355', icon: '🎓' },
  { code: 4, key: 'absence.accident', color: '#8B4513', icon: '⚕' },
  { code: 5, key: 'absence.sick',     color: '#6B3A3A', icon: '●' },
  { code: 6, key: 'absence.parttime', color: '#4A4A4A', icon: '◑' },
];

// ─── SEASONAL TASK CODES (from Dauerauftraege Excel) ───
export const SEASONAL_TASK_CODES = {
  w:  'winterschnitt',
  f:  'fruehlingsarbeiten',
  r:  'rosenpflege',
  u:  'unkraut',
  p:  'pflanzenschutz',
  wm: 'wiese_maehen',
  h:  'hecke_schneiden',
  ss: 'sommerschnitt',
  he: 'herbstarbeiten',
  ws: 'winterschutz',
  b:  'bewaesserung',
  rp: 'rasenpflege',
  sp: 'spezialarbeiten',
  d:  'dauerunterhalt',
} as const;

// ─── MACHINE CATEGORIES (from Excel inventory) ───
export const MACHINE_CATEGORIES: Record<MachineCategory, { key: string; icon: string }> = {
  RAUPEN_BAGGER:  { key: 'machine.tracked_excavator', icon: '🏗' },
  PNEU_BAGGER:    { key: 'machine.wheeled_excavator', icon: '🏗' },
  RADLADER:       { key: 'machine.wheel_loader',      icon: '🔧' },
  RAUPEN_DUMPER:  { key: 'machine.tracked_dumper',     icon: '🚜' },
  RAD_DUMPER:     { key: 'machine.wheeled_dumper',     icon: '🚜' },
  WALZE:          { key: 'machine.compactor',          icon: '🔨' },
  SPITZHAMMER:    { key: 'machine.breaker',            icon: '⚒' },
  ANBAUGERAET:    { key: 'machine.attachment',         icon: '🔩' },
  LKW:            { key: 'machine.truck',              icon: '🚛' },
  OTHER:          { key: 'machine.other',              icon: '⚙' },
};

// ─── DAYS ───
export const DAYS_PER_WEEK = 6; // Mon-Sat
export const TIME_SLOTS_PER_DAY = 4; // AM1, AM2, PM1, PM2

// ─── TASK COLOR PALETTE ───
export const TASK_COLOR_PALETTE = [
  { bg: '#B8860B', text: '#0a0a0a' },
  { bg: '#8B7355', text: '#ffffff' },
  { bg: '#4A6741', text: '#ffffff' },
  { bg: '#5B6E82', text: '#ffffff' },
  { bg: '#2C3E50', text: '#C8A96E' },
  { bg: '#6B4C3B', text: '#ffffff' },
  { bg: '#C8A96E', text: '#1a1a1a' },
  { bg: '#7D4E57', text: '#ffffff' },
  { bg: '#8E6F3E', text: '#ffffff' },
  { bg: '#4A4063', text: '#C8A96E' },
  { bg: '#704241', text: '#ffffff' },
  { bg: '#3B4F64', text: '#C8A96E' },
  { bg: '#5C8054', text: '#ffffff' },
  { bg: '#A0926B', text: '#ffffff' },
  { bg: '#7089A1', text: '#ffffff' },
  { bg: '#8B6F5E', text: '#ffffff' },
  { bg: '#DFC78A', text: '#1a1a1a' },
  { bg: '#A0606B', text: '#ffffff' },
  { bg: '#B08D57', text: '#ffffff' },
  { bg: '#635880', text: '#C8A96E' },
  { bg: '#8B5654', text: '#ffffff' },
  { bg: '#4D6580', text: '#C8A96E' },
  { bg: '#6C9064', text: '#ffffff' },
  { bg: '#B0A27B', text: '#ffffff' },
  { bg: '#8099B1', text: '#ffffff' },
  { bg: '#9B7F6E', text: '#ffffff' },
];

// ─── REPORT STATUSES ───
export const REPORT_STATUS_CONFIG = {
  PLANNED:   { key: 'report.planned',   color: '#5B6E82', icon: '○' },
  COMPLETED: { key: 'report.completed', color: '#4A6741', icon: '✓' },
  PARTIAL:   { key: 'report.partial',   color: '#C8A96E', icon: '◐' },
  NOT_DONE:  { key: 'report.not_done',  color: '#6B3A3A', icon: '✗' },
  ADDED:     { key: 'report.added',     color: '#8B7355', icon: '+' },
} as const;
