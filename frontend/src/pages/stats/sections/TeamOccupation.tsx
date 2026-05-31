// frontend/src/pages/stats/sections/TeamOccupation.tsx

import { useState, useMemo } from 'react';
import { useTheme } from '../../../contexts/themeContext';
import { getTranslations, type LangCode } from '../../../i18n';
import { pct } from '../helpers';
import { getNeonColors } from '../constants';
import { getStatsStyles } from '../styles';
import { BarChart } from '../charts/BarChart';
import { GaugeDonut } from '../charts/GaugeDonut';
import { VerticalBarChart } from '../charts/VerticalBarChart';
import { HeatmapGrid } from '../charts/HeatmapGrid';
import { StackedBar } from '../charts/StackedBar';
import type { StatsData } from '../types';

interface Props {
  data: StatsData;
}

export function TeamOccupation({ data }: Props) {
  const { isDark, th, lang } = useTheme();
  const t = getTranslations(lang as LangCode) as Record<string, any>;
  const colors = getNeonColors(isDark);
  const styles = getStatsStyles(isDark, th);
  const [view, setView] = useState<'employee' | 'department' | 'day' | 'heatmap'>('employee');

  const { periodJobs, periodWeeks, activeUsers, period } = data;

  const computed = useMemo(() => {
    const numWeeks = periodWeeks.length || 1;
    const daysPerWeek = period === 'day' ? 1 : 6;
    const slotsPerDay = 2;
    const totalSlots = activeUsers.length * numWeeks * daysPerWeek * slotsPerDay;
    const filledSlots = periodJobs.length;
    const rate = pct(filledSlots, totalSlots);

    const byEmployee = activeUsers.map(u => {
      const userSlots = periodJobs.filter(j => j.user_id === u.id).length;
      const maxSlots = numWeeks * daysPerWeek * slotsPerDay;
      return { label: `${u.first_name} ${u.last_name}`, value: userSlots, max: maxSlots };
    }).sort((a, b) => (b.value / (b.max || 1)) - (a.value / (a.max || 1)));

    const depts = ['GARTEN_TIEFBAU', 'UNTERHALT'];
    const byDept = depts.map(dept => {
      const deptUsers = activeUsers.filter(u => (u.departments || []).flat().includes(dept));
      const deptJobs = periodJobs.filter(j => deptUsers.some(u => u.id === j.user_id)).length;
      const maxSlots = deptUsers.length * numWeeks * daysPerWeek * slotsPerDay;
      return { label: (t as any)[dept] || dept, value: deptJobs, max: maxSlots };
    });

    const dayNames = [t.mon || 'Mo', t.tue || 'Tu', t.wed || 'We', t.thu || 'Th', t.fri || 'Fr', t.sat || 'Sa'];
    const byDay = [1, 2, 3, 4, 5, 6].map((d, i) => {
      const dayJobs = periodJobs.filter(j => j.day_of_week === d).length;
      const maxDay = activeUsers.length * numWeeks * slotsPerDay;
      return { label: dayNames[i], value: dayJobs, max: maxDay };
    });

    const heatmapData = activeUsers.map(u => [1, 2, 3, 4, 5, 6].map(d =>
      periodJobs.filter(j => j.user_id === u.id && j.day_of_week === d).length
    ));
    const heatmapRows = activeUsers.map(u => `${u.first_name} ${u.last_name.charAt(0)}.`);

    const byDayGrouped = dayNames.map((dn, i) => {
      const day = i + 1;
      const bars = depts.map(dept => {
        const deptUsers = activeUsers.filter(u => (u.departments || []).flat().includes(dept));
        return {
          value: periodJobs.filter(j => j.day_of_week === day && deptUsers.some(u => u.id === j.user_id)).length,
          color: dept === 'GARTEN_TIEFBAU' ? '#00e5a0' : '#00bcd4',
          label: (t as any)[dept] || dept,
        };
      });
      return { label: dn, bars };
    });

    return { rate, totalSlots, filledSlots, byEmployee, byDept, byDay, heatmapData, heatmapRows, byDayGrouped, dayNames };
  }, [periodJobs, periodWeeks, activeUsers, t, period]);

  return (
    <div style={styles.card()}>
      <div style={styles.sectionTitle}>
        <span>👥</span> {t.statsTeamOccupation || t.teamOccupation || 'Team Occupation'}
        <span style={{ flex: 1 }} />
        {([
          { key: 'employee' as const, label: t.statsByEmployee || 'Employee' },
          { key: 'department' as const, label: t.statsByDepartment || 'Department' },
          { key: 'day' as const, label: t.statsByDay || 'Day' },
          { key: 'heatmap' as const, label: t.statsHeatmap || 'Heatmap' },
        ]).map(v => (
          <button key={v.key} onClick={() => setView(v.key)} style={styles.subtab(view === v.key)}>{v.label}</button>
        ))}
      </div>

      {view === 'employee' && (
        <BarChart data={computed.byEmployee} color={colors.occupation}
          maxVal={Math.max(...computed.byEmployee.map(d => d.max), 1)} th={th} />
      )}

      {view === 'department' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 20 }}>
            {computed.byDept.map((d, i) => (
              <GaugeDonut key={i} value={pct(d.value, d.max)} size={110} strokeWidth={12}
                color={i === 0 ? colors.green : colors.blue} trackColor={colors.track}
                label={d.label} sublabel={`${d.value}/${d.max} ${(t.slots || 'slots').toLowerCase()}`} />
            ))}
          </div>
          <StackedBar th={th} segments={computed.byDept.map((d, i) => ({
            value: d.value, color: i === 0 ? colors.green : colors.blue, label: d.label,
          }))} />
        </>
      )}

      {view === 'day' && <VerticalBarChart th={th} groups={computed.byDayGrouped} />}

      {view === 'heatmap' && computed.heatmapData.length > 0 && (
        <HeatmapGrid data={computed.heatmapData} rowLabels={computed.heatmapRows}
          colLabels={computed.dayNames} maxVal={Math.max(...computed.heatmapData.flat(), 1)}
          baseColor={colors.occupation} th={th} />
      )}
    </div>
  );
}
