// frontend/src/pages/stats/charts/RankingList.tsx

import { pct } from '../helpers';

interface RankItem {
  label: string;
  value: number;
  max: number;
}

interface Props {
  items: RankItem[];
  title: string;
  icon: string;
  color: string;
  isFlop?: boolean;
  th: Record<string, string>;
}

export function RankingList({ items, title, icon, color, isFlop, th }: Props) {
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
