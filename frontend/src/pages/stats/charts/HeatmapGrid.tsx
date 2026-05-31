// frontend/src/pages/stats/charts/HeatmapGrid.tsx

import React from 'react';
import { clamp } from '../helpers';

interface Props {
  data: number[][];
  rowLabels: string[];
  colLabels: string[];
  maxVal: number;
  baseColor: string;
  th: Record<string, string>;
}

export function HeatmapGrid({ data, rowLabels, colLabels, maxVal, baseColor, th }: Props) {
  const cellSize = 34;
  const gap = 3;

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-grid', gridTemplateColumns: `80px repeat(${colLabels.length},${cellSize}px)`, gap, alignItems: 'center' }}>
        <div />
        {colLabels.map((c, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: th.textMuted }}>{c}</div>
        ))}
        {rowLabels.map((row, ri) => (
          <React.Fragment key={`r${ri}`}>
            <div style={{ fontSize: 11, fontWeight: 500, color: th.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row}>{row}</div>
            {(data[ri] || []).map((val, ci) => {
              const intensity = maxVal > 0 ? clamp(val / maxVal, 0, 1) : 0;
              return (
                <div key={`${ri}-${ci}`} style={{
                  width: cellSize, height: cellSize, borderRadius: 8,
                  background: val > 0 ? `${baseColor}${Math.round(intensity * 200 + 55).toString(16).padStart(2, '0')}` : `${th.borderFaint || th.border}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: intensity > 0.5 ? '#fff' : th.textDim || th.textMuted,
                  transition: 'background .4s ease,box-shadow .3s ease', cursor: 'default',
                  boxShadow: intensity > 0.6 ? `0 0 8px ${baseColor}44` : 'none',
                }} title={`${row} / ${colLabels[ci]}: ${val}`}>
                  {val > 0 ? val : ''}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
