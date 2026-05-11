// frontend/src/pages/settings/ConfigTab.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { SettingsData } from './useSettingsData';
import type { Styles } from './settingsStyles';
import type { ConfigItem, ConfigForm, ConfigCategory } from './types';
import { CONFIG_CATEGORIES, EMPTY_CONFIG_FORM } from './types';

interface Props {
  data: SettingsData;
  S: Styles;
  t: Record<string, any>;
  gold: string;
}

export default function ConfigTab({ data, S, t, gold }: Props) {
  const { configItems, configCategory, setConfigCategory, saving, fetchConfigItems, hdrs, showToast, setConfirmDel } = data;

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ConfigForm>(EMPTY_CONFIG_FORM);

  const API = import.meta.env.VITE_API_URL ?? '';

  // fetch on category change
  const prevCat = useRef(configCategory);
  useEffect(() => {
    if (prevCat.current !== configCategory) {
      prevCat.current = configCategory;
      fetchConfigItems(configCategory);
    }
  }, [configCategory, fetchConfigItems]);

  const openCreate = () => { setForm({ ...EMPTY_CONFIG_FORM }); setEditId(null); setModal(true); };
  const openEdit = (item: ConfigItem) => {
    setForm({ key: item.key, label: item.label, sort_order: item.sort_order, meta: item.meta ? JSON.stringify(item.meta) : '{}' });
    setEditId(item.id);
    setModal(true);
  };

  const save = async () => {
    data.setSaving(true);
    try {
      let metaParsed = {};
      try { metaParsed = JSON.parse(form.meta); } catch { /* keep empty */ }
      const body = { category: configCategory, key: form.key, label: form.label, sort_order: form.sort_order, meta: metaParsed };
      const url = editId
        ? `${API}/api/v1/settings/config/${configCategory}/${editId}`
        : `${API}/api/v1/settings/config/${configCategory}`;
      const r = await fetch(url, { method: editId ? 'PUT' : 'POST', headers: hdrs(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      showToast(t.saved ?? 'Saved');
      setModal(false);
      fetchConfigItems(configCategory);
    } catch (e) {
      showToast((t.error ?? 'Error') + ': ' + (e instanceof Error ? e.message : ''), false);
    } finally { data.setSaving(false); }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CONFIG_CATEGORIES.map(cat => (
            <button key={cat.key} onClick={() => setConfigCategory(cat.key)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', border: 'none',
                background: configCategory === cat.key ? gold + '22' : 'transparent',
                color: configCategory === cat.key ? gold : 'inherit',
              }}>
              {(t as any)[cat.labelKey] ?? cat.key}
            </button>
          ))}
        </div>
        <button style={S.sBtn(gold)} onClick={openCreate}>+ {t.newItem ?? 'New'}</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={S.sTh}>{t.key ?? 'Key'}</th>
            <th style={S.sTh}>{t.label ?? 'Label'}</th>
            <th style={S.sTh}>{t.sortOrder ?? 'Order'}</th>
            <th style={S.sTh}>{t.active ?? 'Active'}</th>
            <th style={S.sTh}></th>
          </tr>
        </thead>
        <tbody>
          {configItems.length === 0 && (
            <tr><td colSpan={5} style={{ ...S.sTd, textAlign: 'center', color: S.dimText }}>{t.noResults ?? 'No results'}</td></tr>
          )}
          {configItems.map(item => (
            <tr key={item.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(item)}>
              <td style={{ ...S.sTd, fontFamily: 'monospace', fontWeight: 600 }}>{item.key}</td>
              <td style={S.sTd}>{item.label}</td>
              <td style={S.sTd}>{item.sort_order}</td>
              <td style={S.sTd}><span style={{ color: item.is_active ? '#22c55e' : '#6b7280' }}>●</span></td>
              <td style={S.sTd}>
                <button style={{ ...S.sBtn('#ef4444'), padding: '4px 10px', fontSize: 12 }}
                  onClick={e => { e.stopPropagation(); setConfirmDel({ type: `config/${configCategory}`, id: item.id }); }}>
                  {t.delete ?? 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* CONFIG ITEM MODAL */}
      {modal && (
        <div style={S.sOverlay} onClick={() => setModal(false)}>
          <div style={{ ...S.sModal, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 16px', color: gold }}>
              {editId ? (t.edit ?? 'Edit') : (t.newItem ?? 'New')} — {(t as any)[CONFIG_CATEGORIES.find(c => c.key === configCategory)?.labelKey ?? ''] ?? configCategory}
            </h2>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={S.sLabel}>{t.key ?? 'Key'} *</label>
                <input style={S.sInput} value={form.key}
                  onChange={e => setForm({ ...form, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} />
              </div>
              <div>
                <label style={S.sLabel}>{t.label ?? 'Label'} *</label>
                <input style={S.sInput} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
              </div>
              <div>
                <label style={S.sLabel}>{t.sortOrder ?? 'Order'}</label>
                <input style={S.sInput} type="number" value={form.sort_order}
                  onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={S.sLabel}>{t.metadata ?? 'Metadata'}</label>
                <textarea style={{ ...S.sInput, minHeight: 80, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' } as any}
                  value={form.meta} onChange={e => setForm({ ...form, meta: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button style={S.sBtnOutline} onClick={() => setModal(false)}>{t.cancel ?? 'Cancel'}</button>
              <button style={S.sBtn(gold)} disabled={saving} onClick={save}>{saving ? '…' : (t.save ?? 'Save')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
