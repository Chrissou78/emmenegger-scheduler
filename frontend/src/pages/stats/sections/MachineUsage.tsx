// frontend/src/pages/stats/sections/MachineUsage.tsx

import { useState, useMemo } from 'react';
import { useTheme } from '../../../contexts/themeContext';
import { getTranslations, type LangCode } from '../../../i18n';
import { pct } from '../helpers';
import { getNeonColors } from '../constants';
import { getStatsStyles } from '../styles';
import { PieChart } from '../charts/PieChart';
import { BarChart } from '../charts/BarChart';
import { GaugeDonut } from '../charts/GaugeDonut';
import { StackedBar } from '../charts/StackedBar';
import type { StatsData } from '../types';

interface Props { data: StatsData; }

export function MachineUsage({ data }: Props) {
  const { isDark, th, lang } = useTheme();
  const t = getTranslations(lang as LangCode) as Record<string, any>;
  const colors = getNeonColors(isDark);
  const styles = getStatsStyles(isDark, th);
  const [view, setView] = useState<'status' | 'machine' | 'category'>('status');

  const computed = useMemo(() => {
    const { machines, machineAllocs } = data;
    const totalMachines = machines.length;
    const available = machines.filter(m => m.status === 'AVAILABLE').length;
    const inUse = machines.filter(m => m.status === 'IN_USE').length;
    const maint = machines.filter(m => m.status === 'MAINTENANCE').length;
    const usageRate = pct(inUse, totalMachines);

    const allCounts = machines.map(mx => machineAllocs.filter(ma => ma.machine_id === mx.id).length);
    const globalMax = Math.max(...allCounts, 1);

    const byMachine = machines.map(m => ({
      label: m.name,
      value: machineAllocs.filter(ma => ma.machine_id === m.id).length,
      max: globalMax,
    })).sort((a, b) => b.value - a.value);

    const cats = [...new Set(machines.map(m => m.category).filter(Boolean))];
    const byCategory = cats.map(cat => {
      const catMachines = machines.filter(m => m.category === cat);
      const catInUse = catMachines.filter(m => m.status === 'IN_USE').length;
      return { label: cat, value: catInUse, max: catMachines.length };
    });

    const statusSegments = [
      { value: available, color: '#00e5a0', label: t.available || 'Available' },
      { value: inUse, color: '#00bcd4', label: t.inUse || 'In Use' },
      { value: maint, color: '#ffa726', label: t.maintenance || 'Maintenance' },
    ];

    return { totalMachines, usageRate, byMachine, byCategory, statusSegments };
  }, [data.machines, data.machineAllocs, t]);

  return (
    <div style={styles.card()}>
      <div style={styles.sectionTitle}>
        <span>🚜</span> {t.statsMachineUsage || t.machineOccupation || 'Machine Usage'}
        <span style={{ flex: 1 }} />
        {([
          { key: 'status' as const, label: t.statsByStatus || 'Status' },
          { key: 'machine' as const, label: t.statsByMachine || 'Machine' },
          { key: 'category' as const, label: t.statsByCategory || 'Category' },
        ]).map(v => (
          <button key={v.key} onClick={() => setView(v.key)} style={styles.subtab(view === v.key)}>{v.label}</button>
        ))}
      </div>

      {view === 'status' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, flexWrap: 'wrap', marginBottom: 16 }}>
          <PieChart segments={computed.statusSegments} size={150} strokeWidth={26} trackColor={colors.track}
            centerLabel={String(computed.totalMachines)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {computed.statusSegments.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, background: s.color, boxShadow: `0 0 6px ${s.color}44` }} />
                <span style={{ fontSize: 12, color: th.textMuted, minWidth: 90 }}>{s.label}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</span>
                <span style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>({pct(s.value, computed.totalMachines)}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'machine' && (
        <BarChart data={computed.byMachine} color={colors.machine}
          maxVal={Math.max(...computed.byMachine.map(d => d.max), 1)} th={th} />
      )}

      {view === 'category' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 16 }}>
            {computed.byCategory.map((c, i) => (
              <GaugeDonut key={i} value={pct(c.value, c.max)} size={100} strokeWidth={10}
                color={[colors.blue, colors.green, colors.orange, colors.purple][i % 4]}
                trackColor={colors.track} label={c.label} sublabel={`${c.value}/${c.max}`} />
            ))}
          </div>
          <StackedBar th={th} segments={computed.byCategory.map((c, i) => ({
            value: c.value, color: [colors.blue, colors.green, colors.orange, colors.purple][i % 4], label: c.label,
          }))} />
        </>
      )}
    </div>
  );
}
