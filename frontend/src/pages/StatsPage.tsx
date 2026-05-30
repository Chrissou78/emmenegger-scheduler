import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTheme } from '../contexts/themeContext';
import { useAuthStore } from '../contexts/authStore';
import { useRolesStore } from '../store/rolesStore';
import {
  resolvePermissions,
  getViewTier,
  getStatsViewMode,
  isOperational,
  type Role,
  type Permission,
} from '../../../shared/constants/roles';
import { getTranslations, type LangCode } from '../i18n';

const API = import.meta.env.VITE_API_URL || '';

function normalizeRole(raw: string): Role {
  const upper = (raw || '').toUpperCase();
  switch (upper) {
    case 'GLOBAL_MANAGER': return 'ADMIN';
    case 'LOCAL_MANAGER':  return 'MANAGER';
    case 'ARBEITER':       return 'EMPLOYEE';
    default:               return (upper as Role) || 'EMPLOYEE';
  }
}

/* ────────────────────── types ────────────────────── */
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  departments: string[];
  is_active: boolean;
  manager_id?: string;
  team_leader_id?: string | null;
  executive_id?: string | null;
}

interface Week {
  id: string;
  week_number: number;
  year: number;
}

interface Job {
  id: string;
  user_id: string;
  task_id: string;
  week_id: string;
  day_of_week: number;
  time_slot: number;
  customer_id?: string | null;
  notes?: string | null;
  task?: {
    id: string;
    code: string;
    name: string;
    color?: string;
    schedule_type?: string;
    status?: string;
    customer_id?: string;
    customer?: {
      id: string;
      name: string;
      company_name?: string;
      address?: string;
      city?: string;
      contact_name?: string;
      contact_phone?: string;
    };
  };
  machines?: {
    id: string;
    machine_id: string;
    machine?: {
      id: string;
      name: string;
      category?: string;
      inventory_nr?: string;
      tonnage?: number;
      is_active?: boolean;
    };
  }[];
}

interface TimeReport {
  id: string;
  user_id: string;
  task_id: string;
  date: string;
  planned_hours?: number;
  actual_hours?: number;
  status: string;
  work_description?: string;
  notes?: string;
  photos?: string[];
  submitted_at?: string;
}

interface Absence {
  id: string;
  user_id: string;
  week_id?: string;
  day_of_week?: number;
  date?: string;
  type: number | string;
  absence_code?: number | string;
  status?: string;
}

interface Task {
  id: string;
  name: string;
  short_code?: string;
  code?: string;
  status: string;
  color?: string;
  bg_color?: string;
}

interface Machine {
  id: string;
  name: string;
  category: string;
  status: string;
  notes?: string;
  is_active?: boolean;
}

interface MachineAllocation {
  id: string;
  machine_id: string;
  user_id?: string;
  site_id?: string;
  week_id?: string;
  day_of_week?: number;
  date?: string;
  start_time?: string;
  end_time?: string;
}

type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';
type StatsMode = 'global' | 'perimeter' | 'team' | 'individual';

const ABS_LABELS: Record<string, Record<string, string>> = {
  de: { '1': 'Krankheit', '2': 'Urlaub', '3': 'Fortbildung', '4': 'Dienstreise', '5': 'Homeoffice', '6': 'Sonstiges' },
  en: { '1': 'Illness', '2': 'Vacation', '3': 'Training', '4': 'Business Trip', '5': 'Home Office', '6': 'Other' },
  fr: { '1': 'Maladie', '2': 'Vacances', '3': 'Formation', '4': 'Déplacement', '5': 'Télétravail', '6': 'Autre' },
  pt: { '1': 'Doença', '2': 'Férias', '3': 'Formação', '4': 'Viagem', '5': 'Home Office', '6': 'Outro' },
};

/* ★ Updated absence colors to match neon palette */
const ABS_COLORS: Record<string, string> = {
  '1': '#ff6b9d', '2': '#00e5a0', '3': '#ffa726', '4': '#00bcd4', '5': '#b388ff', '6': '#78909c',
};

/* ────────────────────── helpers ────────────────────── */
function getISOWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

function getCurrentWeekNumber(): number {
  return getISOWeek(new Date());
}

/** Get the Monday of a given ISO week number in a given year */
function getMondayOfISOWeek(weekNum: number, year: number): Date {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNum - 1) * 7);
  return monday;
}

function getWeeksForPeriod(period: Period, allWeeks: Week[]): Week[] {
  const now = new Date();
  const cy = now.getFullYear();
  const cw = getCurrentWeekNumber();
  switch (period) {
    case 'day':
      return allWeeks.filter(w => w.year === cy && w.week_number === cw);
    case 'week':
      return allWeeks.filter(w => w.year === cy && w.week_number === cw);
    case 'month': {
      const s = Math.max(1, cw - 3);
      return allWeeks.filter(w => w.year === cy && w.week_number >= s && w.week_number <= cw);
    }
    case 'quarter': {
      const s = Math.max(1, cw - 12);
      return allWeeks.filter(w => w.year === cy && w.week_number >= s && w.week_number <= cw);
    }
    case 'year':
      return allWeeks.filter(w => w.year === cy && w.week_number <= cw);
  }
}

/** Calculate date range for a period (used by time_reports + absences APIs) */
function getPeriodDateRange(period: Period): { startDate: string; endDate: string } {
  const now = new Date();
  const cy = now.getFullYear();
  const cw = getCurrentWeekNumber();
  const endDate = now.toISOString().slice(0, 10);

  switch (period) {
    case 'day':
      return { startDate: endDate, endDate };
    case 'week': {
      const mon = getMondayOfISOWeek(cw, cy);
      return { startDate: mon.toISOString().slice(0, 10), endDate };
    }
    case 'month': {
      const s = Math.max(1, cw - 3);
      const mon = getMondayOfISOWeek(s, cy);
      return { startDate: mon.toISOString().slice(0, 10), endDate };
    }
    case 'quarter': {
      const s = Math.max(1, cw - 12);
      const mon = getMondayOfISOWeek(s, cy);
      return { startDate: mon.toISOString().slice(0, 10), endDate };
    }
    case 'year': {
      return { startDate: `${cy}-01-01`, endDate };
    }
  }
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/* ══════════════════════════════════════════════════════
   SVG CHART COMPONENTS — ★ restyled with neon theme
   ══════════════════════════════════════════════════════ */

function GaugeDonut({ value, size = 130, strokeWidth = 16, color, trackColor, label, sublabel, innerLabel }: {
  value: number; size?: number; strokeWidth?: number;
  color: string; trackColor: string; label: string; sublabel?: string; innerLabel?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (clamp(value, 0, 100) / 100) * circ;
  const gid = useRef(`gauge-${Math.random().toString(36).slice(2, 8)}`).current;
  const filterId = useRef(`glow-${Math.random().toString(36).slice(2, 8)}`).current;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', filter: `drop-shadow(0 0 6px ${color}44)` }}>
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity={0.5} />
            <stop offset="50%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={color} stopOpacity={0.7} />
          </linearGradient>
          <filter id={filterId}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} opacity={0.25} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          filter={`url(#${filterId})`}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }} />
        <text x={size / 2} y={size / 2 - 6} textAnchor="middle" dominantBaseline="central"
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontSize: size * 0.2, fontWeight: 800, fill: color, fontFamily: "'Inter',sans-serif" }}>
          {value}%
        </text>
        {innerLabel && (
          <text x={size / 2} y={size / 2 + 12} textAnchor="middle" dominantBaseline="central"
            style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontSize: size * 0.08, fontWeight: 500, fill: color, opacity: .6, fontFamily: "'Inter',sans-serif" }}>
            {innerLabel}
          </text>
        )}
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
        {sublabel && <div style={{ fontSize: 11, opacity: 0.55 }}>{sublabel}</div>}
      </div>
    </div>
  );
}

function PieChart({ segments, size = 160, strokeWidth = 24, trackColor, centerLabel }: {
  segments: { value: number; color: string; label: string }[];
  size?: number; strokeWidth?: number; trackColor: string; centerLabel?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let accumulated = 0;
  const filterId = useRef(`pie-glow-${Math.random().toString(36).slice(2, 8)}`).current;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', filter: 'drop-shadow(0 0 8px rgba(0,229,160,0.15))' }}>
        <defs>
          <filter id={filterId}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} opacity={0.2} />
        {total > 0 && segments.map((seg, i) => {
          const pctVal = seg.value / total;
          const dashLen = pctVal * circ;
          const dashOffset = -(accumulated / total) * circ;
          accumulated += seg.value;
          const segGid = `pie-seg-${i}-${Math.random().toString(36).slice(2, 6)}`;
          return (
            <g key={i}>
              <defs>
                <linearGradient id={segGid} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={seg.color} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={seg.color} stopOpacity={1} />
                </linearGradient>
              </defs>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${segGid})`} strokeWidth={strokeWidth}
                strokeDasharray={`${dashLen} ${circ - dashLen}`}
                strokeDashoffset={dashOffset}
                filter={`url(#${filterId})`}
                style={{ transition: 'stroke-dasharray .8s ease, stroke-dashoffset .8s ease' }} />
            </g>
          );
        })}
        {centerLabel && (
          <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
            style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontSize: 15, fontWeight: 800, fill: 'currentColor', fontFamily: "'Inter',sans-serif" }}>
            {centerLabel}
          </text>
        )}
      </svg>
    </div>
  );
}

function BarChart({ data, color, maxVal, th, showPctLabel = true }: {
  data: { label: string; value: number; max: number; color?: string }[];
  color: string; maxVal: number; th: Record<string, string>; showPctLabel?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((d, i) => {
        const p = pct(d.value, d.max);
        const barColor = d.color || color;
        const barGid = `bar-${i}-${Math.random().toString(36).slice(2, 6)}`;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 110, fontSize: 12, fontWeight: 500, color: th.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.label}>
              {d.label}
            </div>
            <div style={{ flex: 1, height: 8, background: `${barColor}12`, borderRadius: 20, overflow: 'hidden', position: 'relative' }}>
              <svg width="100%" height="8" style={{ position: 'absolute', left: 0, top: 0 }}>
                <defs>
                  <linearGradient id={barGid} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={barColor} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={barColor} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <rect
                  x={0} y={0}
                  width={`${maxVal === 0 ? 0 : (d.value / maxVal) * 100}%`}
                  height={8} rx={20}
                  fill={`url(#${barGid})`}
                  style={{ transition: 'width .8s cubic-bezier(.4,0,.2,1)', filter: `drop-shadow(0 0 4px ${barColor}55)` }}
                />
              </svg>
            </div>
            {showPctLabel && <div style={{ width: 52, fontSize: 12, fontWeight: 700, color: barColor, textAlign: 'right' }}>{p}%</div>}
          </div>
        );
      })}
    </div>
  );
}

function VerticalBarChart({ groups, height = 180, th }: {
  groups: { label: string; bars: { value: number; color: string; label: string }[] }[];
  height?: number; th: Record<string, string>;
}) {
  const allVals = groups.flatMap(g => g.bars.map(b => b.value));
  const maxV = Math.max(...allVals, 1);
  const barW = 20;
  const groupGap = 20;
  const barGap = 4;
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <svg width={groups.length * (groups[0]?.bars.length || 1) * (barW + barGap) + groups.length * groupGap + 40} height={height + 40}>
        {[0, .25, .5, .75, 1].map((f, i) => {
          const y = height - (f * height);
          return <g key={i}>
            <line x1={30} y1={y} x2="100%" y2={y} stroke={th.borderFaint || th.border} strokeDasharray="3,6" opacity={0.3} />
            <text x={26} y={y + 4} textAnchor="end" style={{ fontSize: 9, fill: th.textDim || th.textMuted, opacity: .6 }}>{Math.round(f * maxV)}</text>
          </g>;
        })}
        {groups.map((g, gi) => {
          const groupX = 40 + gi * ((g.bars.length * (barW + barGap)) + groupGap);
          return <g key={gi}>
            {g.bars.map((b, bi) => {
              const barH = (b.value / maxV) * height;
              const x = groupX + bi * (barW + barGap);
              const gradId = `vbar-${gi}-${bi}-${Math.random().toString(36).slice(2, 6)}`;
              return <g key={bi}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor={b.color} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={b.color} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <rect x={x} y={height - barH} width={barW} height={barH} rx={10} fill={`url(#${gradId})`}
                  style={{ transition: 'height .6s ease, y .6s ease', filter: `drop-shadow(0 0 4px ${b.color}44)` }}>
                  <title>{b.label}: {b.value}</title>
                </rect>
                {barH > 25 && (
                  <text x={x + barW / 2} y={height - barH + 16} textAnchor="middle"
                    style={{ fontSize: 9, fontWeight: 700, fill: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>{b.value}</text>
                )}
              </g>;
            })}
            <text x={groupX + (g.bars.length * (barW + barGap)) / 2} y={height + 16} textAnchor="middle"
              style={{ fontSize: 10, fontWeight: 600, fill: th.textMuted }}>{g.label}</text>
          </g>;
        })}
      </svg>
    </div>
  );
}

function AreaSparkline({ data, color, width = 220, height = 55, labels }: {
  data: number[]; color: string; width?: number; height?: number; labels?: string[];
}) {
  const uid = useRef(`area-${Math.random().toString(36).slice(2, 8)}`).current;
  const glowId = useRef(`area-glow-${Math.random().toString(36).slice(2, 8)}`).current;
  if (data.length < 2) return null;
  const pad = 4; const max = Math.max(...data, 1); const min = Math.min(...data, 0); const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - 2 * pad);
    const y = height - pad - ((v - min) / range) * (height - 2 * pad);
    return { x, y };
  });
  const line = pts.map(p => `${p.x},${p.y}`).join(' ');
  const area = `${pts[0].x},${height - pad} ` + line + ` ${pts[pts.length - 1].x},${height - pad}`;
  return (
    <div>
      <svg width={width} height={height + 20} style={{ display: 'block', filter: `drop-shadow(0 0 6px ${color}33)` }}>
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.01} />
          </linearGradient>
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <polygon points={area} fill={`url(#${uid})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          filter={`url(#${glowId})`} />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4.5 : 2.5}
            fill={i === pts.length - 1 ? color : 'transparent'}
            stroke={color} strokeWidth={i === pts.length - 1 ? 0 : 1.5}
            style={{ filter: i === pts.length - 1 ? `drop-shadow(0 0 4px ${color})` : 'none' }} />
        ))}
        {labels && labels.map((lb, i) => (
          <text key={i} x={pts[i]?.x || 0} y={height + 14} textAnchor="middle" style={{ fontSize: 8, fill: color, opacity: .6 }}>{lb}</text>
        ))}
      </svg>
    </div>
  );
}

function HeatmapGrid({ data, rowLabels, colLabels, maxVal, baseColor, th }: {
  data: number[][]; rowLabels: string[]; colLabels: string[]; maxVal: number; baseColor: string; th: Record<string, string>;
}) {
  const cellSize = 34; const gap = 3;
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-grid', gridTemplateColumns: `80px repeat(${colLabels.length},${cellSize}px)`, gap, alignItems: 'center' }}>
        <div />
        {colLabels.map((c, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: th.textMuted }}>{c}</div>
        ))}
        {rowLabels.map((row, ri) => (
          <React.Fragment key={`r${ri}`}>
            <div style={{ fontSize: 11, fontWeight: 500, color: th.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row}>{row}</div>
            {(data[ri] || []).map((val, ci) => {
              const intensity = maxVal > 0 ? clamp(val / maxVal, 0, 1) : 0;
              return (
                <div key={`${ri}-${ci}`} style={{
                  width: cellSize, height: cellSize, borderRadius: 8,
                  background: val > 0 ? `${baseColor}${Math.round(intensity * 200 + 55).toString(16).padStart(2, '0')}` : `${th.borderFaint || th.border}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: intensity > 0.5 ? '#fff' : th.textDim || th.textMuted,
                  transition: 'background .4s ease,box-shadow .3s ease', cursor: 'default',
                  boxShadow: intensity > 0.6 ? `0 0 8px ${baseColor}44` : 'none',
                }} title={`${row} / ${colLabels[ci]}: ${val}`}>
                  {val > 0 ? val : ''}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function StackedBar({ segments, height = 32, th }: {
  segments: { value: number; color: string; label: string }[]; height?: number; th: Record<string, string>;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  return (
    <div>
      <div style={{ height, borderRadius: 20, overflow: 'hidden', display: 'flex', background: `${th.borderFaint || th.border}22`, boxShadow: 'inset 0 1px 3px rgba(0,0,0,.15)' }}>
        {total > 0 && segments.filter(s => s.value > 0).map((seg, i) => {
          return (
            <div key={i} style={{
              width: `${(seg.value / total) * 100}%`,
              background: `linear-gradient(135deg,${seg.color}cc,${seg.color})`,
              transition: 'width .6s ease', position: 'relative', overflow: 'hidden',
            }} title={`${seg.label}: ${seg.value}`}>
              {(seg.value / total) > 0.08 && (
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.4)' }}>
                  {pct(seg.value, total)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 10 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: seg.color, boxShadow: `0 0 6px ${seg.color}44` }} />
            <span style={{ fontSize: 11, color: th.textMuted }}>{seg.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: th.text }}>{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ★ RANKING PODIUM COMPONENT — for TOP3 / FLOP3
   ══════════════════════════════════════════════════════ */
function RankingList({ items, title, icon, color, isFlop, th }: {
  items: { label: string; value: number; max: number }[];
  title: string; icon: string; color: string; isFlop?: boolean; th: Record<string, string>;
}) {
  if (items.length === 0) return null;
  const medals = isFlop ? ['⚠', '⚠', '⚠'] : ['🥇', '🥈', '🥉'];
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: th.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{icon}</span> {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.slice(0, 3).map((item, i) => {
          const rate = pct(item.value, item.max);
          const barColor = isFlop ? '#ff6b9d' : color;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{medals[i] || ''}</span>
              <div style={{ width: 120, fontSize: 12, fontWeight: 600, color: th.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.label}>
                {item.label}
              </div>
              <div style={{ flex: 1, height: 6, background: `${barColor}15`, borderRadius: 20, overflow: 'hidden' }}>
                <div style={{
                  width: `${rate}%`, height: '100%', borderRadius: 20,
                  background: `linear-gradient(90deg, ${barColor}88, ${barColor})`,
                  transition: 'width .8s ease',
                  boxShadow: `0 0 6px ${barColor}44`,
                }} />
              </div>
              <div style={{ width: 48, fontSize: 12, fontWeight: 800, color: barColor, textAlign: 'right' }}>{rate}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════ */
export function StatsPage() {
  const { isDark, th, lang } = useTheme();
  const { token, user } = useAuthStore();
  const { permissionMap } = useRolesStore();
  const L = getTranslations(lang as LangCode);

  /* ── permissions & role tier ── */
  const normalizedRole = useMemo(() => normalizeRole(user?.role || ''), [user?.role]);
  const perms = useMemo(() => {
    return resolvePermissions(normalizedRole, user?.custom_permissions, permissionMap);
  }, [normalizedRole, user, permissionMap]);

  // ★ Stats mode based on role
  const statsMode: StatsMode = useMemo(
    () => getStatsViewMode(user?.role || 'EMPLOYEE') as StatsMode,
    [user?.role]
  );

  const canView = true; // stats accessible to everyone per your rules

  const authHeaders = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);

  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineAllocs, setMachineAllocs] = useState<MachineAllocation[]>([]);
  const [timeReports, setTimeReports] = useState<TimeReport[]>([]);

  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  /* ── Period date range (for reports + absences API) ── */
  const periodDates = useMemo(() => getPeriodDateRange(period), [period]);

  /* ── Fetch all data ── */
  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      /* Step 1: Fetch static data in parallel */
      const [uRes, wRes, abRes, tRes, mRes, maRes, trRes] = await Promise.allSettled([
        fetch(`${API}/api/v1/users?limit=500`, { headers: authHeaders }),
        fetch(`${API}/api/v1/weeks`, { headers: authHeaders }),
        fetch(`${API}/api/v1/absences?startDate=${periodDates.startDate}&endDate=${periodDates.endDate}`, { headers: authHeaders }),
        fetch(`${API}/api/v1/tasks`, { headers: authHeaders }),
        fetch(`${API}/api/v1/machines`, { headers: authHeaders }),
        fetch(`${API}/api/v1/machines/allocations`, { headers: authHeaders }),
        fetch(`${API}/api/v1/reports?startDate=${periodDates.startDate}&endDate=${periodDates.endDate}`, { headers: authHeaders }),
      ]);

      if (!mounted.current) return;

      const json = async (r: PromiseSettledResult<Response>): Promise<any[]> => {
        if (r.status !== 'fulfilled' || !r.value.ok) return [];
        try {
          const data = await r.value.json();
          if (Array.isArray(data)) return data;
          if (data && Array.isArray(data.data)) return data.data;
          return [];
        } catch { return []; }
      };

      const fetchedUsers = await json(uRes);
      const fetchedWeeks: Week[] = await json(wRes);
      const fetchedAbsences = await json(abRes);
      const fetchedTasks = await json(tRes);
      const fetchedMachines = await json(mRes);
      const fetchedMachineAllocs = await json(maRes);
      const fetchedReports = await json(trRes);

      setAllUsers(fetchedUsers);
      setWeeks(fetchedWeeks);
      setAbsences(fetchedAbsences);
      setTasks(fetchedTasks);
      setMachines(fetchedMachines);
      setMachineAllocs(fetchedMachineAllocs);
      setTimeReports(fetchedReports);

      /* Step 2: Fetch jobs per-week (jobs API requires weekId) */
      const periodWks = getWeeksForPeriod(period, fetchedWeeks);
      if (periodWks.length > 0) {
        const jobPromises = periodWks.map(w =>
          fetch(`${API}/api/v1/jobs?weekId=${w.id}`, { headers: authHeaders })
            .then(async res => {
              if (!res.ok) return [];
              const data = await res.json();
              if (Array.isArray(data)) return data;
              if (data && Array.isArray(data.data)) return data.data;
              return [];
            })
            .catch(() => [] as Job[])
        );

        const jobResults = await Promise.all(jobPromises);
        if (!mounted.current) return;
        const allJobs = jobResults.flat() as Job[];
        setJobs(allJobs);
      } else {
        setJobs([]);
      }
    } catch (e) {
      console.error('Stats fetch error', e);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [token, authHeaders, period, periodDates]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ★ Scope users based on statsMode
  const users = useMemo(() => {
    switch (statsMode) {
      case 'global':
        return allUsers;
      case 'perimeter':
      {
        const myId = user?.id;
        if (!myId) return allUsers;
        const myTLs = allUsers.filter(u => u.executive_id === myId);
        const tlIds = new Set(myTLs.map(u => u.id));
        const myEmps = allUsers.filter(u => u.team_leader_id && tlIds.has(u.team_leader_id));
        const scopeIds = new Set([myId, ...tlIds, ...myEmps.map(u => u.id)]);
        return allUsers.filter(u => scopeIds.has(u.id));
      }
      case 'team':
      {
        const myId = user?.id;
        if (!myId) return [];
        return allUsers.filter(u => u.team_leader_id === myId || u.id === myId);
      }
      case 'individual':
      {
        const myId = user?.id;
        if (!myId) return [];
        return allUsers.filter(u => u.id === myId);
      }
      default:
        return allUsers;
    }
  }, [allUsers, statsMode, user?.id]);

  const scopedUserIds = useMemo(() => new Set(users.map(u => u.id)), [users]);

  /* ── derived data ── */
  const periodWeeks = useMemo(() => getWeeksForPeriod(period, weeks), [period, weeks]);
  const periodWeekIds = useMemo(() => new Set(periodWeeks.map(w => w.id)), [periodWeeks]);
  const activeUsers = useMemo(() => users.filter(u => u.is_active !== false), [users]);

  /* ── Day of week for 'day' period filtering ── */
  const currentDayOfWeek = useMemo(() => {
    const d = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    return d === 0 ? 7 : d; // convert to 1=Mon, ..., 6=Sat, 7=Sun
  }, []);

  const periodJobs = useMemo(() => {
    let filtered = jobs.filter(j => periodWeekIds.has(j.week_id) && scopedUserIds.has(j.user_id));
    if (period === 'day') {
      filtered = filtered.filter(j => j.day_of_week === currentDayOfWeek);
    }
    return filtered;
  }, [jobs, periodWeekIds, scopedUserIds, period, currentDayOfWeek]);

  const periodAbsences = useMemo(() => {
    let filtered = absences.filter(a => {
      const userMatch = scopedUserIds.has(a.user_id);
      if (!userMatch) return false;
      // absences may have week_id or date — handle both
      if (a.week_id) return periodWeekIds.has(a.week_id);
      if (a.date) {
        return a.date >= periodDates.startDate && a.date <= periodDates.endDate;
      }
      return false;
    });
    if (period === 'day') {
      filtered = filtered.filter(a => {
        if (a.day_of_week !== undefined) return a.day_of_week === currentDayOfWeek;
        if (a.date) return a.date === periodDates.startDate;
        return true;
      });
    }
    return filtered;
  }, [absences, periodWeekIds, scopedUserIds, period, currentDayOfWeek, periodDates]);

  const periodReports = useMemo(() =>
    timeReports.filter(tr => scopedUserIds.has(tr.user_id)),
    [timeReports, scopedUserIds]
  );

  /* ══════════ 1. TEAM OCCUPATION ══════════ */
  const teamOccupation = useMemo(() => {
    const numWeeks = periodWeeks.length || 1;
    const daysPerWeek = period === 'day' ? 1 : 6;
    const slotsPerDay = 2;
    const totalSlots = activeUsers.length * numWeeks * daysPerWeek * slotsPerDay;
    const filledSlots = periodJobs.length;
    const rate = pct(filledSlots, totalSlots);

    const byEmployee = activeUsers.map(u => {
      const userSlots = periodJobs.filter(j => j.user_id === u.id).length;
      const maxSlots = numWeeks * daysPerWeek * slotsPerDay;
      return { label: `${u.first_name} ${u.last_name}`, value: userSlots, max: maxSlots, userId: u.id };
    }).sort((a, b) => (b.value / (b.max || 1)) - (a.value / (a.max || 1)));

    const depts = ['GARTEN_TIEFBAU', 'UNTERHALT'];
    const byDept = depts.map(dept => {
      const deptUsers = activeUsers.filter(u => (u.departments || []).flat().includes(dept));
      const deptJobs = periodJobs.filter(j => deptUsers.some(u => u.id === j.user_id)).length;
      const maxSlots = deptUsers.length * numWeeks * daysPerWeek * slotsPerDay;
      return { label: (L as any)[dept] || dept, value: deptJobs, max: maxSlots, dept, userCount: deptUsers.length };
    });

    const dayNames = [L.mon ?? 'Mo', L.tue ?? 'Tu', L.wed ?? 'We', L.thu ?? 'Th', L.fri ?? 'Fr', L.sat ?? 'Sa'];
    const byDay = [1, 2, 3, 4, 5, 6].map((d, i) => {
      const dayJobs = periodJobs.filter(j => j.day_of_week === d).length;
      const maxDay = activeUsers.length * numWeeks * slotsPerDay;
      return { label: dayNames[i], value: dayJobs, max: maxDay };
    });

    const trend = periodWeeks.map(w => {
      const wJobs = periodJobs.filter(j => j.week_id === w.id).length;
      const wMax = activeUsers.length * daysPerWeek * slotsPerDay;
      return pct(wJobs, wMax);
    });

    const heatmapData = activeUsers.map(u => [1, 2, 3, 4, 5, 6].map(d =>
      periodJobs.filter(j => j.user_id === u.id && j.day_of_week === d).length
    ));
    const heatmapRows = activeUsers.map(u => `${u.first_name} ${u.last_name.charAt(0)}.`);

    const byDayGrouped = dayNames.map((dn, i) => {
      const day = i + 1;
      const bars = depts.map(dept => {
        const deptUsers = activeUsers.filter(u => (u.departments || []).flat().includes(dept));
        return {
          value: periodJobs.filter(j => j.day_of_week === day && deptUsers.some(u => u.id === j.user_id)).length,
          color: dept === 'GARTEN_TIEFBAU' ? '#00e5a0' : '#00bcd4',
          label: (L as any)[dept] || dept,
        };
      });
      return { label: dn, bars };
    });

    return { rate, totalSlots, filledSlots, byEmployee, byDept, byDay, trend, heatmapData, heatmapRows, byDayGrouped };
  }, [periodJobs, periodWeeks, activeUsers, L, period]);

  /* ══════════ ★ TOP3 / FLOP3 (computed from teamOccupation) ══════════ */
  const top3 = useMemo(() =>
    teamOccupation.byEmployee.slice(0, 3),
    [teamOccupation.byEmployee]
  );

  const flop3 = useMemo(() =>
    [...teamOccupation.byEmployee].sort((a, b) => (a.value / (a.max || 1)) - (b.value / (b.max || 1))).slice(0, 3),
    [teamOccupation.byEmployee]
  );

  /* ══════════ ★ TEAM-VS-TEAM COMPARISON (executives / CEO) ══════════ */
  const teamComparison = useMemo(() => {
    if (statsMode !== 'global' && statsMode !== 'perimeter') return null;

    // Group by team leader
    const teamLeaders = allUsers.filter(u => {
      const tier = getViewTier(u.role);
      return tier === 'teamleader';
    });

    const numWeeks = periodWeeks.length || 1;
    const daysPerWeek = period === 'day' ? 1 : 6;
    const slotsPerDay = 2;

    const teams = teamLeaders.map(tl => {
      const teamMembers = allUsers.filter(u => u.team_leader_id === tl.id || u.id === tl.id);
      const activeTM = teamMembers.filter(u => u.is_active !== false);
      const teamJobs = jobs.filter(j =>
        periodWeekIds.has(j.week_id) && teamMembers.some(u => u.id === j.user_id)
      );
      const maxSlots = activeTM.length * numWeeks * daysPerWeek * slotsPerDay;
      const teamAbsences = absences.filter(a => {
        if (!teamMembers.some(u => u.id === a.user_id)) return false;
        if (a.week_id) return periodWeekIds.has(a.week_id);
        if (a.date) return a.date >= periodDates.startDate && a.date <= periodDates.endDate;
        return false;
      });
      const maxDays = activeTM.length * numWeeks * daysPerWeek;
      const teamReports = timeReports.filter(tr =>
        teamMembers.some(u => u.id === tr.user_id)
      );
      const completedReports = teamReports.filter(r => r.status === 'COMPLETED' || r.status === 'SUBMITTED').length;

      return {
        id: tl.id,
        label: `${tl.first_name} ${tl.last_name}`,
        memberCount: activeTM.length,
        occupationRate: pct(teamJobs.length, maxSlots),
        absenceRate: pct(teamAbsences.length, maxDays),
        jobCount: teamJobs.length,
        maxSlots,
        reportCompletion: pct(completedReports, teamReports.length),
        totalReports: teamReports.length,
        completedReports,
      };
    }).sort((a, b) => b.occupationRate - a.occupationRate);

    return teams;
  }, [allUsers, jobs, absences, timeReports, periodWeeks, periodWeekIds, periodDates, statsMode, period]);

  /* ══════════ 2. SUCCESS RATE ══════════ */
  const successRate = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => (t.status || '').toUpperCase() === 'COMPLETED').length;
    const cancelled = tasks.filter(t => (t.status || '').toUpperCase() === 'CANCELLED').length;
    const active = tasks.filter(t => (t.status || '').toUpperCase() === 'ACTIVE').length;
    const planned = tasks.filter(t => (t.status || '').toUpperCase() === 'PLANNED').length;
    const rate = pct(completed, total);
    const statusCounts: { status: string; count: number; color: string }[] = [
      { status: 'COMPLETED', count: completed, color: '#00e5a0' },
      { status: 'ACTIVE', count: active, color: '#00bcd4' },
      { status: 'PLANNED', count: planned, color: '#ffa726' },
      { status: 'CANCELLED', count: cancelled, color: '#ff6b9d' },
    ].filter(s => s.count > 0);
    return { rate, total, completed, cancelled, active, planned, statusCounts };
  }, [tasks]);

  /* ══════════ 3. ABSENCE RATE ══════════ */
  const absenceRate = useMemo(() => {
    const numWeeks = periodWeeks.length || 1;
    const daysPerWeek = period === 'day' ? 1 : 6;
    const totalDays = activeUsers.length * numWeeks * daysPerWeek;
    const absentDays = periodAbsences.length;
    const rate = pct(absentDays, totalDays);

    const byEmployee = activeUsers.map(u => {
      const uAbs = periodAbsences.filter(a => a.user_id === u.id).length;
      const maxDays = numWeeks * daysPerWeek;
      return { label: `${u.first_name} ${u.last_name}`, value: uAbs, max: maxDays };
    }).sort((a, b) => (b.value / (b.max || 1)) - (a.value / (a.max || 1)));

    const absTypes: Record<string, number> = {};
    periodAbsences.forEach(a => {
      const key = String(a.type || a.absence_code || '6');
      absTypes[key] = (absTypes[key] || 0) + 1;
    });

    const trend = periodWeeks.map(w => {
      const wAbs = periodAbsences.filter(a => a.week_id === w.id).length;
      const wMax = activeUsers.length * daysPerWeek;
      return pct(wAbs, wMax);
    });

    const typeSegments = Object.entries(absTypes).map(([type, count]) => ({
      value: count,
      color: ABS_COLORS[type] || '#999',
      label: (ABS_LABELS[lang || 'de'] || ABS_LABELS.de)[type] || `Type ${type}`,
    }));

    const byDayEmployee = activeUsers.map(u => [1, 2, 3, 4, 5, 6].map(d =>
      periodAbsences.filter(a => a.user_id === u.id && a.day_of_week === d).length
    ));
    const heatmapRows = activeUsers.map(u => `${u.first_name} ${u.last_name.charAt(0)}.`);

    return { rate, totalDays, absentDays, byEmployee, absTypes, trend, typeSegments, byDayEmployee, heatmapRows };
  }, [periodAbsences, periodWeeks, activeUsers, lang, period]);

  /* ══════════ 4. MACHINE OCCUPATION ══════════ */
  const machineOccupation = useMemo(() => {
    const totalMachines = machines.length;
    const available = machines.filter(m => m.status === 'AVAILABLE').length;
    const inUse = machines.filter(m => m.status === 'IN_USE').length;
    const maint = machines.filter(m => m.status === 'MAINTENANCE').length;
    const usageRate = pct(inUse, totalMachines);

    const allCounts = machines.map(mx => machineAllocs.filter(ma => ma.machine_id === mx.id).length);
    const globalMax = Math.max(...allCounts, 1);

    const byMachine = machines.map(m => {
      const mAllocs = machineAllocs.filter(ma => ma.machine_id === m.id).length;
      return { label: m.name, value: mAllocs, max: globalMax };
    }).sort((a, b) => b.value - a.value);

    const cats = [...new Set(machines.map(m => m.category).filter(Boolean))];
    const byCategory = cats.map(cat => {
      const catMachines = machines.filter(m => m.category === cat);
      const catInUse = catMachines.filter(m => m.status === 'IN_USE').length;
      return { label: cat, value: catInUse, max: catMachines.length };
    });

    const statusSegments = [
      { value: available, color: '#00e5a0', label: L.available ?? 'Available' },
      { value: inUse, color: '#00bcd4', label: L.inUse ?? 'In Use' },
      { value: maint, color: '#ffa726', label: L.maintenance ?? 'Maintenance' },
    ];

    return { totalMachines, available, inUse, maint, usageRate, byMachine, byCategory, statusSegments };
  }, [machines, machineAllocs, L]);

  /* ══════════ ★ 5. REPORT COMPLETION METRICS ══════════ */
  const reportMetrics = useMemo(() => {
    const total = periodReports.length;
    const completed = periodReports.filter(r => r.status === 'COMPLETED' || r.status === 'SUBMITTED').length;
    const planned = periodReports.filter(r => r.status === 'PLANNED').length;
    const inProgress = periodReports.filter(r => r.status === 'IN_PROGRESS').length;
    const completionRate = pct(completed, total);
    const totalPlannedHours = periodReports.reduce((s, r) => s + (r.planned_hours || 0), 0);
    const totalActualHours = periodReports.reduce((s, r) => s + (r.actual_hours || 0), 0);
    const efficiencyRate = pct(totalActualHours, totalPlannedHours);

    const byEmployee = activeUsers.map(u => {
      const uReports = periodReports.filter(r => r.user_id === u.id);
      const uCompleted = uReports.filter(r => r.status === 'COMPLETED' || r.status === 'SUBMITTED').length;
      return {
        label: `${u.first_name} ${u.last_name}`,
        value: uCompleted,
        max: Math.max(uReports.length, 1),
        totalReports: uReports.length,
      };
    }).sort((a, b) => (b.value / (b.max || 1)) - (a.value / (a.max || 1)));

    const statusSegments = [
      { value: completed, color: '#00e5a0', label: L.completed ?? 'Completed' },
      { value: inProgress, color: '#00bcd4', label: L.inProgress ?? 'In Progress' },
      { value: planned, color: '#ffa726', label: L.pending ?? 'Planned' },
    ].filter(s => s.value > 0);

    return {
      total, completed, planned, inProgress,
      completionRate, totalPlannedHours, totalActualHours, efficiencyRate,
      byEmployee, statusSegments,
    };
  }, [periodReports, activeUsers, L]);

  // ★ Individual stats for Employee view
  const individualStats = useMemo(() => {
    if (statsMode !== 'individual' || !user?.id) return null;
    const myId = user.id;
    const myJobs = periodJobs.filter(j => j.user_id === myId);
    const myAbsences = periodAbsences.filter(a => a.user_id === myId);
    const myReports = periodReports.filter(r => r.user_id === myId);
    const numWeeks = periodWeeks.length || 1;
    const daysPerWeek = period === 'day' ? 1 : 6;
    const slotsPerDay = 2;
    const maxSlots = numWeeks * daysPerWeek * slotsPerDay;
    const maxDays = numWeeks * daysPerWeek;
    const occupationRate = pct(myJobs.length, maxSlots);
    const absenceRateVal = pct(myAbsences.length, maxDays);
    const completedReports = myReports.filter(r => r.status === 'COMPLETED' || r.status === 'SUBMITTED').length;
    const reportCompletionRate = pct(completedReports, myReports.length);

    const dayNames = [L.mon ?? 'Mo', L.tue ?? 'Tu', L.wed ?? 'We', L.thu ?? 'Th', L.fri ?? 'Fr', L.sat ?? 'Sa'];
    const byDay = [1, 2, 3, 4, 5, 6].map((d, i) => ({
      label: dayNames[i],
      value: myJobs.filter(j => j.day_of_week === d).length,
      max: numWeeks * slotsPerDay,
    }));

    // Ranking among all active users (use full allUsers + all jobs for fair comparison)
    const allActiveUsers = allUsers.filter(u => u.is_active !== false);
    const rankings = allActiveUsers.map(u => {
      const uJobs = jobs.filter(j => periodWeekIds.has(j.week_id) && j.user_id === u.id).length;
      const uMax = numWeeks * 6 * slotsPerDay; // always use full week for ranking
      return { userId: u.id, rate: pct(uJobs, uMax) };
    }).sort((a, b) => b.rate - a.rate);

    const myRank = rankings.findIndex(r => r.userId === myId) + 1;
    const totalPeers = rankings.length;

    // Team average for comparison
    const myTeamMembers = allUsers.filter(u => u.team_leader_id === user?.team_leader_id && u.is_active !== false);
    const teamAvgRate = myTeamMembers.length > 0
      ? Math.round(myTeamMembers.reduce((sum, u) => {
          const uJobs = jobs.filter(j => periodWeekIds.has(j.week_id) && j.user_id === u.id).length;
          const uMax = numWeeks * 6 * slotsPerDay;
          return sum + pct(uJobs, uMax);
        }, 0) / myTeamMembers.length)
      : 0;

    const myTrend = periodWeeks.map(w => {
      const wJobs = myJobs.filter(j => j.week_id === w.id).length;
      const wMax = daysPerWeek * slotsPerDay;
      return pct(wJobs, wMax);
    });

    return {
      occupationRate,
      absenceRate: absenceRateVal,
      totalSlots: myJobs.length,
      maxSlots,
      totalAbsences: myAbsences.length,
      maxDays,
      byDay,
      myRank,
      totalPeers,
      teamAvgRate,
      myTrend,
      reportCompletionRate,
      totalReports: myReports.length,
      completedReports,
      myAbsenceTypes: (() => {
        const types: Record<string, number> = {};
        myAbsences.forEach(a => { const k = String(a.type || a.absence_code || '6'); types[k] = (types[k] || 0) + 1; });
        return Object.entries(types).map(([type, count]) => ({
          value: count,
          color: ABS_COLORS[type] || '#999',
          label: (ABS_LABELS[lang || 'de'] || ABS_LABELS.de)[type] || `Type ${type}`,
        }));
      })(),
    };
  }, [statsMode, user?.id, user?.team_leader_id, periodJobs, periodAbsences, periodReports, periodWeeks, allUsers, jobs, periodWeekIds, lang, L, period]);

  /* ══════════ ★ NEON COLORS ══════════ */
  const colors = {
    occupation: '#00e5a0',       // ★ neon green
    success: '#00e5a0',          // ★ neon green
    absence: '#ff6b9d',          // pink
    machine: '#00bcd4',          // ★ cyan
    track: isDark ? '#1e2a2a' : '#e0ece8',  // ★ subtle dark/light track
    green: '#00e5a0',            // ★ neon green
    red: '#ff6b9d',
    orange: '#ffa726',
    blue: '#00bcd4',             // ★ cyan
    purple: '#7c4dff',           // ★ purple
    report: '#b388ff',           // ★ light purple for reports
  };

  /* ══════════ ★ NEON STYLES ══════════ */
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

  const [teamView, setTeamView] = useState<'employee' | 'department' | 'day' | 'heatmap'>('employee');
  const [absView, setAbsView] = useState<'employee' | 'type' | 'heatmap'>('type');
  const [machView, setMachView] = useState<'machine' | 'category' | 'status'>('status');
  const [reportView, setReportView] = useState<'overview' | 'employee'>('overview');

  /* ══════════ CSV EXPORT ══════════ */
  const exportCSV = () => {
    const rows = [
      ['Metric', 'Value', 'Total', 'Percentage'],
      [L.teamOccupation ?? 'Team', String(teamOccupation.filledSlots), String(teamOccupation.totalSlots), teamOccupation.rate + '%'],
      [L.successRate ?? 'Success', String(successRate.completed), String(successRate.total), successRate.rate + '%'],
      [L.absenceRate ?? 'Absence', String(absenceRate.absentDays), String(absenceRate.totalDays), absenceRate.rate + '%'],
      [L.machineOccupation ?? 'Machines', String(machineOccupation.inUse), String(machineOccupation.totalMachines), machineOccupation.usageRate + '%'],
      ['Reports', String(reportMetrics.completed), String(reportMetrics.total), reportMetrics.completionRate + '%'],
      [''],
      ['--- Team By Employee ---'],
      ['Employee', 'Slots', 'Max', '%'],
      ...teamOccupation.byEmployee.map(e => [e.label, String(e.value), String(e.max), pct(e.value, e.max) + '%']),
      [''],
      ['--- Absences By Type ---'],
      ...absenceRate.typeSegments.map(s => [s.label, String(s.value)]),
      [''],
      ['--- Report Completion By Employee ---'],
      ...reportMetrics.byEmployee.map(e => [e.label, String(e.value), String(e.totalReports), pct(e.value, e.max) + '%']),
    ];
    if (teamComparison && teamComparison.length > 0) {
      rows.push([''], ['--- Team Comparison ---'], ['Team Leader', 'Members', 'Occupation %', 'Absence %', 'Report Completion %']);
      teamComparison.forEach(t => {
        rows.push([t.label, String(t.memberCount), t.occupationRate + '%', t.absenceRate + '%', t.reportCompletion + '%']);
      });
    }
    const csv = rows.map(r => (Array.isArray(r) ? r : [r]).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `stats-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ★ Stats mode title and description
  const statsTitle = useMemo(() => {
    switch (statsMode) {
      case 'global': return L.statsGlobal ?? 'Company Overview';
      case 'perimeter': return L.statsPerimeter ?? 'Department Overview';
      case 'team': return L.statsTeam ?? 'Team Performance';
      case 'individual': return L.statsIndividual ?? 'My Performance';
    }
  }, [statsMode, L]);

  const statsBadgeColor = useMemo(() => {
    switch (statsMode) {
      case 'global': return colors.occupation;
      case 'perimeter': return colors.blue;
      case 'team': return colors.green;
      case 'individual': return colors.purple;
    }
  }, [statsMode, colors]);

  /* ══════════ RENDER ══════════ */
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', color: th.textMuted, gap: 16 }}>
        <div style={{
          width: 48, height: 48,
          border: `4px solid ${colors.track}`,
          borderTopColor: colors.occupation,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          boxShadow: `0 0 16px ${colors.occupation}33`,
        }} />
        <span style={{ fontSize: 14, letterSpacing: .5 }}>{L.loading ?? 'Loading...'}</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const dayNames = [L.mon ?? 'Mo', L.tue ?? 'Tu', L.wed ?? 'We', L.thu ?? 'Th', L.fri ?? 'Fr', L.sat ?? 'Sa'];
  const trendLabels = periodWeeks.map(w => `${L.weekNum ?? 'W'}${w.week_number}`);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1280, margin: '0 auto', color: th.text, fontFamily: "'Inter','Segoe UI',sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{
            fontSize: 24, fontWeight: 300, letterSpacing: 3, margin: 0,
            background: 'linear-gradient(135deg,#00e5a0,#00bcd4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            {L.title ?? 'Statistics'}
          </h1>
          {/* ★ Stats mode badge */}
          <span style={{
            padding: '4px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
            background: `${statsBadgeColor}18`, color: statsBadgeColor,
            letterSpacing: .5, border: `1px solid ${statsBadgeColor}25`,
          }}>
            {statsTitle}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['day', 'week', 'month', 'quarter', 'year'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={periodBtn(period === p)}>
              {p === 'day' ? (L.day ?? 'Day') : (L as any)[p] ?? p}
            </button>
          ))}
          <button onClick={exportCSV} style={{
            ...periodBtn(false), marginLeft: 8,
            border: `1px solid ${isDark ? 'rgba(0,229,160,0.2)' : 'rgba(0,229,160,0.3)'}`,
          }}>
            ⬇ {L.export ?? 'Export'}
          </button>
        </div>
      </div>

      {/* ══════════ INDIVIDUAL VIEW (Employee) ══════════ */}
      {statsMode === 'individual' && individualStats && (
        <>
          {/* Personal KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBottom: 28 }}>
            <div style={kpiCard()} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,229,160,0.15)`; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = isDark ? '0 2px 16px rgba(0,0,0,.25)' : '0 2px 16px rgba(0,0,0,.04)'; }}>
              <GaugeDonut value={individualStats.occupationRate} size={80} strokeWidth={10} color={colors.occupation} trackColor={colors.track} label="" innerLabel={L.slots ?? 'Slots'} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{L.myOccupation ?? 'My Occupation'}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: colors.occupation }}>{individualStats.occupationRate}%</div>
                <div style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>{individualStats.totalSlots} / {individualStats.maxSlots}</div>
              </div>
            </div>

            <div style={kpiCard()} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(255,107,157,0.15)`; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = isDark ? '0 2px 16px rgba(0,0,0,.25)' : '0 2px 16px rgba(0,0,0,.04)'; }}>
              <GaugeDonut value={individualStats.absenceRate} size={80} strokeWidth={10} color={colors.absence} trackColor={colors.track} label="" innerLabel={L.rate ?? 'Rate'} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{L.myAbsences ?? 'My Absences'}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: colors.absence }}>{individualStats.absenceRate}%</div>
                <div style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>{individualStats.totalAbsences} / {individualStats.maxDays}</div>
              </div>
            </div>

            <div style={kpiCard()} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(124,77,255,0.15)`; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = isDark ? '0 2px 16px rgba(0,0,0,.25)' : '0 2px 16px rgba(0,0,0,.04)'; }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: `linear-gradient(135deg,${colors.purple}18,${colors.purple}08)`,
                border: `1px solid ${colors.purple}25`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: colors.purple }}>#{individualStats.myRank}</div>
                <div style={{ fontSize: 9, color: colors.purple, opacity: .6 }}>/ {individualStats.totalPeers}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{L.ranking ?? 'Ranking'}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: colors.purple }}>
                  {L.comparedToOthers ?? 'Compared to Others'}
                </div>
                <div style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>
                  {pct(individualStats.totalPeers - individualStats.myRank, individualStats.totalPeers)}% {L.aboveAverage ?? 'above'}
                </div>
              </div>
            </div>

            {/* ★ New: Report Completion KPI */}
            <div style={kpiCard()} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(179,136,255,0.15)`; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = isDark ? '0 2px 16px rgba(0,0,0,.25)' : '0 2px 16px rgba(0,0,0,.04)'; }}>
              <GaugeDonut value={individualStats.reportCompletionRate} size={80} strokeWidth={10} color={colors.report} trackColor={colors.track} label="" innerLabel={L.reports ?? 'Reports'} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{L.reportCompletion ?? 'Report Completion'}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: colors.report }}>{individualStats.reportCompletionRate}%</div>
                <div style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>{individualStats.completedReports} / {individualStats.totalReports}</div>
              </div>
            </div>
          </div>

          {/* ★ Team Average Comparison */}
          {individualStats.teamAvgRate > 0 && (
            <div style={card({ marginBottom: 20 })}>
              <div style={sectionTitle}><span>📊</span> {L.vsTeamAverage ?? 'You vs Team Average'}</div>
              <div style={{ display: 'flex', gap: 40, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <GaugeDonut value={individualStats.occupationRate} size={100} strokeWidth={12} color={colors.occupation} trackColor={colors.track}
                    label={L.you ?? 'You'} sublabel={`${individualStats.occupationRate}%`} />
                </div>
                <div style={{ fontSize: 24, fontWeight: 300, color: th.textMuted }}>vs</div>
                <div style={{ textAlign: 'center' }}>
                  <GaugeDonut value={individualStats.teamAvgRate} size={100} strokeWidth={12} color={colors.blue} trackColor={colors.track}
                    label={L.teamAverage ?? 'Team Avg'} sublabel={`${individualStats.teamAvgRate}%`} />
                </div>
                <div style={{
                  padding: '12px 24px', borderRadius: 12,
                  background: individualStats.occupationRate >= individualStats.teamAvgRate
                    ? `${colors.green}12` : `${colors.red}12`,
                  border: `1px solid ${individualStats.occupationRate >= individualStats.teamAvgRate ? colors.green : colors.red}25`,
                }}>
                  <div style={{
                    fontSize: 20, fontWeight: 800,
                    color: individualStats.occupationRate >= individualStats.teamAvgRate ? colors.green : colors.red,
                  }}>
                    {individualStats.occupationRate >= individualStats.teamAvgRate ? '+' : ''}
                    {individualStats.occupationRate - individualStats.teamAvgRate}%
                  </div>
                  <div style={{ fontSize: 10, color: th.textMuted }}>
                    {individualStats.occupationRate >= individualStats.teamAvgRate
                      ? (L.aboveTeamAvg ?? 'Above team average')
                      : (L.belowTeamAvg ?? 'Below team average')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Personal charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(380px,1fr))', gap: 20, marginBottom: 28 }}>
            {/* Daily breakdown */}
            <div style={card()}>
              <div style={sectionTitle}><span>📊</span> {L.dailyBreakdown ?? 'Daily Breakdown'}</div>
              <BarChart data={individualStats.byDay} color={colors.occupation}
                maxVal={Math.max(...individualStats.byDay.map(d => d.max), 1)} th={th} />
            </div>

            {/* My absence types */}
            <div style={card()}>
              <div style={sectionTitle}><span>🏥</span> {L.myAbsences ?? 'My Absences'}</div>
              {individualStats.myAbsenceTypes.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
                  <PieChart
                    segments={individualStats.myAbsenceTypes}
                    size={120} strokeWidth={20} trackColor={colors.track}
                    centerLabel={String(individualStats.totalAbsences)} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {individualStats.myAbsenceTypes.map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, boxShadow: `0 0 6px ${s.color}44` }} />
                        <span style={{ fontSize: 11, color: th.textMuted }}>{s.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: th.textDim || th.textMuted, fontSize: 13, opacity: .6 }}>{L.noData ?? 'No absences'}</div>
              )}
            </div>
          </div>

          {/* My weekly trend */}
          {periodWeeks.length > 1 && (
            <div style={card({ marginBottom: 20 })}>
              <div style={sectionTitle}><span>📈</span> {L.myTrend ?? 'My Weekly Trend'}</div>
              <AreaSparkline data={individualStats.myTrend} color={colors.occupation} width={500} height={70} labels={trendLabels} />
            </div>
          )}
        </>
      )}

      {/* ══════════ TEAM / PERIMETER / GLOBAL VIEWS ══════════ */}
      {statsMode !== 'individual' && (
        <>
          {/* ── KPI GAUGES ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBottom: 28 }}>
            <div style={kpiCard()} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,229,160,0.15)`; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = isDark ? '0 2px 16px rgba(0,0,0,.25)' : '0 2px 16px rgba(0,0,0,.04)'; }}>
              <GaugeDonut value={teamOccupation.rate} size={80} strokeWidth={10} color={colors.occupation} trackColor={colors.track} label="" innerLabel={L.slots ?? 'Slots'} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{L.teamOccupation ?? 'Team Occupation'}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: colors.occupation }}>{teamOccupation.rate}%</div>
                <div style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>{teamOccupation.filledSlots} / {teamOccupation.totalSlots}</div>
              </div>
            </div>

            {(statsMode === 'global' || statsMode === 'perimeter') && (
              <div style={kpiCard()} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,229,160,0.12)`; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = isDark ? '0 2px 16px rgba(0,0,0,.25)' : '0 2px 16px rgba(0,0,0,.04)'; }}>
                <GaugeDonut value={successRate.rate} size={80} strokeWidth={10} color={colors.success} trackColor={colors.track} label="" innerLabel={L.tasks ?? 'Tasks'} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{L.successRate ?? 'Success Rate'}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: colors.success }}>{successRate.rate}%</div>
                  <div style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>{successRate.completed} / {successRate.total}</div>
                </div>
              </div>
            )}

            <div style={kpiCard()} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(255,107,157,0.12)`; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = isDark ? '0 2px 16px rgba(0,0,0,.25)' : '0 2px 16px rgba(0,0,0,.04)'; }}>
              <GaugeDonut value={absenceRate.rate} size={80} strokeWidth={10} color={colors.absence} trackColor={colors.track} label="" innerLabel={L.rate ?? 'Rate'} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{L.absenceRate ?? 'Absence Rate'}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: colors.absence }}>{absenceRate.rate}%</div>
                <div style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>{absenceRate.absentDays} / {absenceRate.totalDays}</div>
              </div>
            </div>

            {(statsMode === 'global' || (statsMode === 'perimeter' && isOperational((user?.departments ?? []).flat() as string[]))) && (
              <div style={kpiCard()} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,188,212,0.15)`; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = isDark ? '0 2px 16px rgba(0,0,0,.25)' : '0 2px 16px rgba(0,0,0,.04)'; }}>
                <GaugeDonut value={machineOccupation.usageRate} size={80} strokeWidth={10} color={colors.machine} trackColor={colors.track} label="" innerLabel={L.rate ?? 'Rate'} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{L.machineOccupation ?? 'Machine Usage'}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: colors.machine }}>{machineOccupation.usageRate}%</div>
                  <div style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>{machineOccupation.inUse} / {machineOccupation.totalMachines}</div>
                </div>
              </div>
            )}

            {/* ★ Report Completion KPI */}
            <div style={kpiCard()} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(179,136,255,0.15)`; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = isDark ? '0 2px 16px rgba(0,0,0,.25)' : '0 2px 16px rgba(0,0,0,.04)'; }}>
              <GaugeDonut value={reportMetrics.completionRate} size={80} strokeWidth={10} color={colors.report} trackColor={colors.track} label="" innerLabel={L.reports ?? 'Reports'} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{L.reportCompletion ?? 'Report Completion'}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: colors.report }}>{reportMetrics.completionRate}%</div>
                <div style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>{reportMetrics.completed} / {reportMetrics.total}</div>
              </div>
            </div>
          </div>

          {/* ── CEO-ONLY: Global P&L / Efficiency / Margin indicators ── */}
          {statsMode === 'global' && (
            <div style={card({ marginBottom: 20 })}>
              <div style={sectionTitle}><span>💰</span> {L.pnl ?? 'P&L Overview'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 20 }}>
                <div style={{ textAlign: 'center', padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>
                    {L.efficiency ?? 'Efficiency'}
                  </div>
                  <GaugeDonut value={teamOccupation.rate} size={100} strokeWidth={12} color={colors.green} trackColor={colors.track}
                    label={L.efficiency ?? 'Efficiency'} sublabel={`${teamOccupation.filledSlots} ${L.slots ?? 'slots'}`} />
                </div>
                <div style={{ textAlign: 'center', padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>
                    {L.taskCompletion ?? 'Task Completion'}
                  </div>
                  <GaugeDonut value={successRate.rate} size={100} strokeWidth={12} color={colors.success} trackColor={colors.track}
                    label={L.taskCompletion ?? 'Completion'} sublabel={`${successRate.completed}/${successRate.total}`} />
                </div>
                <div style={{ textAlign: 'center', padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>
                    {L.attendance ?? 'Attendance'}
                  </div>
                  <GaugeDonut value={100 - absenceRate.rate} size={100} strokeWidth={12} color={colors.blue} trackColor={colors.track}
                    label={L.attendance ?? 'Attendance'} sublabel={`${100 - absenceRate.rate}%`} />
                </div>
                <div style={{ textAlign: 'center', padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>
                    {L.machineUtilization ?? 'Machine Util.'}
                  </div>
                  <GaugeDonut value={machineOccupation.usageRate} size={100} strokeWidth={12} color={colors.machine} trackColor={colors.track}
                    label={L.machineUtilization ?? 'Machines'} sublabel={`${machineOccupation.inUse}/${machineOccupation.totalMachines}`} />
                </div>
                <div style={{ textAlign: 'center', padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>
                    {L.reportEfficiency ?? 'Report Efficiency'}
                  </div>
                  <GaugeDonut value={reportMetrics.efficiencyRate} size={100} strokeWidth={12} color={colors.report} trackColor={colors.track}
                    label={L.hoursEfficiency ?? 'Hours'} sublabel={`${reportMetrics.totalActualHours}h / ${reportMetrics.totalPlannedHours}h`} />
                </div>
              </div>
            </div>
          )}

          {/* ── ★ TOP3 / FLOP3 Rankings (Manager / Executive / CEO) ── */}
          {(statsMode === 'team' || statsMode === 'perimeter' || statsMode === 'global') && teamOccupation.byEmployee.length >= 3 && (
            <div style={card({ marginBottom: 20 })}>
              <div style={sectionTitle}><span>🏆</span> {L.rankings ?? 'Rankings'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 28 }}>
                <RankingList
                  items={top3}
                  title={L.top3Workers ?? 'Top 3 Workers'}
                  icon="🥇"
                  color={colors.green}
                  th={th}
                />
                <RankingList
                  items={flop3}
                  title={L.flop3Workers ?? 'Needs Improvement'}
                  icon="📉"
                  color={colors.red}
                  isFlop
                  th={th}
                />
              </div>
            </div>
          )}

          {/* ── ★ TEAM vs TEAM COMPARISON (Executive / CEO) ── */}
          {(statsMode === 'global' || statsMode === 'perimeter') && teamComparison && teamComparison.length > 1 && (
            <div style={card({ marginBottom: 20 })}>
              <div style={sectionTitle}><span>⚔️</span> {L.teamComparison ?? 'Team vs Team'}</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${isDark ? 'rgba(0,229,160,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 700, color: th.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>{L.teamLeader ?? 'Team Leader'}</th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 700, color: th.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>{L.members ?? 'Members'}</th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 700, color: th.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>{L.occupation ?? 'Occupation'}</th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 700, color: th.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>{L.absences ?? 'Absences'}</th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 700, color: th.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>{L.reports ?? 'Reports'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamComparison.map((team, i) => (
                      <tr key={team.id} style={{
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'}`,
                        background: i === 0 ? `${colors.green}06` : 'transparent',
                      }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: th.text }}>
                          {i === 0 && <span style={{ marginRight: 6 }}>🥇</span>}
                          {i === 1 && <span style={{ marginRight: 6 }}>🥈</span>}
                          {i === 2 && <span style={{ marginRight: 6 }}>🥉</span>}
                          {team.label}
                        </td>
                        <td style={{ textAlign: 'center', padding: '10px 8px', color: th.textMuted }}>{team.memberCount}</td>
                        <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 6, fontWeight: 700, fontSize: 12,
                            background: `${colors.green}15`, color: colors.green,
                          }}>{team.occupationRate}%</span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 6, fontWeight: 700, fontSize: 12,
                            background: `${colors.red}15`, color: colors.red,
                          }}>{team.absenceRate}%</span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 6, fontWeight: 700, fontSize: 12,
                            background: `${colors.report}15`, color: colors.report,
                          }}>{team.reportCompletion}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── WEEKLY TREND AREA CHARTS ── */}
          {periodWeeks.length > 1 && (
            <div style={card({ marginBottom: 20 })}>
              <div style={sectionTitle}><span>📈</span> {L.weeklyTrend ?? 'Weekly Trend'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 24 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: th.textMuted, marginBottom: 8 }}>{L.teamOccupation ?? 'Team Occupation'}</div>
                  <AreaSparkline data={teamOccupation.trend} color={colors.occupation} width={260} height={60} labels={trendLabels} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: th.textMuted, marginBottom: 8 }}>{L.absenceRate ?? 'Absence Rate'}</div>
                  <AreaSparkline data={absenceRate.trend} color={colors.absence} width={260} height={60} labels={trendLabels} />
                </div>
              </div>
            </div>
          )}

          {/* ── DETAIL SECTIONS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(480px,1fr))', gap: 20 }}>

            {/* ─── TEAM OCCUPATION ─── */}
            <div style={card()}>
              <div style={sectionTitle}>
                <span>👥</span> {L.teamOccupation ?? 'Team Occupation'}
                <span style={{ flex: 1 }} />
                {([
                  { key: 'employee' as const, label: L.byEmployee ?? 'Employee' },
                  { key: 'department' as const, label: L.byDepartment ?? 'Department' },
                  { key: 'day' as const, label: L.byDay ?? 'Day' },
                  { key: 'heatmap' as const, label: L.heatmap ?? 'Heatmap' },
                ]).map(v => (
                  <button key={v.key} onClick={() => setTeamView(v.key)} style={subtab(teamView === v.key)}>{v.label}</button>
                ))}
              </div>

              {teamView === 'employee' && (
                <BarChart data={teamOccupation.byEmployee} color={colors.occupation}
                  maxVal={Math.max(...teamOccupation.byEmployee.map(d => d.max), 1)} th={th} />
              )}

              {teamView === 'department' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 20 }}>
                    {teamOccupation.byDept.map((d, i) => (
                      <GaugeDonut key={i} value={pct(d.value, d.max)} size={110} strokeWidth={12}
                        color={i === 0 ? colors.green : colors.blue} trackColor={colors.track}
                        label={d.label} sublabel={`${d.value}/${d.max} ${(L.slots ?? 'slots').toLowerCase()}`} />
                    ))}
                  </div>
                  <StackedBar th={th} segments={teamOccupation.byDept.map((d, i) => ({
                    value: d.value,
                    color: i === 0 ? colors.green : colors.blue,
                    label: d.label,
                  }))} />
                </>
              )}

              {teamView === 'day' && (
                <VerticalBarChart th={th} groups={teamOccupation.byDayGrouped} />
              )}

              {teamView === 'heatmap' && teamOccupation.heatmapData.length > 0 && (
                <HeatmapGrid
                  data={teamOccupation.heatmapData}
                  rowLabels={teamOccupation.heatmapRows}
                  colLabels={dayNames}
                  maxVal={Math.max(...teamOccupation.heatmapData.flat(), 1)}
                  baseColor={colors.occupation}
                  th={th} />
              )}
            </div>

            {/* ─── TASK / SUCCESS RATE (CEO + Executives only) ─── */}
            {(statsMode === 'global' || statsMode === 'perimeter') && (
              <div style={card()}>
                <div style={sectionTitle}><span>🎯</span> {L.taskDistribution ?? 'Task Distribution'}</div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, marginBottom: 20, flexWrap: 'wrap' }}>
                  <PieChart
                    segments={successRate.statusCounts.map(s => ({ value: s.count, color: s.color, label: s.status }))}
                    size={160} strokeWidth={28} trackColor={colors.track}
                    centerLabel={String(successRate.total)} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {successRate.statusCounts.map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 4, background: s.color, boxShadow: `0 0 6px ${s.color}44` }} />
                        <span style={{ fontSize: 12, color: th.textMuted, minWidth: 80 }}>
                          {s.status === 'COMPLETED' ? (L.completed ?? 'Completed') : s.status === 'ACTIVE' ? (L.active ?? 'Active') : s.status === 'PLANNED' ? (L.pending ?? 'Planned') : (L.cancelled ?? 'Cancelled')}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.count}</span>
                        <span style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>({pct(s.count, successRate.total)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>

                <StackedBar th={th} height={28} segments={successRate.statusCounts.map(s => ({
                  value: s.count, color: s.color,
                  label: s.status === 'COMPLETED' ? (L.completed ?? 'Completed') : s.status === 'ACTIVE' ? (L.active ?? 'Active') : s.status === 'PLANNED' ? (L.pending ?? 'Planned') : (L.cancelled ?? 'Cancelled'),
                }))} />
              </div>
            )}

            {/* ─── ABSENCE RATE ─── */}
            <div style={card()}>
              <div style={sectionTitle}>
                <span>🏥</span> {L.absenceBreakdown ?? 'Absence Breakdown'}
                <span style={{ flex: 1 }} />
                {([
                  { key: 'type' as const, label: L.byType ?? 'Type' },
                  { key: 'employee' as const, label: L.byEmployee ?? 'Employee' },
                  { key: 'heatmap' as const, label: L.heatmap ?? 'Heatmap' },
                ]).map(v => (
                  <button key={v.key} onClick={() => setAbsView(v.key)} style={subtab(absView === v.key)}>{v.label}</button>
                ))}
              </div>

              {absView === 'type' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
                  {absenceRate.typeSegments.length > 0 ? (
                    <>
                      <PieChart
                        segments={absenceRate.typeSegments}
                        size={150} strokeWidth={24} trackColor={colors.track}
                        centerLabel={String(absenceRate.absentDays)} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {absenceRate.typeSegments.map((s, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: s.color, boxShadow: `0 0 6px ${s.color}44` }} />
                            <span style={{ fontSize: 12, color: th.textMuted, minWidth: 90 }}>{s.label}</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</span>
                            <span style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>({pct(s.value, absenceRate.absentDays)}%)</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: th.textDim || th.textMuted, padding: 20, opacity: .6 }}>{L.noData ?? 'No data'}</div>
                  )}
                </div>
              )}

              {absView === 'employee' && (
                <BarChart data={absenceRate.byEmployee} color={colors.absence}
                  maxVal={Math.max(...absenceRate.byEmployee.map(d => d.max), 1)} th={th} />
              )}

              {absView === 'heatmap' && absenceRate.byDayEmployee.length > 0 && (
                <HeatmapGrid
                  data={absenceRate.byDayEmployee}
                  rowLabels={absenceRate.heatmapRows}
                  colLabels={dayNames}
                  maxVal={Math.max(...absenceRate.byDayEmployee.flat(), 1)}
                  baseColor={colors.absence}
                  th={th} />
              )}
            </div>

            {/* ─── ★ REPORT COMPLETION SECTION ─── */}
            <div style={card()}>
              <div style={sectionTitle}>
                <span>📋</span> {L.reportCompletion ?? 'Report Completion'}
                <span style={{ flex: 1 }} />
                {([
                  { key: 'overview' as const, label: L.overview ?? 'Overview' },
                  { key: 'employee' as const, label: L.byEmployee ?? 'Employee' },
                ]).map(v => (
                  <button key={v.key} onClick={() => setReportView(v.key)} style={subtab(reportView === v.key)}>{v.label}</button>
                ))}
              </div>

              {reportView === 'overview' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
                  {reportMetrics.statusSegments.length > 0 ? (
                    <>
                      <PieChart
                        segments={reportMetrics.statusSegments}
                        size={150} strokeWidth={24} trackColor={colors.track}
                        centerLabel={String(reportMetrics.total)} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {reportMetrics.statusSegments.map((s, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: s.color, boxShadow: `0 0 6px ${s.color}44` }} />
                            <span style={{ fontSize: 12, color: th.textMuted, minWidth: 90 }}>{s.label}</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</span>
                            <span style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>({pct(s.value, reportMetrics.total)}%)</span>
                          </div>
                        ))}
                        {/* Hours efficiency */}
                        <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: `${colors.report}08`, border: `1px solid ${colors.report}15` }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: th.textMuted, marginBottom: 4 }}>{L.hoursEfficiency ?? 'Hours Efficiency'}</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                            <span style={{ fontSize: 18, fontWeight: 800, color: colors.report }}>{reportMetrics.efficiencyRate}%</span>
                            <span style={{ fontSize: 11, color: th.textDim || th.textMuted }}>({reportMetrics.totalActualHours}h / {reportMetrics.totalPlannedHours}h)</span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: th.textDim || th.textMuted, padding: 20, opacity: .6 }}>{L.noData ?? 'No reports'}</div>
                  )}
                </div>
              )}

              {reportView === 'employee' && (
                <BarChart data={reportMetrics.byEmployee.map(e => ({
                  label: e.label,
                  value: e.value,
                  max: e.max,
                  color: colors.report,
                }))} color={colors.report}
                  maxVal={Math.max(...reportMetrics.byEmployee.map(d => d.max), 1)} th={th} />
              )}
            </div>

            {/* ─── MACHINE OCCUPATION ─── */}
            {(statsMode === 'global' || statsMode === 'perimeter' || statsMode === 'team') && (
              <div style={card()}>
                <div style={sectionTitle}>
                  <span>🚜</span> {L.machineOccupation ?? 'Machine Usage'}
                  <span style={{ flex: 1 }} />
                  {([
                    { key: 'status' as const, label: L.byStatus ?? 'Status' },
                    { key: 'machine' as const, label: L.byMachine ?? 'Machine' },
                    { key: 'category' as const, label: L.byCategory ?? 'Category' },
                  ]).map(v => (
                    <button key={v.key} onClick={() => setMachView(v.key)} style={subtab(machView === v.key)}>{v.label}</button>
                  ))}
                </div>

                {machView === 'status' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, flexWrap: 'wrap', marginBottom: 16 }}>
                    <PieChart
                      segments={machineOccupation.statusSegments}
                      size={150} strokeWidth={26} trackColor={colors.track}
                      centerLabel={String(machineOccupation.totalMachines)} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {machineOccupation.statusSegments.map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 14, height: 14, borderRadius: 4, background: s.color, boxShadow: `0 0 6px ${s.color}44` }} />
                          <span style={{ fontSize: 12, color: th.textMuted, minWidth: 90 }}>{s.label}</span>
                          <span style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</span>
                          <span style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>({pct(s.value, machineOccupation.totalMachines)}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {machView === 'machine' && (
                  <BarChart data={machineOccupation.byMachine} color={colors.machine}
                    maxVal={Math.max(...machineOccupation.byMachine.map(d => d.max), 1)} th={th} />
                )}

                {machView === 'category' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 16 }}>
                      {machineOccupation.byCategory.map((c, i) => (
                        <GaugeDonut key={i} value={pct(c.value, c.max)} size={100} strokeWidth={10}
                          color={[colors.blue, colors.green, colors.orange, colors.purple][i % 4]}
                          trackColor={colors.track} label={c.label} sublabel={`${c.value}/${c.max}`} />
                      ))}
                    </div>
                    <StackedBar th={th} segments={machineOccupation.byCategory.map((c, i) => ({
                      value: c.value,
                      color: [colors.blue, colors.green, colors.orange, colors.purple][i % 4],
                      label: c.label,
                    }))} />
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
