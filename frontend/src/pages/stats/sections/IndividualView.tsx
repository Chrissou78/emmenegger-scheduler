// frontend/src/pages/stats/sections/IndividualView.tsx

import { useMemo } from 'react';
import { useTheme } from '../../../contexts/themeContext';
import { useAuthStore } from '../../../contexts/authStore';
import { getTranslations, type LangCode } from '../../../i18n';
import { pct } from '../helpers';
import { ABS_LABELS, ABS_COLORS, getNeonColors } from '../constants';
import { getStatsStyles } from '../styles';
import { GaugeDonut } from '../charts/GaugeDonut';
import { PieChart } from '../charts/PieChart';
import { BarChart } from '../charts/BarChart';
import { AreaSparkline } from '../charts/AreaSparkline';
import type { StatsData } from '../types';

interface Props { data: StatsData; }

export function IndividualView({ data }: Props) {
  const { isDark, th, lang } = useTheme();
  const { user: rawUser } = useAuthStore();
  const user = rawUser as (typeof rawUser & { team_leader_id?: string | null });
  const t = getTranslations(lang as LangCode) as Record<string, any>;
  const colors = getNeonColors(isDark);
  const styles = getStatsStyles(isDark, th);

  const { periodJobs, periodAbsences, periodReports, periodWeeks, allUsers, jobs, periodWeekIds, period } = data;

  const trendLabels = periodWeeks.map(w => `${t.weekNum || 'W'}${w.week_number}`);

  const stats = useMemo(() => {
    const myId = user?.id;
    if (!myId) return null;

    const myJobs = periodJobs.filter(j => j.user_id === myId);
    const myAbsences = periodAbsences.filter(a => a.user_id === myId);
    const myReports = periodReports.filter(r => r.user_id === myId);
    const numWeeks = periodWeeks.length || 1;
    const daysPerWeek = period === 'day' ? 1 : 6;
    const slotsPerDay = 2;
    const maxSlots = numWeeks * daysPerWeek * slotsPerDay;
    const maxDays = numWeeks * daysPerWeek;
    const occupationRate = pct(myJobs.length, maxSlots);
    const absenceRate = pct(myAbsences.length, maxDays);
    const completedReports = myReports.filter(r => r.status === 'COMPLETED' || r.status === 'SUBMITTED').length;
    const reportCompletionRate = pct(completedReports, myReports.length);

    const dayNames = [t.mon || 'Mo', t.tue || 'Tu', t.wed || 'We', t.thu || 'Th', t.fri || 'Fr', t.sat || 'Sa'];
    const byDay = [1, 2, 3, 4, 5, 6].map((d, i) => ({
      label: dayNames[i], value: myJobs.filter(j => j.day_of_week === d).length, max: numWeeks * slotsPerDay,
    }));

    const allActiveUsers = allUsers.filter(u => u.is_active !== false);
    const rankings = allActiveUsers.map(u => {
      const uJobs = jobs.filter(j => periodWeekIds.has(j.week_id) && j.user_id === u.id).length;
      const uMax = numWeeks * 6 * slotsPerDay;
      return { userId: u.id, rate: pct(uJobs, uMax) };
    }).sort((a, b) => b.rate - a.rate);

    const myRank = rankings.findIndex(r => r.userId === myId) + 1;
    const totalPeers = rankings.length;

    const myTeamMembers = allUsers.filter(u => u.team_leader_id === user?.team_leader_id && u.is_active !== false);
    const teamAvgRate = myTeamMembers.length > 0
      ? Math.round(myTeamMembers.reduce((sum, u) => {
          const uJobs = jobs.filter(j => periodWeekIds.has(j.week_id) && j.user_id === u.id).length;
          const uMax = numWeeks * 6 * slotsPerDay;
          return sum + pct(uJobs, uMax);
        }, 0) / myTeamMembers.length)
      : 0;

    const myTrend = periodWeeks.map(w => {
      const wJobs = myJobs.filter(j => j.week_id === w.id).length;
      const wMax = daysPerWeek * slotsPerDay;
      return pct(wJobs, wMax);
    });

    const absTypes: Record<string, number> = {};
    myAbsences.forEach(a => { const k = String(a.type || a.absence_code || '6'); absTypes[k] = (absTypes[k] || 0) + 1; });
    const myAbsenceTypes = Object.entries(absTypes).map(([type, count]) => ({
      value: count, color: ABS_COLORS[type] || '#999',
      label: (ABS_LABELS[lang || 'de'] || ABS_LABELS.de)[type] || `Type ${type}`,
    }));

    return {
      occupationRate, absenceRate, totalSlots: myJobs.length, maxSlots,
      totalAbsences: myAbsences.length, maxDays, byDay, myRank, totalPeers,
      teamAvgRate, myTrend, reportCompletionRate, totalReports: myReports.length,
      completedReports, myAbsenceTypes,
    };
  }, [user?.id, user?.team_leader_id, periodJobs, periodAbsences, periodReports, periodWeeks, allUsers, jobs, periodWeekIds, lang, t, period]);

  if (!stats) return null;

  return (
    <>
      {/* Personal KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBottom: 28 }}>
        <div style={styles.kpiCard()} onMouseEnter={e => styles.kpiHoverIn(e, 'rgba(0,229,160,0.15)')} onMouseLeave={styles.kpiHoverOut}>
          <GaugeDonut value={stats.occupationRate} size={80} strokeWidth={10} color={colors.occupation} trackColor={colors.track} label="" innerLabel={t.slots || 'Slots'} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{t.myOccupation || 'My Occupation'}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: colors.occupation }}>{stats.occupationRate}%</div>
            <div style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>{stats.totalSlots} / {stats.maxSlots}</div>
          </div>
        </div>

        <div style={styles.kpiCard()} onMouseEnter={e => styles.kpiHoverIn(e, 'rgba(255,107,157,0.15)')} onMouseLeave={styles.kpiHoverOut}>
          <GaugeDonut value={stats.absenceRate} size={80} strokeWidth={10} color={colors.absence} trackColor={colors.track} label="" innerLabel={t.rate || 'Rate'} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{t.myAbsences || 'My Absences'}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: colors.absence }}>{stats.absenceRate}%</div>
            <div style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>{stats.totalAbsences} / {stats.maxDays}</div>
          </div>
        </div>

        <div style={styles.kpiCard()} onMouseEnter={e => styles.kpiHoverIn(e, 'rgba(124,77,255,0.15)')} onMouseLeave={styles.kpiHoverOut}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: `linear-gradient(135deg,${colors.purple}18,${colors.purple}08)`,
            border: `1px solid ${colors.purple}25`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: colors.purple }}>#{stats.myRank}</div>
            <div style={{ fontSize: 9, color: colors.purple, opacity: .6 }}>/ {stats.totalPeers}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{t.ranking || 'Ranking'}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.purple }}>{t.comparedToOthers || 'Compared to Others'}</div>
            <div style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>
              {pct(stats.totalPeers - stats.myRank, stats.totalPeers)}% {t.aboveAverage || 'above'}
            </div>
          </div>
        </div>

        <div style={styles.kpiCard()} onMouseEnter={e => styles.kpiHoverIn(e, 'rgba(179,136,255,0.15)')} onMouseLeave={styles.kpiHoverOut}>
          <GaugeDonut value={stats.reportCompletionRate} size={80} strokeWidth={10} color={colors.report} trackColor={colors.track} label="" innerLabel={t.reports || 'Reports'} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{t.statsReportCompletion || 'Report Completion'}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: colors.report }}>{stats.reportCompletionRate}%</div>
            <div style={{ fontSize: 11, color: th.textDim || th.textMuted, opacity: .6 }}>{stats.completedReports} / {stats.totalReports}</div>
          </div>
        </div>
      </div>

      {/* Team Average Comparison */}
      {stats.teamAvgRate > 0 && (
        <div style={styles.card({ marginBottom: 20 })}>
          <div style={styles.sectionTitle}><span>📊</span> {t.statsVsTeamAverage || 'You vs Team Average'}</div>
          <div style={{ display: 'flex', gap: 40, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <GaugeDonut value={stats.occupationRate} size={100} strokeWidth={12} color={colors.occupation} trackColor={colors.track}
              label={t.statsYou || 'You'} sublabel={`${stats.occupationRate}%`} />
            <div style={{ fontSize: 24, fontWeight: 300, color: th.textMuted }}>vs</div>
            <GaugeDonut value={stats.teamAvgRate} size={100} strokeWidth={12} color={colors.blue} trackColor={colors.track}
              label={t.statsTeamAvg || 'Team Avg'} sublabel={`${stats.teamAvgRate}%`} />
            <div style={{
              padding: '12px 24px', borderRadius: 12,
              background: stats.occupationRate >= stats.teamAvgRate ? `${colors.green}12` : `${colors.red}12`,
              border: `1px solid ${stats.occupationRate >= stats.teamAvgRate ? colors.green : colors.red}25`,
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: stats.occupationRate >= stats.teamAvgRate ? colors.green : colors.red }}>
                {stats.occupationRate >= stats.teamAvgRate ? '+' : ''}{stats.occupationRate - stats.teamAvgRate}%
              </div>
              <div style={{ fontSize: 10, color: th.textMuted }}>
                {stats.occupationRate >= stats.teamAvgRate ? (t.statsAboveTeamAvg || 'Above team average') : (t.statsBelowTeamAvg || 'Below team average')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Personal charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(380px,1fr))', gap: 20, marginBottom: 28 }}>
        <div style={styles.card()}>
          <div style={styles.sectionTitle}><span>📊</span> {t.dailyBreakdown || 'Daily Breakdown'}</div>
          <BarChart data={stats.byDay} color={colors.occupation} maxVal={Math.max(...stats.byDay.map(d => d.max), 1)} th={th} />
        </div>

        <div style={styles.card()}>
          <div style={styles.sectionTitle}><span>🏥</span> {t.myAbsences || 'My Absences'}</div>
          {stats.myAbsenceTypes.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
              <PieChart segments={stats.myAbsenceTypes} size={120} strokeWidth={20} trackColor={colors.track}
                centerLabel={String(stats.totalAbsences)} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {stats.myAbsenceTypes.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, boxShadow: `0 0 6px ${s.color}44` }} />
                    <span style={{ fontSize: 11, color: th.textMuted }}>{s.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: th.textDim || th.textMuted, fontSize: 13, opacity: .6 }}>{t.statsNoData || 'No absences'}</div>
          )}
        </div>
      </div>

      {/* Weekly trend */}
      {periodWeeks.length > 1 && (
        <div style={styles.card({ marginBottom: 20 })}>
          <div style={styles.sectionTitle}><span>📈</span> {t.myTrend || 'My Weekly Trend'}</div>
          <AreaSparkline data={stats.myTrend} color={colors.occupation} width={500} height={70} labels={trendLabels} />
        </div>
      )}
    </>
  );
}
