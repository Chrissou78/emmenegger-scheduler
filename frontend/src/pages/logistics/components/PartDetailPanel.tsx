// frontend/src/pages/logistics/components/PartDetailPanel.tsx
import React, { useState, useEffect } from 'react';
import type { SparePart, Machine } from '../types';
import { MAINTENANCE_CATEGORIES, CONSUMABLE_CATEGORIES, UNITS, CATEGORY_I18N } from '../constants';
import { getLogStyles } from '../styles';
import { partToForm, fmtCHF } from '../helpers';

interface Props {
  t: Record<string, any>;
  isDark: boolean;
  part: SparePart;
  machines: Machine[];
  canEdit: boolean;
  canDelete: boolean;
  onSave: (id: string | null, body: Record<string, unknown>) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
  onConsume: (partId: string) => void;
  onPurchase: (partId: string) => void;
  showToast: (msg: string, type: 'ok' | 'err') => void;
}

export function PartDetailPanel({ t, isDark, part, machines, canEdit, canDelete, onSave, onDelete, onClose, onConsume, onPurchase, showToast }: Props) {
  const s = getLogStyles(isDark);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(partToForm(part));
  const [tab, setTab] = useState<'general' | 'stock' | 'pricing'>('general');

  useEffect(() => { setForm(partToForm(part)); setEditing(false); }, [part]);

  const categories = part.part_type === 'MAINTENANCE' ? MAINTENANCE_CATEGORIES : CONSUMABLE_CATEGORIES;

  const handleSave = async () => {
    try {
      await onSave(part.id, form);
      showToast(t.logSaved || 'Saved', 'ok');
      setEditing(false);
    } catch (err: any) {
      showToast(err.message || 'Error', 'err');
    }
  };

  const handleDelete = async () => {
    if (!confirm(t.logConfirmDelete || 'Delete this part?')) return;
    try {
      await onDelete(part.id);
      showToast(t.logDeleted || 'Deleted', 'ok');
    } catch (err: any) {
      showToast(err.message || 'Error', 'err');
    }
  };

  const upd = (key: string, val: unknown) => setForm(f => ({ ...f, [key]: val }));

  const panel: React.CSSProperties = {
    position: 'fixed', top: 0, right: 0, bottom: 0, width: 440,
    background: s.cardBg, zIndex: 100, overflowY: 'auto',
    borderLeft: `1px solid ${s.border}`, padding: 24,
    boxShadow: '-4px 0 24px rgba(0,0,0,0.2)',
  };

  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, marginBottom: 4, marginTop: 12, color: s.muted, display: 'block' };
  const field: React.CSSProperties = { ...s.input, width: '100%', marginBottom: 4 };

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>{part.part_number}</h3>
        <button style={{ ...s.btnSecondary, padding: '4px 10px' }} onClick={onClose}>✕</button>
      </div>

      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{part.name}</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <span style={s.badge(part.part_type === 'MAINTENANCE' ? '#3b82f6' : '#f97316')}>
          {part.part_type === 'MAINTENANCE' ? (t.logTypeMaintenance || 'Maintenance') : (t.logTypeConsumable || 'Consumable')}
        </span>
        <span style={s.badge(part.stock_qty <= 0 ? '#ef4444' : part.stock_qty <= part.min_qty ? '#f59e0b' : '#22c55e')}>
          {part.stock_qty} {part.unit}
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button style={{ ...s.btnPrimary, background: '#ef4444', flex: 1 }}
                onClick={() => onConsume(part.id)}>📤 {t.logConsume || 'Consume'}</button>
        <button style={{ ...s.btnPrimary, background: '#22c55e', flex: 1 }}
                onClick={() => onPurchase(part.id)}>📥 {t.logPurchase || 'Purchase'}</button>
        {canEdit && <button style={{ ...s.btnSecondary, flex: 1 }}
                onClick={() => setEditing(true)}>✏️ {t.edit || 'Edit'}</button>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['general', 'stock', 'pricing'] as const).map(tb => (
          <button key={tb} style={s.tabBtn(tab === tb)} onClick={() => setTab(tb)}>
            {tb === 'general' ? (t.logGeneral || 'General') : tb === 'stock' ? (t.logStock || 'Stock') : (t.logPricingRules || 'Pricing')}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div>
          {editing ? (
            <>
              <label style={label}>{t.logPartNumber || 'Part No.'}</label>
              <input style={field} value={form.part_number} onChange={e => upd('part_number', e.target.value)} />
              <label style={label}>{t.logName || 'Name'}</label>
              <input style={field} value={form.name} onChange={e => upd('name', e.target.value)} />
              <label style={label}>{t.logCategory || 'Category'}</label>
              <select style={field} value={form.category} onChange={e => upd('category', e.target.value)}>
                {categories.map(c => <option key={c} value={c}>{t[CATEGORY_I18N[c]] || c}</option>)}
              </select>
              <label style={label}>{t.logUnit || 'Unit'}</label>
              <select style={field} value={form.unit} onChange={e => upd('unit', e.target.value)}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <label style={label}>{t.logLocation || 'Location'}</label>
              <input style={field} value={form.location} onChange={e => upd('location', e.target.value)} />
              <label style={label}>{t.logSupplier || 'Supplier'}</label>
              <input style={field} value={form.supplier} onChange={e => upd('supplier', e.target.value)} />
              <label style={label}>{t.logMachine || 'Machine'}</label>
              <select style={field} value={form.machine_id} onChange={e => upd('machine_id', e.target.value)}>
                <option value="">—</option>
                {machines.map(m => <option key={m.id} value={m.id}>{m.inventory_nr} — {m.name}</option>)}
              </select>
              <label style={label}>{t.logNotes || 'Notes'}</label>
              <textarea style={{ ...field, minHeight: 60 }} value={form.notes} onChange={e => upd('notes', e.target.value)} />

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button style={s.btnPrimary} onClick={handleSave}>{t.save || 'Save'}</button>
                <button style={s.btnSecondary} onClick={() => { setForm(partToForm(part)); setEditing(false); }}>{t.cancel || 'Cancel'}</button>
                {canDelete && <button style={s.btnDanger} onClick={handleDelete}>{t.delete || 'Delete'}</button>}
              </div>
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 14 }}>
              <div><span style={{ color: s.muted }}>{t.logCategory || 'Category'}</span><br/>{t[CATEGORY_I18N[part.category]] || part.category}</div>
              <div><span style={{ color: s.muted }}>{t.logUnit || 'Unit'}</span><br/>{part.unit}</div>
              <div><span style={{ color: s.muted }}>{t.logLocation || 'Location'}</span><br/>{part.location || '—'}</div>
              <div><span style={{ color: s.muted }}>{t.logSupplier || 'Supplier'}</span><br/>{part.supplier || '—'}</div>
              <div><span style={{ color: s.muted }}>{t.logMachine || 'Machine'}</span><br/>{part.machine?.name || '—'}</div>
              <div style={{ gridColumn: '1 / -1' }}><span style={{ color: s.muted }}>{t.logNotes || 'Notes'}</span><br/>{part.notes || '—'}</div>
            </div>
          )}
        </div>
      )}

      {tab === 'stock' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', fontSize: 14 }}>
          <div><span style={{ color: s.muted }}>{t.logStock || 'Stock'}</span><br/><strong>{part.stock_qty} {part.unit}</strong></div>
          <div><span style={{ color: s.muted }}>{t.logMinQty || 'Min. Qty'}</span><br/>{part.min_qty}</div>
          <div><span style={{ color: s.muted }}>{t.logReorderQty || 'Reorder Qty'}</span><br/>{part.reorder_qty}</div>
          <div><span style={{ color: s.muted }}>{t.logUnitPrice || 'Unit Price'}</span><br/>{fmtCHF(part.unit_price)}</div>
          <div><span style={{ color: s.muted }}>{t.logStockValue || 'Stock Value'}</span><br/>{fmtCHF(part.stock_qty * part.unit_price)}</div>
          <div><span style={{ color: s.muted }}>{t.logAutoReorder || 'Auto Reorder'}</span><br/>{part.auto_reorder ? '✅' : '—'}</div>
        </div>
      )}

      {tab === 'pricing' && part.part_type === 'CONSUMABLE' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', fontSize: 14 }}>
          <div><span style={{ color: s.muted }}>{t.logBuyingPrice || 'Buying Price'}</span><br/>{fmtCHF(part.unit_price)}</div>
          <div><span style={{ color: s.muted }}>{t.logSellingPrice || 'Selling Price'}</span><br/>{fmtCHF(part.selling_price || 0)}</div>
          <div><span style={{ color: s.muted }}>{t.logMarginPct || 'Margin %'}</span><br/>{part.selling_price && part.unit_price ? ((part.selling_price - part.unit_price) / part.unit_price * 100).toFixed(1) : '—'}%</div>
          <div><span style={{ color: s.muted }}>{t.logProfitMargin || 'Profit / unit'}</span><br/>{fmtCHF((part.selling_price || 0) - part.unit_price)}</div>
          <div><span style={{ color: s.muted }}>{t.logPotentialRevenue || 'Potential Revenue'}</span><br/>{fmtCHF(part.stock_qty * (part.selling_price || 0))}</div>
          <div><span style={{ color: s.muted }}>{t.logSellable || 'Sellable'}</span><br/>{part.is_sellable ? '✅' : '—'}</div>
        </div>
      )}

      {tab === 'pricing' && part.part_type === 'MAINTENANCE' && (
        <div style={{ padding: 20, textAlign: 'center', opacity: 0.6 }}>
          {t.logNotForSale || 'Internal use only — no pricing rules'}
        </div>
      )}
    </div>
  );
}
