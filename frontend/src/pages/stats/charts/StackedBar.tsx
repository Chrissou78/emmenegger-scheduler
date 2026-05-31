// frontend/src/pages/stats/charts/StackedBar.tsx

import { pct } from '../helpers';

interface Segment {
  value: number;
  color: string;
  label: string;
}

interface Props {
  segments: Segment[];
  height?: number;
  th: Record<string, string>;
}

export function StackedBar({ segments, height = 32, th }: Props) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <div>
      <div style={{ height, borderRadius: 20, overflow: 'hidden', display: 'flex', background: `${th.borderFaint || th.border}22`, boxShadow: 'inset 0 1px 3px rgba(0,0,0,.15)' }}>
        {total > 0 && segments.filter(s => s.value > 0).map((seg, i) => (
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
        ))}
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
