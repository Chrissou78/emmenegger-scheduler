// frontend/src/pages/stats/charts/AreaSparkline.tsx

import { useRef } from 'react';

interface Props {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  labels?: string[];
}

export function AreaSparkline({ data, color, width = 220, height = 55, labels }: Props) {
  const uid = useRef(`area-${Math.random().toString(36).slice(2, 8)}`).current;
  const glowId = useRef(`area-glow-${Math.random().toString(36).slice(2, 8)}`).current;

  if (data.length < 2) return null;
  const pad = 4;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
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
