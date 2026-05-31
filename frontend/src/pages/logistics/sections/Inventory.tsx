// frontend/src/pages/logistics/sections/Inventory.tsx
import React, { useState, useMemo } from 'react';
import type { LogisticsData } from '../hooks/useLogisticsData';
import type { InventoryLine } from '../types';
import type { PermChecks } from '../types';
import { CATEGORY_I18N } from '../constants';
import { getLogStyles } from '../styles';
import { fmtCHF, fmtNum } from '../helpers';

interface Props { data: LogisticsData; t: Record<string, any>; isDark: boolean; perms: PermChecks }

export function Inventory({ data, t, isDark, perms }: Props) {
  const s = getLogStyles(isDark);
  const { parts, submitTransaction, showToast, setSection } = data;

  const [lines, setLines] = useState<InventoryLine[]>(() =>
    parts.map(p => ({ part: p, systemQty: p.stock_qty, countedQty: null, difference: 0, touched: false, notes: '' }))
  );
  const [filter, setFilter] = useState('');
  const [applying, setApplying] = useState(false);

  const filteredLines = useMemo(() => {
    if (!filter) return lines;
    const q = filter.toLowerCase();
    return lines.filter(l => l.part.name.toLowerCase().includes(q) || l.part.part_number.toLowerCase().includes(q));
  }, [lines, filter]);

  const counted = lines.filter(l => l.touched).length;
  const discrepancies = lines.filter(l => l.touched && l.difference !== 0).length;

  const updateCount = (idx: number, val: string) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const qty = val === '' ? null : Number(val);
      return { ...l, countedQty: qty, difference: (qty ?? l.systemQty) - l.systemQty, touched: val !== '' };
    }));
  };

  const updateNote = (idx: number, val: string) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, notes: val } : l));
  };

  const markAllOk = () => {
    setLines(prev => prev.map(l => l.touched ? l : { ...l, countedQty: l.systemQty, difference: 0, touched: true }));
  };

  const applyAdjustments = async () => {
    const diffs = lines.filter(l => l.touched && l.difference !== 0);
    if (diffs.length === 0) { showToast(t.logNoDiscrepancies || 'No discrepancies', 'ok'); return; }
    if (!confirm(`${t.logConfirmAdjustments || 'Apply'} ${diffs.length} ${t.logAdjustments || 'adjustments'}?`)) return;
    setApplying(true);
    let ok = 0;
    for (const l of diffs) {
      try {
        await submitTransaction({
          part_id: l.part.id,
          type: l.difference > 0 ? 'ADJUST' : 'CONSUME',
          qty: Math.abs(l.difference),
          notes: `Inventory: ${l.notes || 'count adjustment'}`,
        });
        ok++;
      } catch { /* skip */ }
    }
    showToast(`${ok} ${t.logPartsAdjusted || 'parts adjusted'}`, 'ok');
    setApplying(false);
    setSection('dashboard');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>📦 {t.logInventoryCount || 'Inventory Count'}</h2>
        <button style={s.btnSecondary} onClick={() => setSection('dashboard')}>← {t.logBackToLogistics || 'Back'}</button>
      </div>
      <p style={{ color: s.muted, marginBottom: 16 }}>{t.logInventoryDesc || 'Count physical stock and reconcile discrepancies'}</p>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={s.kpiCard}><div style={{ fontSize: 20, fontWeight: 800 }}>{lines.length}</div><div style={{ fontSize: 12, opacity: 0.7 }}>{t.logTotalParts || 'Total'}</div></div>
        <div style={s.kpiCard}><div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e' }}>{counted}</div><div style={{ fontSize: 12, opacity: 0.7 }}>{t.logCounted || 'Counted'}</div></div>
        <div style={s.kpiCard}><div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>{lines.length - counted}</div><div style={{ fontSize: 12, opacity: 0.7 }}>{t.logUncounted || 'Uncounted'}</div></div>
        <div style={s.kpiCard}><div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444' }}>{discrepancies}</div><div style={{ fontSize: 12, opacity: 0.7 }}>{t.logDiscrepancies || 'Discrepancies'}</div></div>
      </div>

      {/* Progress */}
      <div style={{ background: s.border, borderRadius: 8, height: 8, marginBottom: 16 }}>
        <div style={{ background: '#22c55e', borderRadius: 8, height: 8, width: `${lines.length ? (counted / lines.length * 100) : 0}%`, transition: 'width .3s' }} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input placeholder={t.logSearchParts || 'Search...'} value={filter} onChange={e => setFilter(e.target.value)} style={{ ...s.input, flex: 1 }} />
        <button style={s.btnSecondary} onClick={markAllOk}>{t.logMarkAllOk || 'Mark all uncounted as OK'}</button>
        {perms.canInventory && (
          <button style={s.btnPrimary} onClick={applyAdjustments} disabled={applying}>
            {applying ? '...' : (t.logApplyAdjustments || 'Apply Adjustments')}
          </button>
        )}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={s.thStyle}>{t.logPartNumber || 'Part No.'}</th>
            <th style={s.thStyle}>{t.logName || 'Name'}</th>
            <th style={s.thStyle}>{t.logPartType || 'Type'}</th>
            <th style={s.thStyle}>{t.logSystemQty || 'System'}</th>
            <th style={s.thStyle}>{t.logCountedQty || 'Counted'}</th>
            <th style={s.thStyle}>{t.logDifference || 'Diff'}</th>
            <th style={s.thStyle}>{t.logNotes || 'Notes'}</th>
          </tr>
        </thead>
        <tbody>
          {filteredLines.map((l, i) => {
            const realIdx = lines.indexOf(l);
            return (
              <tr key={l.part.id}>
                <td style={s.tdStyle}>{l.part.part_number}</td>
                <td style={s.tdStyle}>{l.part.name}</td>
                <td style={s.tdStyle}><span style={s.badge(l.part.part_type === 'MAINTENANCE' ? '#3b82f6' : '#f97316')}>{l.part.part_type === 'MAINTENANCE' ? (t.logTypeMaintenance || 'M') : (t.logTypeConsumable || 'C')}</span></td>
                <td style={s.tdStyle}>{l.systemQty}</td>
                <td style={s.tdStyle}>
                  <input type="number" style={{ ...s.input, width: 80 }} value={l.countedQty ?? ''} placeholder="—"
                         onChange={e => updateCount(realIdx, e.target.value)} />
                </td>
                <td style={{ ...s.tdStyle, fontWeight: 700, color: l.difference === 0 ? s.text : l.difference > 0 ? '#22c55e' : '#ef4444' }}>
                  {l.touched ? (l.difference > 0 ? `+${l.difference}` : l.difference) : '—'}
                </td>
                <td style={s.tdStyle}>
                  <input style={{ ...s.input, width: 120 }} value={l.notes} placeholder="—"
                         onChange={e => updateNote(realIdx, e.target.value)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
