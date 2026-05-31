// frontend/src/pages/stats/sections/AbsenceBreakdown.tsx

import { useState, useMemo } from 'react';
import { useTheme } from '../../../contexts/themeContext';
import { getTranslations, type LangCode } from '../../../i18n';
import { pct } from '../helpers';
import { ABS_LABELS, ABS_COLORS, getNeonColors } from '../constants';
import { getStatsStyles } from '../styles';
import { PieChart } from '../charts/PieChart';
import { BarChart } from '../charts/BarChart';
import { HeatmapGrid } from '../charts/HeatmapGrid';
import type { StatsData } from '../types';

interface Props {
  data: StatsData;
}

export function AbsenceBreakdown({ data }: Props) {
  const { isDark, th, lang } = useTheme();
  const t = getTranslations(lang as LangCode) as Record<string, any>;
  const colors = getNeonColors(isDark);
  const styles = getStatsStyles(isDark, th);
  const [view, setView] = useState<'type' | 'employee' | 'heatmap'>('type');

  const { periodAbsences, periodWeeks, activeUsers, period } = data;

  const computed = useMemo(() => {
    const numWeeks = periodWeeks.length || 1;
    const daysPerWeek = period === 'day' ? 1 : 6;
    const totalDays = activeUsers.length * numWeeks * daysPerWeek;
    const absentDays = periodAbsences.length;
    const rate = pct(absentDays, totalDays);

    const byEmployee = activeUsers.map(u => {
      const uAbs = periodAbsences.filter(a => a.user_id === u.id).length;
      const maxDays = numWeeks * daysPerWeek;
      return { label: `${u.first_name} ${u.last_name}`, value: uAbs, max: maxDays };
    }).sort((a, b) => (b.value / (b.max || 1)) - (a.value / (a.max || 1)));

    const absTypes: Record<string, number> = {};
    periodAbsences.forEach(a => {
      const key = String(a.type || a.absence_code || '6');
      absTypes[key] = (absTypes[key] || 0) + 1;
    });

    const typeSegments = Object.entries(absTypes).map(([type, count]) => ({
      value: count,
      color: ABS_COLORS[type] || '#999',
      label: (ABS_LABELS[lang || 'de'] || ABS_LABELS.de)[type] || `Type ${type}`,
    }));

    const dayNames = [t.mon || 'Mo', t.tue || 'Tu', t.wed || 'We', t.thu || 'Th', t.fri || 'Fr', t.sat || 'Sa'];
    const byDayEmployee = activeUsers.map(u => [1, 2, 3, 4, 5, 6].map(d =>
      periodAbsences.filter(a => a.user_id === u.id && a.day_of_week === d).length
    ));
    const heatmapRows = activeUsers.map(u => `${u.first_name} ${u.last_name.charAt(0)}.`);

    return { rate, totalDays, absentDays, byEmployee, typeSegments, byDayEmployee, heatmapRows, dayNames };
  }, [periodAbsences, periodWeeks, activeUsers, lang, t, period]);

  return (
    <div style={styles.card()}>
      <div style={styles.sectionTitle}>
        <span>🏥</span> {t.statsAbsenceBreakdown || t.absenceBreakdown || 'Absence Breakdown'}
        <span style={{ flex: 1 }} />
        {([
          { key: 'type' as const, label: t.statsByType || 'Type' },
          { key: 'employee' as const, label: t.statsByEmployee || 'Employee' },
          { key: 'heatmap' as const, label: t.statsHeatmap || 'Heatmap' },
        ]).map(v => (
          <button key={v.key} onClick={() => setView(v.key)} style={styles.subtab(view === v.key)}>{v.label}</button>
        ))}
      </div>

      {view === 'type' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
          {computed.typeSegments.length > 0 ? (
            <>
              <PieChart segments={computed.typeSegments} size={150} strokeWidth={24} trackColor={colors.track}
                centerLabel={String(computed.absentDays)} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {computed.typeSegments.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: s.color, boxShadow: `0 0 6px ${s.color}44` }} />
                    <span style={{ fontSize: 12, color: th.textMuted, minWidth: 90 }}>{s.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</span>
                    <span style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>({pct(s.value, computed.absentDays)}%)</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: th.textDim || th.textMuted, padding: 20, opacity: .6 }}>{t.statsNoData || t.noData || 'No data'}</div>
          )}
        </div>
      )}

      {view === 'employee' && (
        <BarChart data={computed.byEmployee} color={colors.absence}
          maxVal={Math.max(...computed.byEmployee.map(d => d.max), 1)} th={th} />
      )}

      {view === 'heatmap' && computed.byDayEmployee.length > 0 && (
        <HeatmapGrid data={computed.byDayEmployee} rowLabels={computed.heatmapRows}
          colLabels={computed.dayNames} maxVal={Math.max(...computed.byDayEmployee.flat(), 1)}
          baseColor={colors.absence} th={th} />
      )}
    </div>
  );
}
