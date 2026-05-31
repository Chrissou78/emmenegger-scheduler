// frontend/src/pages/stats/charts/VerticalBarChart.tsx

interface Bar {
  value: number;
  color: string;
  label: string;
}

interface Group {
  label: string;
  bars: Bar[];
}

interface Props {
  groups: Group[];
  height?: number;
  th: Record<string, string>;
}

export function VerticalBarChart({ groups, height = 180, th }: Props) {
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
