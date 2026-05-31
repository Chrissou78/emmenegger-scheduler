// frontend/src/pages/stats/charts/GaugeDonut.tsx

import { useRef } from 'react';
import { clamp } from '../helpers';

interface Props {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor: string;
  label: string;
  sublabel?: string;
  innerLabel?: string;
}

export function GaugeDonut({ value, size = 130, strokeWidth = 16, color, trackColor, label, sublabel, innerLabel }: Props) {
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
