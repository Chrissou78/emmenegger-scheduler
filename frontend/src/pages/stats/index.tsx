// frontend/src/pages/stats/index.tsx

import { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/themeContext';
import { useAuthStore } from '../../contexts/authStore';
import { getTranslations, type LangCode } from '../../i18n';
import { getStatsViewMode, isOperational } from '../../../../shared/constants/roles';
import { getNeonColors } from './constants';
import { getStatsStyles } from './styles';
import { useStatsData } from './hooks/useStatsData';
import { pct } from './helpers';
import { GaugeDonut } from './charts/GaugeDonut';
import type { Period, StatsMode } from './types';

// Sections
import { IndividualView } from './sections/IndividualView';
import { TeamOccupation } from './sections/TeamOccupation';
import { TaskDistribution } from './sections/TaskDistribution';
import { AbsenceBreakdown } from './sections/AbsenceBreakdown';
import { MachineUsage } from './sections/MachineUsage';
import { ReportCompletion } from './sections/ReportCompletion';
import { PnlOverview } from './sections/PnlOverview';
import { Rankings } from './sections/Rankings';
import { WeeklyTrend } from './sections/WeeklyTrend';

export function StatsPage() {
  const { isDark, th, lang } = useTheme();
  const { user: rawUser } = useAuthStore();
  const user = rawUser as (typeof rawUser & { departments?: string[] });
  const t = getTranslations(lang as LangCode) as Record<string, any>;
  const colors = getNeonColors(isDark);
  const styles = getStatsStyles(isDark, th);

  const [period, setPeriod] = useState<Period>('month');
  const data = useStatsData(period);

  const statsMode = data.statsMode;

  const statsTitle = useMemo(() => {
    switch (statsMode) {
      case 'global': return t.statsGlobal || 'Company Overview';
      case 'perimeter': return t.statsPerimeter || 'Department Overview';
      case 'team': return t.statsTeam || 'Team Performance';
      case 'individual': return t.statsIndividual || 'My Performance';
    }
  }, [statsMode, t]);

  const statsBadgeColor = useMemo(() => {
    switch (statsMode) {
      case 'global': return colors.occupation;
      case 'perimeter': return colors.blue;
      case 'team': return colors.green;
      case 'individual': return colors.purple;
    }
  }, [statsMode, colors]);

  /* CSV Export */
  const exportCSV = () => {
    const rows = [
      ['Metric', 'Value', 'Total', 'Percentage'],
      [t.teamOccupation || 'Team', String(data.periodJobs.length), '-', '-'],
      [t.absenceRate || 'Absences', String(data.periodAbsences.length), '-', '-'],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stats-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* KPI computations for the header gauges */
  const kpis = useMemo(() => {
    const numWeeks = data.periodWeeks.length || 1;
    const daysPerWeek = data.period === 'day' ? 1 : 6;
    const slotsPerDay = 2;
    const totalSlots = data.activeUsers.length * numWeeks * daysPerWeek * slotsPerDay;
    const occupationRate = pct(data.periodJobs.length, totalSlots);
    const totalDays = data.activeUsers.length * numWeeks * daysPerWeek;
    const absRate = pct(data.periodAbsences.length, totalDays);
    const totalTasks = data.tasks.length;
    const completedTasks = data.tasks.filter(tk => (tk.status || '').toUpperCase() === 'COMPLETED').length;
    const successRate = pct(completedTasks, totalTasks);
    const totalMachines = data.machines.length;
    const inUse = data.machines.filter(m => m.status === 'IN_USE').length;
    const machineRate = pct(inUse, totalMachines);
    const totalReports = data.periodReports.length;
    const completedReports = data.periodReports.filter(r => r.status === 'COMPLETED' || r.status === 'SUBMITTED').length;
    const reportRate = pct(completedReports, totalReports);

    return {
      occupationRate, filledSlots: data.periodJobs.length, totalSlots,
      successRate, completedTasks, totalTasks,
      absRate, absentDays: data.periodAbsences.length, totalDays,
      machineRate, inUse, totalMachines,
      reportRate, completedReports, totalReports,
    };
  }, [data]);

  /* Loading */
  if (data.loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', color: th.textMuted, gap: 16 }}>
        <div style={{
          width: 48, height: 48,
          border: `4px solid ${colors.track}`,
          borderTopColor: colors.occupation,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          boxShadow: `0 0 16px ${colors.occupation}33`,
        }} />
        <span style={{ fontSize: 14, letterSpacing: .5 }}>{t.loading || 'Loading...'}</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1280, margin: '0 auto', color: th.text, fontFamily: "'Inter','Segoe UI',sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{
            fontSize: 24, fontWeight: 300, letterSpacing: 3, margin: 0,
            background: 'linear-gradient(135deg,#00e5a0,#00bcd4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            {t.title || 'Statistics'}
          </h1>
          <span style={{
            padding: '4px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
            background: `${statsBadgeColor}18`, color: statsBadgeColor,
            letterSpacing: .5, border: `1px solid ${statsBadgeColor}25`,
          }}>
            {statsTitle}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['day', 'week', 'month', 'quarter', 'year'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={styles.periodBtn(period === p)}>
              {p === 'day' ? (t.day || 'Day') : (t as any)[p] || p}
            </button>
          ))}
          <button onClick={exportCSV} style={{
            ...styles.periodBtn(false), marginLeft: 8,
            border: `1px solid ${isDark ? 'rgba(0,229,160,0.2)' : 'rgba(0,229,160,0.3)'}`,
          }}>
            ⬇ {t.export || 'Export'}
          </button>
        </div>
      </div>

      {/* Individual View */}
      {statsMode === 'individual' && <IndividualView data={data} />}

      {/* Team / Perimeter / Global Views */}
      {statsMode !== 'individual' && (
        <>
          {/* KPI Gauges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBottom: 28 }}>
            <div style={styles.kpiCard()} onMouseEnter={e => styles.kpiHoverIn(e, 'rgba(0,229,160,0.15)')} onMouseLeave={styles.kpiHoverOut}>
              <GaugeDonut value={kpis.occupationRate} size={80} strokeWidth={10} color={colors.occupation} trackColor={colors.track} label="" innerLabel={t.slots || 'Slots'} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{t.teamOccupation || 'Team Occupation'}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: colors.occupation }}>{kpis.occupationRate}%</div>
                <div style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>{kpis.filledSlots} / {kpis.totalSlots}</div>
              </div>
            </div>

            {(statsMode === 'global' || statsMode === 'perimeter') && (
              <div style={styles.kpiCard()} onMouseEnter={e => styles.kpiHoverIn(e, 'rgba(0,229,160,0.12)')} onMouseLeave={styles.kpiHoverOut}>
                <GaugeDonut value={kpis.successRate} size={80} strokeWidth={10} color={colors.success} trackColor={colors.track} label="" innerLabel={t.tasks || 'Tasks'} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{t.successRate || 'Success Rate'}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: colors.success }}>{kpis.successRate}%</div>
                  <div style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>{kpis.completedTasks} / {kpis.totalTasks}</div>
                </div>
              </div>
            )}

            <div style={styles.kpiCard()} onMouseEnter={e => styles.kpiHoverIn(e, 'rgba(255,107,157,0.12)')} onMouseLeave={styles.kpiHoverOut}>
              <GaugeDonut value={kpis.absRate} size={80} strokeWidth={10} color={colors.absence} trackColor={colors.track} label="" innerLabel={t.rate || 'Rate'} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{t.absenceRate || 'Absence Rate'}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: colors.absence }}>{kpis.absRate}%</div>
                <div style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>{kpis.absentDays} / {kpis.totalDays}</div>
              </div>
            </div>

            {(statsMode === 'global' || (statsMode === 'perimeter' && isOperational((user?.departments ?? []).flat() as string[]))) && (
              <div style={styles.kpiCard()} onMouseEnter={e => styles.kpiHoverIn(e, 'rgba(0,188,212,0.15)')} onMouseLeave={styles.kpiHoverOut}>
                <GaugeDonut value={kpis.machineRate} size={80} strokeWidth={10} color={colors.machine} trackColor={colors.track} label="" innerLabel={t.rate || 'Rate'} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{t.machineOccupation || 'Machine Usage'}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: colors.machine }}>{kpis.machineRate}%</div>
                  <div style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>{kpis.inUse} / {kpis.totalMachines}</div>
                </div>
              </div>
            )}

            <div style={styles.kpiCard()} onMouseEnter={e => styles.kpiHoverIn(e, 'rgba(179,136,255,0.15)')} onMouseLeave={styles.kpiHoverOut}>
              <GaugeDonut value={kpis.reportRate} size={80} strokeWidth={10} color={colors.report} trackColor={colors.track} label="" innerLabel={t.reports || 'Reports'} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{t.statsReportCompletion || 'Report Completion'}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: colors.report }}>{kpis.reportRate}%</div>
                <div style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>{kpis.completedReports} / {kpis.totalReports}</div>
              </div>
            </div>
          </div>

          {/* CEO P&L */}
          {statsMode === 'global' && <PnlOverview data={data} />}

          {/* Rankings (Manager+) */}
          {(statsMode === 'team' || statsMode === 'perimeter' || statsMode === 'global') && (
            <Rankings data={data} />
          )}

          {/* Weekly Trends */}
          <WeeklyTrend data={data} />

          {/* Detail Sections */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(480px,1fr))', gap: 20 }}>
            <TeamOccupation data={data} />

            {(statsMode === 'global' || statsMode === 'perimeter') && (
              <TaskDistribution data={data} />
            )}

            <AbsenceBreakdown data={data} />
            <ReportCompletion data={data} />

            {(statsMode === 'global' || statsMode === 'perimeter' || statsMode === 'team') && (
              <MachineUsage data={data} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
