// frontend/src/pages/stats/sections/WeeklyTrend.tsx

import { useMemo } from 'react';
import { useTheme } from '../../../contexts/themeContext';
import { getTranslations, type LangCode } from '../../../i18n';
import { pct } from '../helpers';
import { getNeonColors } from '../constants';
import { getStatsStyles } from '../styles';
import { AreaSparkline } from '../charts/AreaSparkline';
import type { StatsData } from '../types';

interface Props { data: StatsData; }

export function WeeklyTrend({ data }: Props) {
  const { isDark, th, lang } = useTheme();
  const t = getTranslations(lang as LangCode) as Record<string, any>;
  const colors = getNeonColors(isDark);
  const styles = getStatsStyles(isDark, th);

  const { periodJobs, periodAbsences, periodWeeks, activeUsers, period } = data;

  const trendLabels = periodWeeks.map(w => `${t.weekNum || 'W'}${w.week_number}`);

  const occupationTrend = useMemo(() => {
    const daysPerWeek = period === 'day' ? 1 : 6;
    const slotsPerDay = 2;
    return periodWeeks.map(w => {
      const wJobs = periodJobs.filter(j => j.week_id === w.id).length;
      const wMax = activeUsers.length * daysPerWeek * slotsPerDay;
      return pct(wJobs, wMax);
    });
  }, [periodJobs, periodWeeks, activeUsers, period]);

  const absenceTrend = useMemo(() => {
    const daysPerWeek = period === 'day' ? 1 : 6;
    return periodWeeks.map(w => {
      const wAbs = periodAbsences.filter(a => a.week_id === w.id).length;
      const wMax = activeUsers.length * daysPerWeek;
      return pct(wAbs, wMax);
    });
  }, [periodAbsences, periodWeeks, activeUsers, period]);

  if (periodWeeks.length <= 1) return null;

  return (
    <div style={styles.card({ marginBottom: 20 })}>
      <div style={styles.sectionTitle}><span>📈</span> {t.statsWeeklyTrend || t.weeklyTrend || 'Weekly Trend'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: th.textMuted, marginBottom: 8 }}>{t.teamOccupation || 'Team Occupation'}</div>
          <AreaSparkline data={occupationTrend} color={colors.occupation} width={260} height={60} labels={trendLabels} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: th.textMuted, marginBottom: 8 }}>{t.absenceRate || 'Absence Rate'}</div>
          <AreaSparkline data={absenceTrend} color={colors.absence} width={260} height={60} labels={trendLabels} />
        </div>
      </div>
    </div>
  );
}
