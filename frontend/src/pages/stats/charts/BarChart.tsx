// frontend/src/pages/stats/charts/BarChart.tsx

import { pct } from '../helpers';

interface BarData {
  label: string;
  value: number;
  max: number;
  color?: string;
}

interface Props {
  data: BarData[];
  color: string;
  maxVal: number;
  th: Record<string, string>;
  showPctLabel?: boolean;
}

export function BarChart({ data, color, maxVal, th, showPctLabel = true }: Props) {
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
                <rect x={0} y={0}
                  width={`${maxVal === 0 ? 0 : (d.value / maxVal) * 100}%`}
                  height={8} rx={20}
                  fill={`url(#${barGid})`}
                  style={{ transition: 'width .8s cubic-bezier(.4,0,.2,1)', filter: `drop-shadow(0 0 4px ${barColor}55)` }} />
              </svg>
            </div>
            {showPctLabel && <div style={{ width: 52, fontSize: 12, fontWeight: 700, color: barColor, textAlign: 'right' }}>{p}%</div>}
          </div>
        );
      })}
    </div>
  );
}
