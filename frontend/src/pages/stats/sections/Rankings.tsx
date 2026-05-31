// frontend/src/pages/stats/sections/Rankings.tsx

import { useMemo } from 'react';
import { useTheme } from '../../../contexts/themeContext';
import { getTranslations, type LangCode } from '../../../i18n';
import { pct } from '../helpers';
import { getNeonColors } from '../constants';
import { getStatsStyles } from '../styles';
import { RankingList } from '../charts/RankingList';
import { getViewTier } from '../../../../../shared/constants/roles';
import type { StatsData } from '../types';

interface Props { data: StatsData; }

export function Rankings({ data }: Props) {
  const { isDark, th, lang } = useTheme();
  const t = getTranslations(lang as LangCode) as Record<string, any>;
  const colors = getNeonColors(isDark);
  const styles = getStatsStyles(isDark, th);

  const { periodJobs, periodWeeks, activeUsers, period, statsMode, allUsers, jobs, absences, timeReports, periodWeekIds, periodDates } = data;

  const byEmployee = useMemo(() => {
    const numWeeks = periodWeeks.length || 1;
    const daysPerWeek = period === 'day' ? 1 : 6;
    const slotsPerDay = 2;
    return activeUsers.map(u => {
      const userSlots = periodJobs.filter(j => j.user_id === u.id).length;
      const maxSlots = numWeeks * daysPerWeek * slotsPerDay;
      return { label: `${u.first_name} ${u.last_name}`, value: userSlots, max: maxSlots };
    }).sort((a, b) => (b.value / (b.max || 1)) - (a.value / (a.max || 1)));
  }, [periodJobs, periodWeeks, activeUsers, period]);

  const top3 = byEmployee.slice(0, 3);
  const flop3 = [...byEmployee].sort((a, b) => (a.value / (a.max || 1)) - (b.value / (b.max || 1))).slice(0, 3);

  // Team comparison
  const teamComparison = useMemo(() => {
    if (statsMode !== 'global' && statsMode !== 'perimeter') return null;
    const teamLeaders = allUsers.filter(u => getViewTier(u.role) === 'teamleader');
    const numWeeks = periodWeeks.length || 1;
    const daysPerWeek = period === 'day' ? 1 : 6;
    const slotsPerDay = 2;

    return teamLeaders.map(tl => {
      const teamMembers = allUsers.filter(u => u.team_leader_id === tl.id || u.id === tl.id);
      const activeTM = teamMembers.filter(u => u.is_active !== false);
      const teamJobs = jobs.filter(j => periodWeekIds.has(j.week_id) && teamMembers.some(u => u.id === j.user_id));
      const maxSlots = activeTM.length * numWeeks * daysPerWeek * slotsPerDay;
      const teamAbsences = absences.filter(a => {
        if (!teamMembers.some(u => u.id === a.user_id)) return false;
        if (a.week_id) return periodWeekIds.has(a.week_id);
        if (a.date) return a.date >= periodDates.startDate && a.date <= periodDates.endDate;
        return false;
      });
      const maxDays = activeTM.length * numWeeks * daysPerWeek;
      const teamReports = timeReports.filter(tr => teamMembers.some(u => u.id === tr.user_id));
      const completedReports = teamReports.filter(r => r.status === 'COMPLETED' || r.status === 'SUBMITTED').length;

      return {
        id: tl.id,
        label: `${tl.first_name} ${tl.last_name}`,
        memberCount: activeTM.length,
        occupationRate: pct(teamJobs.length, maxSlots),
        absenceRate: pct(teamAbsences.length, maxDays),
        reportCompletion: pct(completedReports, teamReports.length),
      };
    }).sort((a, b) => b.occupationRate - a.occupationRate);
  }, [allUsers, jobs, absences, timeReports, periodWeeks, periodWeekIds, periodDates, statsMode, period]);

  return (
    <>
      {/* Top3 / Flop3 */}
      {byEmployee.length >= 3 && (
        <div style={styles.card({ marginBottom: 20 })}>
          <div style={styles.sectionTitle}><span>🏆</span> {t.statsRankings || 'Rankings'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 28 }}>
            <RankingList items={top3} title={t.statsTop3Workers || 'Top 3 Workers'} icon="🥇" color={colors.green} th={th} />
            <RankingList items={flop3} title={t.statsFlop3Workers || 'Needs Improvement'} icon="📉" color={colors.red} isFlop th={th} />
          </div>
        </div>
      )}

      {/* Team vs Team */}
      {teamComparison && teamComparison.length > 1 && (
        <div style={styles.card({ marginBottom: 20 })}>
          <div style={styles.sectionTitle}><span>⚔️</span> {t.statsTeamVsTeam || 'Team vs Team'}</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${isDark ? 'rgba(0,229,160,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
                  {[t.teamLeader || 'Team Leader', t.statsMembers || 'Members', t.statsOccupation || 'Occupation', t.absences || 'Absences', t.reports || 'Reports'].map(h => (
                    <th key={h} style={{ textAlign: h === (t.teamLeader || 'Team Leader') ? 'left' : 'center', padding: '10px 8px', fontWeight: 700, color: th.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamComparison.map((team, i) => (
                  <tr key={team.id} style={{
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'}`,
                    background: i === 0 ? `${colors.green}06` : 'transparent',
                  }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: th.text }}>
                      {i < 3 && <span style={{ marginRight: 6 }}>{['🥇', '🥈', '🥉'][i]}</span>}
                      {team.label}
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 8px', color: th.textMuted }}>{team.memberCount}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontWeight: 700, fontSize: 12, background: `${colors.green}15`, color: colors.green }}>{team.occupationRate}%</span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontWeight: 700, fontSize: 12, background: `${colors.red}15`, color: colors.red }}>{team.absenceRate}%</span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontWeight: 700, fontSize: 12, background: `${colors.report}15`, color: colors.report }}>{team.reportCompletion}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
