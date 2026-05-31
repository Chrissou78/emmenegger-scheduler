// frontend/src/pages/stats/sections/PnlOverview.tsx

import { useMemo } from 'react';
import { useTheme } from '../../../contexts/themeContext';
import { getTranslations, type LangCode } from '../../../i18n';
import { pct } from '../helpers';
import { getNeonColors } from '../constants';
import { getStatsStyles } from '../styles';
import { GaugeDonut } from '../charts/GaugeDonut';
import type { StatsData } from '../types';

interface Props { data: StatsData; }

export function PnlOverview({ data }: Props) {
  const { isDark, th, lang } = useTheme();
  const t = getTranslations(lang as LangCode) as Record<string, any>;
  const colors = getNeonColors(isDark);
  const styles = getStatsStyles(isDark, th);

  const computed = useMemo(() => {
    const { periodJobs, periodWeeks, activeUsers, periodAbsences, tasks, machines, machineAllocs, periodReports, period } = data;
    const numWeeks = periodWeeks.length || 1;
    const daysPerWeek = period === 'day' ? 1 : 6;
    const slotsPerDay = 2;
    const totalSlots = activeUsers.length * numWeeks * daysPerWeek * slotsPerDay;
    const occupationRate = pct(periodJobs.length, totalSlots);
    const totalDays = activeUsers.length * numWeeks * daysPerWeek;
    const absenceRate = pct(periodAbsences.length, totalDays);
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(tk => (tk.status || '').toUpperCase() === 'COMPLETED').length;
    const taskRate = pct(completedTasks, totalTasks);
    const totalMachines = machines.length;
    const inUse = machines.filter(m => m.status === 'IN_USE').length;
    const machineRate = pct(inUse, totalMachines);
    const totalPlannedHours = periodReports.reduce((s, r) => s + (r.planned_hours || 0), 0);
    const totalActualHours = periodReports.reduce((s, r) => s + (r.actual_hours || 0), 0);
    const efficiencyRate = pct(totalActualHours, totalPlannedHours);

    return { occupationRate, absenceRate, taskRate, completedTasks, totalTasks, machineRate, inUse, totalMachines, efficiencyRate, totalActualHours, totalPlannedHours, filledSlots: periodJobs.length, totalSlots };
  }, [data]);

  return (
    <div style={styles.card({ marginBottom: 20 })}>
      <div style={styles.sectionTitle}><span>💰</span> {t.statsPnlOverview || t.pnl || 'P&L Overview'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 20 }}>
        {[
          { label: t.efficiency || 'Efficiency', value: computed.occupationRate, color: colors.green, sub: `${computed.filledSlots} ${t.slots || 'slots'}` },
          { label: t.taskCompletion || 'Task Completion', value: computed.taskRate, color: colors.success, sub: `${computed.completedTasks}/${computed.totalTasks}` },
          { label: t.attendance || 'Attendance', value: 100 - computed.absenceRate, color: colors.blue, sub: `${100 - computed.absenceRate}%` },
          { label: t.machineUtilization || 'Machine Util.', value: computed.machineRate, color: colors.machine, sub: `${computed.inUse}/${computed.totalMachines}` },
          { label: t.statsReportEfficiency || 'Report Efficiency', value: computed.efficiencyRate, color: colors.report, sub: `${computed.totalActualHours}h / ${computed.totalPlannedHours}h` },
        ].map((item, i) => (
          <div key={i} style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>
              {item.label}
            </div>
            <GaugeDonut value={item.value} size={100} strokeWidth={12} color={item.color} trackColor={colors.track}
              label={item.label} sublabel={item.sub} />
          </div>
        ))}
      </div>
    </div>
  );
}
