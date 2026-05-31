// frontend/src/pages/stats/sections/TaskDistribution.tsx

import { useMemo } from 'react';
import { useTheme } from '../../../contexts/themeContext';
import { getTranslations, type LangCode } from '../../../i18n';
import { pct } from '../helpers';
import { getNeonColors } from '../constants';
import { getStatsStyles } from '../styles';
import { PieChart } from '../charts/PieChart';
import { StackedBar } from '../charts/StackedBar';
import type { StatsData } from '../types';

interface Props { data: StatsData; }

export function TaskDistribution({ data }: Props) {
  const { isDark, th, lang } = useTheme();
  const t = getTranslations(lang as LangCode) as Record<string, any>;
  const colors = getNeonColors(isDark);
  const styles = getStatsStyles(isDark, th);

  const computed = useMemo(() => {
    const total = data.tasks.length;
    const completed = data.tasks.filter(tk => (tk.status || '').toUpperCase() === 'COMPLETED').length;
    const cancelled = data.tasks.filter(tk => (tk.status || '').toUpperCase() === 'CANCELLED').length;
    const active = data.tasks.filter(tk => (tk.status || '').toUpperCase() === 'ACTIVE').length;
    const planned = data.tasks.filter(tk => (tk.status || '').toUpperCase() === 'PLANNED').length;
    const rate = pct(completed, total);
    const statusCounts = [
      { status: 'COMPLETED', count: completed, color: '#00e5a0' },
      { status: 'ACTIVE', count: active, color: '#00bcd4' },
      { status: 'PLANNED', count: planned, color: '#ffa726' },
      { status: 'CANCELLED', count: cancelled, color: '#ff6b9d' },
    ].filter(s => s.count > 0);
    return { rate, total, statusCounts };
  }, [data.tasks]);

  const statusLabel = (s: string) => {
    switch (s) {
      case 'COMPLETED': return t.completed || 'Completed';
      case 'ACTIVE': return t.active || 'Active';
      case 'PLANNED': return t.statsPending || t.pending || 'Planned';
      case 'CANCELLED': return t.statsCancelled || 'Cancelled';
      default: return s;
    }
  };

  return (
    <div style={styles.card()}>
      <div style={styles.sectionTitle}><span>🎯</span> {t.statsTaskDistribution || 'Task Distribution'}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, marginBottom: 20, flexWrap: 'wrap' }}>
        <PieChart segments={computed.statusCounts.map(s => ({ value: s.count, color: s.color, label: s.status }))}
          size={160} strokeWidth={28} trackColor={colors.track} centerLabel={String(computed.total)} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {computed.statusCounts.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, background: s.color, boxShadow: `0 0 6px ${s.color}44` }} />
              <span style={{ fontSize: 12, color: th.textMuted, minWidth: 80 }}>{statusLabel(s.status)}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.count}</span>
              <span style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>({pct(s.count, computed.total)}%)</span>
            </div>
          ))}
        </div>
      </div>
      <StackedBar th={th} height={28} segments={computed.statusCounts.map(s => ({
        value: s.count, color: s.color, label: statusLabel(s.status),
      }))} />
    </div>
  );
}
