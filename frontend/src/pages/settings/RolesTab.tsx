// frontend/src/pages/settings/RolesTab.tsx
import React, { useState } from 'react';
import type { SettingsData } from './useSettingsData';
import type { Styles } from './settingsStyles';
import type { RoleConfig } from './types';
import { PERM_GROUPS, EMPTY_ROLE } from './types';
import type { Permission } from '../../../../shared/constants/roles';

interface Props {
  data: SettingsData;
  S: Styles;
  t: Record<string, any>;
  gold: string;
}

/* ── i18n keys for each permission group heading ── */
const GROUP_I18N: Record<string, string> = {
  Schedule:   'permGroupSchedule',
  Machines:   'permGroupMachines',
  Tasks:      'permGroupTasks',
  Logistics:  'permGroupLogistics',
  CRM:        'permGroupCRM',
  Customers:  'permGroupCustomers',
  Quotations: 'permGroupQuotations',
  Invoices:   'permGroupInvoices',
  Reports:    'permGroupReports',
  Stats:      'permGroupStats',
  'My Week':  'permGroupMyWeek',
  HR:         'permGroupHR',
  Finance:    'permGroupFinance',
  Admin:      'permGroupAdmin',
  CEO:        'permGroupCEO',
  Profile:    'permGroupProfile',
};

/* ── Pretty label for individual permission tokens ── */
function permLabel(perm: string): string {
  // "logistics.sell" → "sell", "schedule.view.all" → "view.all"
  const parts = perm.split('.');
  return parts.slice(1).join('.');
}

export default function RolesTab({ data, S, t, gold }: Props) {
  const { roles, saving, fetchRoles, hdrs, showToast, setConfirmDel } = data;

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<RoleConfig, 'id'>>(EMPTY_ROLE);

  const API = import.meta.env.VITE_API_URL ?? '';

  const openCreate = () => { setForm({ ...EMPTY_ROLE }); setEditId(null); setModal(true); };
  const openEdit = (r: RoleConfig) => {
    setForm({
      name: r.name, label_de: r.label_de, label_en: r.label_en,
      label_fr: r.label_fr, label_pt: r.label_pt,
      permissions: [...r.permissions], is_system: r.is_system, is_active: r.is_active,
    });
    setEditId(r.id);
    setModal(true);
  };

  const save = async () => {
    data.setSaving(true);
    try {
      const url = editId
        ? `${API}/api/v1/settings/roles/${editId}`
        : `${API}/api/v1/settings/roles`;
      const r = await fetch(url, {
        method: editId ? 'PUT' : 'POST', headers: hdrs(), body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      showToast(t.saved ?? 'Saved');
      setModal(false);
      fetchRoles();
    } catch (e) {
      showToast((t.error ?? 'Error') + ': ' + (e instanceof Error ? e.message : ''), false);
    } finally { data.setSaving(false); }
  };

  const togglePerm = (perm: Permission) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  /* ★ NEW: Toggle all permissions in a group */
  const toggleGroupAll = (permsArr: Permission[]) => {
    const allChecked = permsArr.every(p => form.permissions.includes(p));
    setForm(prev => {
      if (allChecked) {
        // remove all group perms
        return { ...prev, permissions: prev.permissions.filter(p => !permsArr.includes(p)) };
      }
      // add missing group perms
      const newPerms = new Set([...prev.permissions, ...permsArr]);
      return { ...prev, permissions: [...newPerms] as Permission[] };
    });
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: gold }}>{t.roles ?? 'Roles'}</h2>
        <button style={S.sBtn(gold)} onClick={openCreate}>+ {t.newRole ?? 'New Role'}</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={S.sTh}>{t.roleName ?? 'Role'}</th>
            <th style={S.sTh}>DE</th>
            <th style={S.sTh}>EN</th>
            <th style={S.sTh}>{t.permissions ?? 'Permissions'}</th>
            <th style={S.sTh}>{t.systemRole ?? 'System'}</th>
            <th style={S.sTh}>{t.active ?? 'Active'}</th>
            <th style={S.sTh}></th>
          </tr>
        </thead>
        <tbody>
          {roles.length === 0 && (
            <tr><td colSpan={7} style={{ ...S.sTd, textAlign: 'center', color: S.dimText }}>{t.noResults ?? 'No results'}</td></tr>
          )}
          {roles.map(r => (
            <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(r)}>
              <td style={{ ...S.sTd, fontWeight: 700 }}>{r.name}</td>
              <td style={S.sTd}>{r.label_de}</td>
              <td style={S.sTd}>{r.label_en}</td>
              <td style={S.sTd}><span style={{ fontSize: 12, color: S.dimText }}>{r.permissions.length} permissions</span></td>
              <td style={S.sTd}>
                {r.is_system && (
                  <span style={{ padding: '2px 8px', borderRadius: 4, background: gold + '22', color: gold, fontSize: 11, fontWeight: 600 }}>System</span>
                )}
              </td>
              <td style={S.sTd}><span style={{ color: r.is_active ? '#22c55e' : '#6b7280' }}>●</span></td>
              <td style={S.sTd}>
                {!r.is_system && (
                  <button style={{ ...S.sBtn('#ef4444'), padding: '4px 10px', fontSize: 12 }}
                    onClick={e => { e.stopPropagation(); setConfirmDel({ type: 'roles', id: r.id }); }}>
                    {t.delete ?? 'Delete'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ROLE MODAL */}
      {modal && (
        <div style={S.sOverlay} onClick={() => setModal(false)}>
          <div style={{ ...S.sModal, maxWidth: 760 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 16px', color: gold }}>
              {editId ? (t.editRole ?? 'Edit Role') : (t.newRole ?? 'New Role')}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={S.sLabel}>{t.roleName ?? 'Role'} (key) *</label>
                <input style={S.sInput} value={form.name} disabled={form.is_system}
                  onChange={e => setForm({ ...form, name: e.target.value.toUpperCase().replace(/[^A-Z_]/g, '') })} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginTop: 20 }}>
                  <input type="checkbox" checked={form.is_active}
                    onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                  {t.active ?? 'Active'}
                </label>
              </div>
              <div>
                <label style={S.sLabel}>Label DE</label>
                <input style={S.sInput} value={form.label_de} onChange={e => setForm({ ...form, label_de: e.target.value })} />
              </div>
              <div>
                <label style={S.sLabel}>Label EN</label>
                <input style={S.sInput} value={form.label_en} onChange={e => setForm({ ...form, label_en: e.target.value })} />
              </div>
              <div>
                <label style={S.sLabel}>Label FR</label>
                <input style={S.sInput} value={form.label_fr} onChange={e => setForm({ ...form, label_fr: e.target.value })} />
              </div>
              <div>
                <label style={S.sLabel}>Label PT</label>
                <input style={S.sInput} value={form.label_pt} onChange={e => setForm({ ...form, label_pt: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: gold, fontSize: 15 }}>{t.permissions ?? 'Permissions'}</h3>
              <span style={{ fontSize: 12, color: S.dimText }}>
                {form.permissions.length} / {Object.values(PERM_GROUPS).flat().length} {t.selected ?? 'selected'}
              </span>
            </div>

            <div style={{ maxHeight: 420, overflowY: 'auto', border: `1px solid`, borderRadius: 8, padding: 12 }}>
              {Object.entries(PERM_GROUPS).map(([group, permsArr]) => {
                const groupChecked = permsArr.filter(p => form.permissions.includes(p)).length;
                const allChecked = groupChecked === permsArr.length;
                const someChecked = groupChecked > 0 && !allChecked;
                const i18nKey = GROUP_I18N[group];
                const groupLabel = (i18nKey && t[i18nKey]) ? t[i18nKey] : group;

                return (
                  <div key={group} style={{ marginBottom: 14 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      marginBottom: 6, cursor: 'pointer',
                    }}
                      onClick={() => toggleGroupAll(permsArr)}
                    >
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={el => { if (el) el.indeterminate = someChecked; }}
                        onChange={() => toggleGroupAll(permsArr)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 700, color: gold, letterSpacing: 0.5 }}>
                        {groupLabel}
                      </span>
                      <span style={{ fontSize: 11, color: S.dimText }}>
                        ({groupChecked}/{permsArr.length})
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 24 }}>
                      {permsArr.map(perm => {
                        const checked = form.permissions.includes(perm);
                        return (
                          <label key={perm} style={{
                            display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                            padding: '3px 10px', borderRadius: 6,
                            background: checked ? '#22c55e18' : 'transparent',
                            border: `1px solid ${checked ? '#22c55e' : 'gray'}`, cursor: 'pointer',
                          }}>
                            <input type="checkbox" checked={checked} onChange={() => togglePerm(perm)} />
                            {permLabel(perm)}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
