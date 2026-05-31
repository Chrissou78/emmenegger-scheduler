// frontend/src/pages/logistics/sections/MaintenanceParts.tsx
import React, { useState } from 'react';
import type { LogisticsData } from '../hooks/useLogisticsData';
import type { PermChecks } from '../types';
import { MAINTENANCE_CATEGORIES, CATEGORY_I18N } from '../constants';
import { getLogStyles } from '../styles';
import { fmtCHF, emptyPartForm } from '../helpers';
import { PartDetailPanel } from '../components/PartDetailPanel';

interface Props { data: LogisticsData; t: Record<string, any>; isDark: boolean; perms: PermChecks }

export function MaintenanceParts({ data, t, isDark, perms }: Props) {
  const s = getLogStyles(isDark);
  const { maintenanceParts, search, setSearch, categoryFilter, setCategoryFilter,
          selectedPart, setSelectedPart, savePart, deletePart,
          machines, showToast, setTxModalOpen, setTxModalType } = data;

  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState(emptyPartForm('MAINTENANCE'));

  const filtered = maintenanceParts.filter(p => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.part_number.toLowerCase().includes(q) || (p.supplier || '').toLowerCase().includes(q);
    }
    return true;
  });

  const handleCreate = async () => {
    try {
      await savePart(null, { ...newForm, part_type: 'MAINTENANCE', is_sellable: false });
      showToast(t.logSaved || 'Saved', 'ok');
      setCreating(false);
      setNewForm(emptyPartForm('MAINTENANCE'));
    } catch (err: any) { showToast(err.message, 'err'); }
  };

  const openConsume = (partId: string) => { setTxModalType('CONSUME'); setTxModalOpen(true); };
  const openPurchase = (partId: string) => { setTxModalType('PURCHASE'); setTxModalOpen(true); };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>🔧 {t.logMaintenanceParts || 'Maintenance Parts'}</h2>
        {perms.canEdit && (
          <button style={s.btnPrimary} onClick={() => setCreating(true)}>+ {t.logNewPart || 'New Part'}</button>
        )}
      </div>
      <p style={{ color: s.muted, marginBottom: 16 }}>{t.logMaintenanceDesc || 'Internal use parts for machine upkeep'}</p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input placeholder={t.logSearchParts || 'Search parts...'} value={search}
               onChange={e => setSearch(e.target.value)} style={{ ...s.input, flex: 1, minWidth: 200 }} />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={s.input}>
          <option value="">{t.logAllItems || 'All categories'}</option>
          {MAINTENANCE_CATEGORIES.map(c => <option key={c} value={c}>{t[CATEGORY_I18N[c]] || c}</option>)}
        </select>
      </div>

      {/* Create inline form – only if canEdit */}
      {creating && perms.canEdit && (
        <div style={{ ...s.card, marginBottom: 16 }}>
          <h3>{t.logNewPart || 'New Maintenance Part'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>{t.logPartNumber || 'Part No.'}</label>
              <input style={{ ...s.input, width: '100%' }} value={newForm.part_number} onChange={e => setNewForm(f => ({ ...f, part_number: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>{t.logName || 'Name'}</label>
              <input style={{ ...s.input, width: '100%' }} value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>{t.logCategory || 'Category'}</label>
              <select style={{ ...s.input, width: '100%' }} value={newForm.category} onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))}>
                {MAINTENANCE_CATEGORIES.map(c => <option key={c} value={c}>{t[CATEGORY_I18N[c]] || c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>{t.logUnitPrice || 'Unit Price'}</label>
              <input type="number" step="0.01" style={{ ...s.input, width: '100%' }} value={newForm.unit_price} onChange={e => setNewForm(f => ({ ...f, unit_price: Number(e.target.value) }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>{t.logMinQty || 'Min Qty'}</label>
              <input type="number" style={{ ...s.input, width: '100%' }} value={newForm.min_qty} onChange={e => setNewForm(f => ({ ...f, min_qty: Number(e.target.value) }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>{t.logSupplier || 'Supplier'}</label>
              <input style={{ ...s.input, width: '100%' }} value={newForm.supplier} onChange={e => setNewForm(f => ({ ...f, supplier: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={s.btnPrimary} onClick={handleCreate}>{t.save || 'Save'}</button>
            <button style={s.btnSecondary} onClick={() => setCreating(false)}>{t.cancel || 'Cancel'}</button>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, opacity: 0.6 }}>{t.logNoPartsFilter || 'No parts found'}</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={s.thStyle}>{t.logPartNumber || 'Part No.'}</th>
              <th style={s.thStyle}>{t.logName || 'Name'}</th>
              <th style={s.thStyle}>{t.logCategory || 'Category'}</th>
              <th style={s.thStyle}>{t.logStock || 'Stock'}</th>
              <th style={s.thStyle}>{t.logMinQty || 'Min'}</th>
              <th style={s.thStyle}>{t.logLocation || 'Location'}</th>
              <th style={s.thStyle}>{t.logSupplier || 'Supplier'}</th>
              <th style={s.thStyle}>{t.logUnitPrice || 'Price'}</th>
              <th style={s.thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedPart(p)}>
                <td style={s.tdStyle}>{p.part_number}</td>
                <td style={s.tdStyle}>{p.name}</td>
                <td style={s.tdStyle}>{t[CATEGORY_I18N[p.category]] || p.category}</td>
                <td style={{ ...s.tdStyle, fontWeight: 700, color: p.stock_qty <= 0 ? '#ef4444' : p.stock_qty <= p.min_qty ? '#f59e0b' : s.text }}>{p.stock_qty} {p.unit}</td>
                <td style={s.tdStyle}>{p.min_qty}</td>
                <td style={s.tdStyle}>{p.location || '—'}</td>
                <td style={s.tdStyle}>{p.supplier || '—'}</td>
                <td style={s.tdStyle}>{fmtCHF(p.unit_price)}</td>
                <td style={s.tdStyle}>
                  {p.stock_qty <= p.min_qty && <span style={s.badge('#f59e0b')}>{t.logLowStock || 'Low'}</span>}
                  {p.stock_qty <= 0 && <span style={s.badge('#ef4444')}>{t.logOutOfStock || 'Out'}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Detail panel – pass perms for edit/delete gating */}
      {selectedPart && selectedPart.part_type === 'MAINTENANCE' && (
        <PartDetailPanel t={t} isDark={isDark} part={selectedPart} machines={machines}
          canEdit={perms.canEdit} canDelete={perms.canDelete}
          onSave={savePart} onDelete={deletePart} onClose={() => setSelectedPart(null)}
          onConsume={perms.canConsume ? openConsume : undefined}
          onPurchase={perms.canEdit ? openPurchase : undefined}
          showToast={showToast} />
      )}
    </div>
  );
}
