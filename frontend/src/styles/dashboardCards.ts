// frontend/src/styles/dashboardCards.ts

export function getCardStyle(th: Record<string, any>, isDark: boolean) {
  return {
    card: {
      background: isDark
        ? 'linear-gradient(145deg, rgba(22,24,34,0.95), rgba(15,17,23,0.98))'
        : th.bgCard,
      borderRadius: 16,
      border: `1px solid ${isDark ? 'rgba(0,229,160,0.06)' : th.border}`,
      padding: '20px 24px',
      boxShadow: isDark
        ? '0 4px 24px rgba(0,0,0,0.3), 0 0 40px rgba(0,229,160,0.02), inset 0 1px 0 rgba(255,255,255,0.03)'
        : '0 2px 12px rgba(0,0,0,0.06)',
      transition: 'all 0.3s ease',
    } as React.CSSProperties,

    cardHover: {
      boxShadow: isDark
        ? '0 8px 32px rgba(0,0,0,0.4), 0 0 60px rgba(0,229,160,0.04), inset 0 1px 0 rgba(255,255,255,0.05)'
        : '0 4px 20px rgba(0,0,0,0.1)',
    } as React.CSSProperties,

    cardTitle: {
      fontSize: 13,
      fontWeight: 600,
      color: th.textMuted,
      textTransform: 'uppercase' as const,
      letterSpacing: 1.2,
      marginBottom: 16,
    } as React.CSSProperties,

    cardValue: {
      fontSize: 32,
      fontWeight: 800,
      color: th.gold,
      lineHeight: 1,
      textShadow: isDark ? `0 0 20px ${th.gold}33` : 'none',
    } as React.CSSProperties,

    // Mini stat card (like the "15", "2", "1" counters in the photo)
    miniCard: {
      background: isDark
        ? 'linear-gradient(145deg, rgba(22,24,34,0.9), rgba(15,17,23,0.95))'
        : th.bgCard,
      borderRadius: 12,
      border: `1px solid ${isDark ? 'rgba(0,229,160,0.06)' : th.border}`,
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      boxShadow: isDark
        ? '0 2px 16px rgba(0,0,0,0.2), 0 0 20px rgba(0,229,160,0.015)'
        : '0 1px 8px rgba(0,0,0,0.04)',
    } as React.CSSProperties,

    miniIcon: (color: string) => ({
      width: 40,
      height: 40,
      borderRadius: 10,
      background: `${color}15`,
      border: `1px solid ${color}20`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 18,
      boxShadow: isDark ? `0 0 12px ${color}10` : 'none',
    }) as React.CSSProperties,

    // Progress bar (like "Project Tracker" in the photo)
    progressTrack: {
      height: 6,
      borderRadius: 3,
      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
      overflow: 'hidden',
    } as React.CSSProperties,

    progressFill: (color: string, percent: number) => ({
      width: `${percent}%`,
      height: '100%',
      borderRadius: 3,
      background: `linear-gradient(90deg, ${color}88, ${color})`,
      boxShadow: isDark ? `0 0 8px ${color}40` : 'none',
      transition: 'width 1s cubic-bezier(.4,0,.2,1)',
    }) as React.CSSProperties,

    // Grid layout matching the photo
    dashGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
      gap: 20,
    } as React.CSSProperties,

    dashGridWide: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr',
      gap: 20,
    } as React.CSSProperties,
  };
}
