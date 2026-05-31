// frontend/src/pages/logistics/components/TransactionModal.tsx
import React, { useState } from 'react';
import type { SparePart, Machine, Task } from '../types';
import { TX_TYPES } from '../constants';
import { getLogStyles } from '../styles';

interface Props {
  t: Record<string, any>;
  isDark: boolean;
  parts: SparePart[];
  machines: Machine[];
  tasks: Task[];
  defaultType: string;
  defaultPartId?: string;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

export function TransactionModal({ t, isDark, parts, machines, tasks, defaultType, defaultPartId, onSubmit, onClose }: Props) {
  const s = getLogStyles(isDark);
  const [form, setForm] = useState({
    part_id: defaultPartId || '', type: defaultType,
    qty: 1, unit_price: 0, selling_price: 0,
    machine_id: '', task_id: '', reference: '', notes: '',
  });
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!form.part_id || form.qty <= 0) return;
    setBusy(true);
    try {
      await onSubmit({
        part_id: form.part_id, type: form.type, qty: form.qty,
        unit_price: form.unit_price || undefined,
        selling_price: form.selling_price || undefined,
        machine_id: form.machine_id || undefined,
        task_id: form.task_id || undefined,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
      });
      onClose();
    } catch { /* handled upstream */ }
    setBusy(false);
  };

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999,
    display: 'flex', justifyContent: 'center', alignItems: 'center',
  };
  const modal: React.CSSProperties = {
    ...s.card, width: 480, maxHeight: '85vh', overflow: 'auto',
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginBottom: 16 }}>{t.logRecordMovement || 'Record Movement'}</h3>

        <label style={{ fontSize: 13, fontWeight: 600 }}>{t.logSpareParts || 'Part'}</label>
        <select style={{ ...s.input, width: '100%', marginBottom: 12 }} value={form.part_id}
                onChange={e => setForm(f => ({ ...f, part_id: e.target.value }))}>
          <option value="">—</option>
          {parts.map(p => <option key={p.id} value={p.id}>{p.part_number} — {p.name}</option>)}
        </select>

        <label style={{ fontSize: 13, fontWeight: 600 }}>{t.logType || 'Type'}</label>
        <select style={{ ...s.input, width: '100%', marginBottom: 12 }} value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
          {TX_TYPES.map(ty => <option key={ty} value={ty}>{ty}</option>)}
        </select>

        <label style={{ fontSize: 13, fontWeight: 600 }}>{t.logQuantity || 'Quantity'}</label>
        <input type="number" style={{ ...s.input, width: '100%', marginBottom: 12 }} value={form.qty}
               onChange={e => setForm(f => ({ ...f, qty: Number(e.target.value) }))} min={1} />

        <label style={{ fontSize: 13, fontWeight: 600 }}>{t.logBuyingPrice || 'Unit Price'}</label>
        <input type="number" step="0.01" style={{ ...s.input, width: '100%', marginBottom: 12 }} value={form.unit_price}
               onChange={e => setForm(f => ({ ...f, unit_price: Number(e.target.value) }))} />

        {form.type === 'SALE' && (
          <>
            <label style={{ fontSize: 13, fontWeight: 600 }}>{t.logSellingPrice || 'Selling Price'}</label>
            <input type="number" step="0.01" style={{ ...s.input, width: '100%', marginBottom: 12 }} value={form.selling_price}
                   onChange={e => setForm(f => ({ ...f, selling_price: Number(e.target.value) }))} />
          </>
        )}

        <label style={{ fontSize: 13, fontWeight: 600 }}>{t.logMachine || 'Machine'}</label>
        <select style={{ ...s.input, width: '100%', marginBottom: 12 }} value={form.machine_id}
                onChange={e => setForm(f => ({ ...f, machine_id: e.target.value }))}>
          <option value="">—</option>
          {machines.map(m => <option key={m.id} value={m.id}>{m.inventory_nr} — {m.name}</option>)}
        </select>

        <label style={{ fontSize: 13, fontWeight: 600 }}>{t.logTask || 'Task'}</label>
        <select style={{ ...s.input, width: '100%', marginBottom: 12 }} value={form.task_id}
                onChange={e => setForm(f => ({ ...f, task_id: e.target.value }))}>
          <option value="">—</option>
          {tasks.map(tk => <option key={tk.id} value={tk.id}>{tk.code} — {tk.name}</option>)}
        </select>

        <label style={{ fontSize: 13, fontWeight: 600 }}>{t.logReference || 'Reference'}</label>
        <input style={{ ...s.input, width: '100%', marginBottom: 12 }} value={form.reference}
               onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />

        <label style={{ fontSize: 13, fontWeight: 600 }}>{t.logNotes || 'Notes'}</label>
        <textarea style={{ ...s.input, width: '100%', marginBottom: 16, minHeight: 60 }} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button style={s.btnSecondary} onClick={onClose}>{t.cancel || 'Cancel'}</button>
          <button style={s.btnPrimary} onClick={handleSubmit} disabled={busy}>
            {busy ? '...' : (t.save || 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}