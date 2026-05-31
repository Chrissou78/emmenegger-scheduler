// frontend/src/pages/stats/sections/ReportCompletion.tsx

import { useState, useMemo } from 'react';
import { useTheme } from '../../../contexts/themeContext';
import { getTranslations, type LangCode } from '../../../i18n';
import { pct } from '../helpers';
import { getNeonColors } from '../constants';
import { getStatsStyles } from '../styles';
import { PieChart } from '../charts/PieChart';
import { BarChart } from '../charts/BarChart';
import type { StatsData } from '../types';

interface Props { data: StatsData; }

export function ReportCompletion({ data }: Props) {
  const { isDark, th, lang } = useTheme();
  const t = getTranslations(lang as LangCode) as Record<string, any>;
  const colors = getNeonColors(isDark);
  const styles = getStatsStyles(isDark, th);
  const [view, setView] = useState<'overview' | 'employee'>('overview');

  const computed = useMemo(() => {
    const { periodReports, activeUsers } = data;
    const total = periodReports.length;
    const completed = periodReports.filter(r => r.status === 'COMPLETED' || r.status === 'SUBMITTED').length;
    const planned = periodReports.filter(r => r.status === 'PLANNED').length;
    const inProgress = periodReports.filter(r => r.status === 'IN_PROGRESS').length;
    const completionRate = pct(completed, total);
    const totalPlannedHours = periodReports.reduce((s, r) => s + (r.planned_hours || 0), 0);
    const totalActualHours = periodReports.reduce((s, r) => s + (r.actual_hours || 0), 0);
    const efficiencyRate = pct(totalActualHours, totalPlannedHours);

    const byEmployee = activeUsers.map(u => {
      const uReports = periodReports.filter(r => r.user_id === u.id);
      const uCompleted = uReports.filter(r => r.status === 'COMPLETED' || r.status === 'SUBMITTED').length;
      return { label: `${u.first_name} ${u.last_name}`, value: uCompleted, max: Math.max(uReports.length, 1), totalReports: uReports.length };
    }).sort((a, b) => (b.value / (b.max || 1)) - (a.value / (a.max || 1)));

    const statusSegments = [
      { value: completed, color: '#00e5a0', label: t.completed || 'Completed' },
      { value: inProgress, color: '#00bcd4', label: t.statsInProgress || 'In Progress' },
      { value: planned, color: '#ffa726', label: t.statsPending || 'Planned' },
    ].filter(s => s.value > 0);

    return { total, completed, completionRate, efficiencyRate, totalPlannedHours, totalActualHours, byEmployee, statusSegments };
  }, [data.periodReports, data.activeUsers, t]);

  return (
    <div style={styles.card()}>
      <div style={styles.sectionTitle}>
        <span>📋</span> {t.statsReportCompletion || 'Report Completion'}
        <span style={{ flex: 1 }} />
        {([
          { key: 'overview' as const, label: t.statsOverview || 'Overview' },
          { key: 'employee' as const, label: t.statsByEmployee || 'Employee' },
        ]).map(v => (
          <button key={v.key} onClick={() => setView(v.key)} style={styles.subtab(view === v.key)}>{v.label}</button>
        ))}
      </div>

      {view === 'overview' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
          {computed.statusSegments.length > 0 ? (
            <>
              <PieChart segments={computed.statusSegments} size={150} strokeWidth={24} trackColor={colors.track}
                centerLabel={String(computed.total)} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {computed.statusSegments.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: s.color, boxShadow: `0 0 6px ${s.color}44` }} />
                    <span style={{ fontSize: 12, color: th.textMuted, minWidth: 90 }}>{s.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</span>
                    <span style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>({pct(s.value, computed.total)}%)</span>
                  </div>
                ))}
                <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: `${colors.report}08`, border: `1px solid ${colors.report}15` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: th.textMuted, marginBottom: 4 }}>{t.statsHoursEfficiency || 'Hours Efficiency'}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: colors.report }}>{computed.efficiencyRate}%</span>
                    <span style={{ fontSize: 11, color: th.textDim || th.textMuted }}>({computed.totalActualHours}h / {computed.totalPlannedHours}h)</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: th.textDim || th.textMuted, padding: 20, opacity: .6 }}>{t.statsNoData || 'No reports'}</div>
          )}
        </div>
      )}

      {view === 'employee' && (
        <BarChart data={computed.byEmployee.map(e => ({ label: e.label, value: e.value, max: e.max, color: colors.report }))}
          color={colors.report} maxVal={Math.max(...computed.byEmployee.map(d => d.max), 1)} th={th} />
      )}
    </div>
  );
}
