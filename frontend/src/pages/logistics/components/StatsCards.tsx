// frontend/src/pages/logistics/components/StatsCards.tsx
import React from 'react';
import type { CSSProperties } from 'react';

interface KpiProps {
  label: string;
  value: string;
  color?: string;
  cardStyle: CSSProperties;
}

export function KpiCard({ label, value, color = '#3b82f6', cardStyle }: KpiProps) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>{label}</div>
    </div>
  );
}

interface RowProps {
  items: { label: string; value: string; color?: string }[];
  cardStyle: CSSProperties;
}

export function KpiRow({ items, cardStyle }: RowProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
      {items.map((item, i) => (
        <KpiCard key={i} label={item.label} value={item.value} color={item.color} cardStyle={cardStyle} />
      ))}
    </div>
  );
}