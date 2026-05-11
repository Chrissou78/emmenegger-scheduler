// frontend/src/pages/settings/HierarchyTab.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { useTheme } from '../../contexts/themeContext';
import type { SettingsData } from './useSettingsData';
import type { Styles } from './settingsStyles';
import type { HierarchyUser } from './types';
import { isCeoRole, isExecRole, isManagerRole, isEmployeeRole } from './types';

interface Props {
  data: SettingsData;
  S: Styles;
  t: Record<string, any>;
  gold: string;
}

export default function HierarchyTab({ data, S, t, gold }: Props) {
  const { isDark, th } = useTheme();
  const {
    hUsers, hLoading, hEditMap, hDirty, saving,
    saveHierarchy, removeFromDepartment, setHierarchyField,
  } = data;

  const [hCollapsed, setHCollapsed] = useState<Record<string, boolean>>({});
  const [hViewMode, setHViewMode] = useState<'macro' | 'detail'>('macro');
  const [hRoleFilter, setHRoleFilter] = useState('');

  const dimText = S.dimText;

  /* ── Computed ── */
  const hCeos     = useMemo(() => hUsers.filter(u => isCeoRole(u.role)), [hUsers]);
  const hExecs    = useMemo(() => hUsers.filter(u => isExecRole(u.role)), [hUsers]);
  const hManagers = useMemo(() => hUsers.filter(u => isManagerRole(u.role)), [hUsers]);
  const hEmployees = useMemo(() => hUsers.filter(u => isEmployeeRole(u.role)), [hUsers]);
  const hAllRoles = useMemo(() => [...new Set(hUsers.map(u => u.role).filter(Boolean))].sort(), [hUsers]);
  const allDepartments = useMemo(() => [...new Set(hUsers.flatMap(u => u.departments || []))].sort(), [hUsers]);

  const deptMap = useMemo(() => {
    const m: Record<string, HierarchyUser[]> = {};
    allDepartments.forEach(d => { m[d] = hUsers.filter(u => (u.departments || []).includes(d)); });
    return m;
  }, [hUsers, allDepartments]);

  const hChangeCount = useMemo(() => hUsers.filter(u => {
    const e = hEditMap[u.id];
    if (!e) return false;
    return (
      e.team_leader_id !== u.team_leader_id ||
      e.executive_id !== u.executive_id ||
      e.ceo_id !== u.ceo_id ||
      JSON.stringify(e.departments ?? []) !== JSON.stringify(u.departments)
    );
  }).length, [hUsers, hEditMap]);

  const toggleCollapse = (key: string) => setHCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  const collapseAll = () => {
    const map: Record<string, boolean> = {};
    ['ceo', 'executives', ...allDepartments].forEach(k => { map[k] = true; });
    setHCollapsed(map);
  };
  const expandAll = () => setHCollapsed({});

  /* ── User card ── */
  const userCard = (u: HierarchyUser, indent: number = 0) => (
    <div key={u.id} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 12px', marginLeft: indent * 24,
      borderLeft: indent > 0 ? `2px solid ${gold}33` : 'none',
      background: isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.01)',
      borderRadius: 6, marginBottom: 4,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: `${gold}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, color: gold, flexShrink: 0,
      }}>
        {u.first_name?.[0]}{u.last_name?.[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{u.first_name} {u.last_name}</div>
        <div style={{ fontSize: 11, color: dimText }}>{u.role} • {(u.departments || []).join(', ') || '—'}</div>
      </div>
      {hViewMode === 'detail' && (
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {!isCeoRole(u.role) && !isExecRole(u.role) && (
            <select style={{ ...S.sInput, width: 150, fontSize: 11, padding: '4px 6px' }}
              value={hEditMap[u.id]?.team_leader_id || ''}
              onChange={e => setHierarchyField(u.id, 'team_leader_id', e.target.value || null)}>
              <option value="">— TL —</option>
              {hManagers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
            </select>
          )}
          {isManagerRole(u.role) && (
            <select style={{ ...S.sInput, width: 150, fontSize: 11, padding: '4px 6px' }}
              value={hEditMap[u.id]?.executive_id || ''}
              onChange={e => setHierarchyField(u.id, 'executive_id', e.target.value || null)}>
              <option value="">— Exec —</option>
              {hExecs.map(ex => <option key={ex.id} value={ex.id}>{ex.first_name} {ex.last_name}</option>)}
            </select>
          )}
          {isExecRole(u.role) && (
            <select style={{ ...S.sInput, width: 150, fontSize: 11, padding: '4px 6px' }}
              value={hEditMap[u.id]?.ceo_id || ''}
              onChange={e => setHierarchyField(u.id, 'ceo_id', e.target.value || null)}>
              <option value="">— CEO —</option>
              {hCeos.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          )}
        </div>
      )}
    </div>
  );

  /* ── Section header ── */
  const sectionHeader = (key: string, label: string, count: number, color: string) => (
    <div onClick={() => toggleCollapse(key)} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)',
      borderRadius: 8, cursor: 'pointer', marginBottom: 6,
      border: `1px solid ${th.border}`, userSelect: 'none',
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: dimText, transition: 'transform .2s',
        transform: hCollapsed[key] ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
      <span style={{ padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
        background: color + '22', color }}>{label}</span>
      <span style={{ fontSize: 12, color: dimText }}>{count} {count === 1 ? 'person' : 'people'}</span>
    </div>
  );

  return (
    <>
      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: gold }}>{t.hierarchy ?? 'Hierarchy'}</h2>
          {hLoading && <span style={{ fontSize: 12, color: dimText }}>Loading...</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={hViewMode === 'macro' ? S.sBtn(gold) : S.sBtnOutline} onClick={() => setHViewMode('macro')}>
            {t.macroView ?? 'Macro View'}
          </button>
          <button style={hViewMode === 'detail' ? S.sBtn(gold) : S.sBtnOutline} onClick={() => setHViewMode('detail')}>
            {t.detailView ?? 'Detail View'}
          </button>
          <span style={{ width: 1, background: th.border, margin: '0 4px' }} />
          <button style={S.sBtnOutline} onClick={expandAll}>{t.expandAll ?? 'Expand All'}</button>
          <button style={S.sBtnOutline} onClick={collapseAll}>{t.collapseAll ?? 'Collapse All'}</button>
          {hDirty && (
            <button style={S.sBtn('#22c55e')} onClick={() => saveHierarchy(t)} disabled={saving}>
              {saving ? '...' : `${t.save ?? 'Save'} (${hChangeCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Role filter */}
      {hViewMode === 'detail' && (
        <div style={{ marginBottom: 12 }}>
          <select style={{ ...S.sInput, maxWidth: 200 }} value={hRoleFilter} onChange={e => setHRoleFilter(e.target.value)}>
            <option value="">{t.allRoles ?? 'All Roles'}</option>
            {hAllRoles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      )}

      {/* ── CEO Level ── */}
      {hCeos.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {sectionHeader('ceo', 'CEO', hCeos.length, '#f59e0b')}
          {!hCollapsed['ceo'] && hCeos.map(u => userCard(u, 0))}
        </div>
      )}

      {/* ── Executives Level ── */}
      {hExecs.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {sectionHeader('executives', t.executives ?? 'Executives', hExecs.length, '#8b5cf6')}
          {!hCollapsed['executives'] && hExecs.map(u => userCard(u, 1))}
        </div>
      )}

      {/* ── Departments ── */}
      {allDepartments.map(dept => {
        const deptUsers = deptMap[dept] || [];
        const deptManagers = deptUsers.filter(u => isManagerRole(u.role));
        const deptEmployees = deptUsers.filter(u => isEmployeeRole(u.role));

        return (
          <div key={dept} style={{ marginBottom: 12 }}>
            {sectionHeader(dept, dept, deptUsers.length, '#3b82f6')}
            {!hCollapsed[dept] && (
              <div style={{ paddingLeft: 12 }}>
                {/* Team Leaders */}
                {deptManagers.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: dimText, letterSpacing: 1, textTransform: 'uppercase', padding: '4px 0', marginLeft: 24 }}>
                      {t.teamLeaders ?? 'Team Leaders'}
                    </div>
                    {deptManagers.map(u => userCard(u, 1))}
                  </div>
                )}

                {hViewMode === 'detail' ? (
                  <>
                    {deptManagers.map(mgr => {
                      const mgrEmployees = deptEmployees.filter(e => hEditMap[e.id]?.team_leader_id === mgr.id);
                      if (mgrEmployees.length === 0) return null;
                      return (
                        <div key={mgr.id} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, color: dimText, marginLeft: 48, padding: '2px 0' }}>
                            ↳ {t.teamOf ?? 'Team of'} {mgr.first_name} {mgr.last_name} ({mgrEmployees.length})
                          </div>
                          {mgrEmployees.filter(u => !hRoleFilter || u.role === hRoleFilter).map(u => userCard(u, 2))}
                        </div>
                      );
                    })}

                    {/* ★ FIX: Unassigned employees — now with remove-from-department button */}
                    {(() => {
                      const unassigned = deptEmployees.filter(
                        e => !hEditMap[e.id]?.team_leader_id || !deptManagers.some(m => m.id === hEditMap[e.id]?.team_leader_id)
                      );
                      if (unassigned.length === 0) return null;
                      return (
                        <div>
                          <div style={{ fontSize: 10, color: '#ef4444', marginLeft: 48, padding: '2px 0', fontWeight: 600 }}>
                            ⚠ {t.unassigned ?? 'Unassigned'} ({unassigned.length})
                          </div>
                          {unassigned.filter(u => !hRoleFilter || u.role === hRoleFilter).map(u => (
                            <div key={u.id} style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '8px 12px', marginLeft: 48,
                              borderLeft: `2px solid #ef444444`,
                              background: isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.01)',
                              borderRadius: 6, marginBottom: 4,
                            }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%', background: `${gold}22`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 14, fontWeight: 700, color: gold, flexShrink: 0,
                              }}>
                                {u.first_name?.[0]}{u.last_name?.[0]}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{u.first_name} {u.last_name}</div>
                                <div style={{ fontSize: 11, color: dimText }}>{u.role} • {(u.departments || []).join(', ') || '—'}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                {/* Assign to team leader */}
                                <select style={{ ...S.sInput, width: 150, fontSize: 11, padding: '4px 6px' }}
                                  value={hEditMap[u.id]?.team_leader_id || ''}
                                  onChange={e => setHierarchyField(u.id, 'team_leader_id', e.target.value || null)}>
                                  <option value="">— TL —</option>
                                  {deptManagers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                                </select>
                                {/* ★ Remove from department entirely */}
                                <button
                                  style={{ ...S.sBtn('#ef4444'), padding: '4px 10px', fontSize: 11 }}
                                  title={t.removeFromDepartment ?? 'Remove from department'}
                                  onClick={() => removeFromDepartment(u.id, dept, t)}
                                  disabled={saving}>
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div style={{ padding: '6px 12px', marginLeft: 24, fontSize: 13, color: dimText }}>
                    {deptManagers.length} {t.teamLeaders ?? 'Team Leaders'} • {deptEmployees.length} {t.employees ?? 'Employees'}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
