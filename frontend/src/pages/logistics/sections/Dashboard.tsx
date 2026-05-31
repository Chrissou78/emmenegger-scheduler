// frontend/src/pages/logistics/sections/Dashboard.tsx
import React from 'react';
import type { LogisticsData } from '../hooks/useLogisticsData';
import type { PermChecks } from '../types';
import { KpiRow } from '../components/StatsCards';
import { getLogStyles } from '../styles';
import { fmtCHF, fmtNum } from '../helpers';
import { SEED_MAINTENANCE_PARTS, SEED_CONSUMABLE_PARTS } from '../constants';

interface Props { data: LogisticsData; t: Record<string, any>; isDark: boolean; perms: PermChecks }

export function Dashboard({ data, t, isDark, perms }: Props) {
  const s = getLogStyles(isDark);
  const { stats, maintenanceParts, consumableParts, parts, alerts, setSection, importParts, showToast } = data;

  const handleSeed = async () => {
    if (!confirm(t.logSeedConfirm || 'Populate sample spare parts?')) return;
    try {
      const rows = [
        ...SEED_MAINTENANCE_PARTS.map(p => ({ ...p, part_type: 'MAINTENANCE', is_sellable: false })),
        ...SEED_CONSUMABLE_PARTS.map(p => ({ ...p, part_type: 'CONSUMABLE', is_sellable: true })),
      ];
      await importParts(rows);
      showToast(t.logSeedSuccess || 'Sample parts created', 'ok');
    } catch { showToast('Seed failed', 'err'); }
  };

  const lowStockParts = parts.filter(p => p.stock_qty > 0 && p.stock_qty <= p.min_qty);
  const outOfStockParts = parts.filter(p => p.stock_qty <= 0 && p.min_qty > 0);
  const pendingReorders = parts.filter(p => p.auto_reorder && p.stock_qty <= p.min_qty);
  const openAlerts = alerts.filter(a => a.status === 'OPEN');

  return (
    <div>
      <KpiRow cardStyle={s.kpiCard} items={[
        { label: t.logTotalParts || 'Total Parts', value: fmtNum(parts.length) },
        { label: t.logMaintenanceParts || 'Maintenance Parts', value: fmtNum(maintenanceParts.length), color: '#3b82f6' },
        { label: t.logConsumables || 'Consumables', value: fmtNum(consumableParts.length), color: '#f97316' },
        { label: t.logTotalMaintenanceValue || 'Maintenance Value', value: fmtCHF(maintenanceParts.reduce((s, p) => s + p.stock_qty * p.unit_price, 0)), color: '#3b82f6' },
        { label: t.logTotalConsumablesValue || 'Consumables Value', value: fmtCHF(consumableParts.reduce((s, p) => s + p.stock_qty * p.unit_price, 0)), color: '#f97316' },
        { label: t.logPotentialRevenue || 'Potential Revenue', value: fmtCHF(consumableParts.reduce((s, p) => s + p.stock_qty * (p.selling_price || 0), 0)), color: '#22c55e' },
        { label: t.logLowStock || 'Low Stock', value: fmtNum(lowStockParts.length), color: '#f59e0b' },
        { label: t.logOutOfStock || 'Out of Stock', value: fmtNum(outOfStockParts.length), color: '#ef4444' },
      ]} />

      {/* Quick actions – gated by perms */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <button style={s.btnPrimary} onClick={() => setSection('maintenance')}>🔧 {t.logMaintenanceParts || 'Maintenance Parts'}</button>
        <button style={{ ...s.btnPrimary, background: '#f97316' }} onClick={() => setSection('consumables')}>🛒 {t.logConsumables || 'Consumables'}</button>
        {perms.canAlerts && (
          <button style={s.btnSecondary} onClick={() => setSection('alerts')}>🔔 {t.logAlerts || 'Alerts'} ({openAlerts.length})</button>
        )}
        {perms.canInventory && (
          <button style={s.btnSecondary} onClick={() => setSection('inventory')}>📦 {t.logStartInventory || 'Start Inventory'}</button>
        )}
        {perms.canPricing && (
          <button style={s.btnSecondary} onClick={() => setSection('pricing')}>💲 {t.logPricingRules || 'Pricing Rules'}</button>
        )}
        {parts.length === 0 && perms.canImport && (
          <button style={{ ...s.btnPrimary, background: '#22c55e' }} onClick={handleSeed}>🌱 {t.logSeedMaintenance || 'Seed Sample Data'}</button>
        )}
      </div>

      {/* Pending reorders */}
      {pendingReorders.length > 0 && (
        <div style={{ ...s.card, marginBottom: 24 }}>
          <h3 style={{ marginBottom: 12 }}>{t.logPendingReorders || 'Pending Reorders'}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={s.thStyle}>{t.logPartNumber || 'Part No.'}</th>
                <th style={s.thStyle}>{t.logName || 'Name'}</th>
                <th style={s.thStyle}>{t.logPartType || 'Type'}</th>
                <th style={s.thStyle}>{t.logStock || 'Stock'}</th>
                <th style={s.thStyle}>{t.logMinQty || 'Min'}</th>
                <th style={s.thStyle}>{t.logReorderQty || 'Reorder'}</th>
                <th style={s.thStyle}>{t.logSupplier || 'Supplier'}</th>
              </tr>
            </thead>
            <tbody>
              {pendingReorders.map(p => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => { data.setSelectedPart(p); setSection(p.part_type === 'MAINTENANCE' ? 'maintenance' : 'consumables'); }}>
                  <td style={s.tdStyle}>{p.part_number}</td>
                  <td style={s.tdStyle}>{p.name}</td>
                  <td style={s.tdStyle}><span style={s.badge(p.part_type === 'MAINTENANCE' ? '#3b82f6' : '#f97316')}>{p.part_type === 'MAINTENANCE' ? (t.logTypeMaintenance || 'Maint.') : (t.logTypeConsumable || 'Consum.')}</span></td>
                  <td style={{ ...s.tdStyle, color: p.stock_qty <= 0 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>{p.stock_qty}</td>
                  <td style={s.tdStyle}>{p.min_qty}</td>
                  <td style={s.tdStyle}>{p.reorder_qty}</td>
                  <td style={s.tdStyle}>{p.supplier || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
