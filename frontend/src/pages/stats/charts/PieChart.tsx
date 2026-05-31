// frontend/src/pages/stats/charts/PieChart.tsx

import { useRef } from 'react';

interface Segment {
  value: number;
  color: string;
  label: string;
}

interface Props {
  segments: Segment[];
  size?: number;
  strokeWidth?: number;
  trackColor: string;
  centerLabel?: string;
}

export function PieChart({ segments, size = 160, strokeWidth = 24, trackColor, centerLabel }: Props) {
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
