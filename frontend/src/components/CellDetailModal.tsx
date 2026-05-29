// frontend/src/components/CellDetailModal.tsx
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { themes, ABS } from '../i18n/translations';
import { getTranslations, type LangCode } from '../i18n';

/* ─── Types ─── */
interface Task {
  id: string; code: string; name: string; color: string;
  schedule_type: string; status?: string;
  customer?: { id: string; name: string } | null;
}
interface Machine {
  id: string; name: string; category: string; inventory_nr?: string;
  tonnage?: number; is_active?: boolean; status?: string;
}
interface Allocation {
  id: string; user_id: string; task_id: string;
  day_of_week: number; week_id: string; time_slot: number;
}
interface MachineAllocation {
  id: string; machine_id: string; site_id?: string;
  user_id?: string;
  week_id: string; day_of_week: number;
  machine?: Machine;
}
interface Absence {
  id: string; user_id: string; date: string;
  absence_code: number; source?: string; notes?: string;
}
interface CellUser {
  id: string; first_name: string; last_name: string; department: string;
}

type Theme = typeof themes.dark;

export interface CellDetailModalProps {
  user: CellUser;
  day: number;
  dayLabel: string;
  dateLabel: string;
  dateISO: string;

  allocations: Allocation[];
  tasks: Task[];
  taskById: Record<string, Task>;
  machines: Machine[];
  machineAllocations: MachineAllocation[];
  absences: Absence[];
  activeTaskIds: Set<string>;
  weekIds: string[];

  /* ★ NEW: all machine allocations for the entire week — for conflict checking */
  allWeekMachineAllocations: MachineAllocation[];

  canEdit: boolean;
  isDark: boolean;
  th: Theme;
  lang: string;
  gold: string;

  authHeaders: Record<string, string>;
  apiUrl: string;

  onClose: () => void;
  onRefresh: () => Promise<void>;
  showToast: (msg: string, err?: boolean) => void;
  getTaskColor: (taskId: string) => string;
}

export function CellDetailModal(props: CellDetailModalProps) {
  const {
    user: emp, day, dayLabel, dateLabel, dateISO,
    allocations, tasks, taskById, machines, machineAllocations, absences,
    activeTaskIds, weekIds,
    allWeekMachineAllocations,
    canEdit, isDark, th, lang, gold,
    authHeaders, apiUrl,
    onClose, onRefresh, showToast, getTaskColor,
  } = props;

  const t = getTranslations(lang as LangCode);
  const modalRef = useRef<HTMLDivElement>(null);

  /* ─── Tabs ─── */
  const [activeTab, setActiveTab] = useState<'tasks' | 'machines' | 'absences'>('tasks');
  const [taskSearch, setTaskSearch] = useState('');
  const [machineSearch, setMachineSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const taskSearchRef = useRef<HTMLInputElement>(null);
  const machSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 'tasks') taskSearchRef.current?.focus();
    if (activeTab === 'machines') machSearchRef.current?.focus();
  }, [activeTab]);

  /* ─── Cell data ─── */
  const cellTasks = allocations;
  const cellMachines = machineAllocations;
  const cellAbsences = absences;

  /* ★ Build a set of machine IDs already allocated on this day (any user) */
  const machinesAllocatedThisDay = useMemo(() => {
    const set = new Set<string>();
    for (const ma of allWeekMachineAllocations) {
      if (ma.day_of_week === day) {
        set.add(ma.machine_id);
      }
    }
    return set;
  }, [allWeekMachineAllocations, day]);

  /* ─── Filtered task list ─── */
  const filteredTasks = useMemo(() => {
    const s = taskSearch.toLowerCase();
    let list = tasks.filter(tk => tk.status !== 'CANCELLED');
    if (s) {
      list = list.filter(tk =>
        tk.name.toLowerCase().includes(s) ||
        tk.code.toLowerCase().includes(s) ||
        (tk.customer?.name || '').toLowerCase().includes(s)
      );
    }
    const assignedIds = new Set(cellTasks.map(a => a.task_id));
    list.sort((a, b) => {
      const aAssigned = assignedIds.has(a.id) ? 1 : 0;
      const bAssigned = assignedIds.has(b.id) ? 1 : 0;
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;
      const aUsed = activeTaskIds.has(a.id) ? 0 : 1;
      const bUsed = activeTaskIds.has(b.id) ? 0 : 1;
      if (aUsed !== bUsed) return aUsed - bUsed;
      return a.name.localeCompare(b.name);
    });
    return list.slice(0, 40);
  }, [taskSearch, tasks, cellTasks, activeTaskIds]);

  /* ★ Filtered machine list — shows availability status */
  const filteredMachines = useMemo(() => {
    const s = machineSearch.toLowerCase();
    let list = machines.filter(m => m.is_active !== false);
    if (s) {
      list = list.filter(m =>
        m.name.toLowerCase().includes(s) ||
        m.category.toLowerCase().includes(s) ||
        (m.inventory_nr || '').toLowerCase().includes(s)
      );
    }

    // IDs assigned to THIS cell (this user + this day)
    const assignedToThisCell = new Set(cellMachines.map(ma => ma.machine_id));

    // Sort: assigned to cell first (for display), then available, then taken by others
    list.sort((a, b) => {
      const aInCell = assignedToThisCell.has(a.id) ? 0 : 1;
      const bInCell = assignedToThisCell.has(b.id) ? 0 : 1;
      if (aInCell !== bInCell) return aInCell - bInCell;

      const aTaken = machinesAllocatedThisDay.has(a.id) ? 1 : 0;
      const bTaken = machinesAllocatedThisDay.has(b.id) ? 1 : 0;
      if (aTaken !== bTaken) return aTaken - bTaken;

      return a.name.localeCompare(b.name);
    });
    return list.slice(0, 40);
  }, [machineSearch, machines, cellMachines, machinesAllocatedThisDay]);

  /* ─── Actions ─── */
  const addTask = async (taskId: string) => {
    if (!canEdit || saving) return;
    if (cellTasks.length >= 2) {
      showToast(t.max2 ?? 'Max 2 tasks per cell', true);
      return;
    }
    if (cellTasks.some(a => a.task_id === taskId)) return;

    setSaving(true);
    const task = taskById[taskId];
    const weekId = weekIds[0];

    if (!weekId) {
      showToast(t.weekNotFound ?? 'Week not found', true);
      setSaving(false);
      return;
    }

    try {
      const r = await fetch(`${apiUrl}/api/v1/allocations`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({
          user_id: emp.id, task_id: taskId,
          day_of_week: day, week_id: weekId,
          time_slot: cellTasks.length + 1,
        }),
      });
      if (r.ok) {
        showToast(`${task?.name || ''} → ${emp.first_name}`);
        await onRefresh();
      } else {
        const err = await r.json().catch(() => ({}));
        showToast(err.message || t.error || 'Error', true);
      }
    } catch { showToast(t.networkError ?? 'Network error', true); }
    setSaving(false);
  };

  const removeTask = async (allocId: string) => {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const r = await fetch(`${apiUrl}/api/v1/allocations/${allocId}`, {
        method: 'DELETE', headers: authHeaders,
      });
      if (r.ok) {
        showToast(t.removed ?? 'Removed');
        await onRefresh();
      } else {
        const err = await r.json().catch(() => ({}));
        showToast(err.message || t.error || 'Error', true);
      }
    } catch { showToast(t.networkError ?? 'Network error', true); }
    setSaving(false);
  };

  /* ★ FIXED addMachine — sends userId, handles all responses with clear feedback */
  const addMachine = async (machineId: string) => {
    if (!canEdit || saving) return;

    // ★ Client-side conflict check — don't even try if already allocated this day
    if (machinesAllocatedThisDay.has(machineId)) {
      const machine = machines.find(m => m.id === machineId);
      showToast(`🚜 ${machine?.name || ''} — ${t.machineConflict ?? 'Already allocated this day'}`, true);
      return;
    }

    setSaving(true);
    const weekId = weekIds[0];
    if (!weekId) {
      showToast(t.weekNotFound ?? 'Week not found', true);
      setSaving(false);
      return;
    }

    const siteId = cellTasks[0]?.task_id || undefined;

    try {
      const r = await fetch(`${apiUrl}/api/v1/machines/allocations`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({
          machineId,
          siteId,
          weekId,
          dayOfWeek: day,
          userId: emp.id,       // ★ FIX #1: link machine to this employee
        }),
      });

      if (r.ok) {
        const machine = machines.find(m => m.id === machineId);
        showToast(`🚜 ${machine?.name || ''} → ${emp.first_name}`);
        await onRefresh();
      } else {
        // ★ FIX #3: always read and display the error
        const err = await r.json().catch(() => ({ message: `HTTP ${r.status}` }));
        if (r.status === 409) {
          showToast(`🚜 ${t.machineConflict ?? 'Machine already allocated on this day'}`, true);
        } else if (r.status === 400) {
          showToast(`⚠️ ${err.message || 'Bad request'}`, true);
        } else {
          showToast(`❌ ${err.message || t.error || 'Error'}`, true);
        }
      }
    } catch {
      showToast(t.networkError ?? 'Network error', true);
    }
    setSaving(false);
  };

  const removeMachine = async (allocId: string) => {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const r = await fetch(`${apiUrl}/api/v1/machines/allocations/${allocId}`, {
        method: 'DELETE', headers: authHeaders,
      });
      if (r.ok) {
        showToast(t.removed ?? 'Removed');
        await onRefresh();
      } else {
        const err = await r.json().catch(() => ({}));
        showToast(err.message || t.error || 'Error', true);
      }
    } catch { showToast(t.networkError ?? 'Network error', true); }
    setSaving(false);
  };

  const addAbsence = async (code: string) => {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const r = await fetch(`${apiUrl}/api/v1/absences`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({
          user_id: emp.id,
          date: dateISO,
          absence_code: parseInt(code),
          source: 'MANUAL',
        }),
      });
      if (r.ok) {
        const absLabel = (t.abs as any)?.[code] ?? `Absence ${code}`;
        showToast(`${absLabel} → ${emp.first_name}`);
        await onRefresh();
      } else {
        const err = await r.json().catch(() => ({}));
        showToast(err.message || t.error || 'Error', true);
      }
    } catch { showToast(t.networkError ?? 'Network error', true); }
    setSaving(false);
  };

  const removeAbsence = async (absId: string) => {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const r = await fetch(`${apiUrl}/api/v1/absences/${absId}`, {
        method: 'DELETE', headers: authHeaders,
      });
      if (r.ok) {
        showToast(t.removed ?? 'Removed');
        await onRefresh();
      } else {
        const err = await r.json().catch(() => ({}));
        showToast(err.message || t.error || 'Error', true);
      }
    } catch { showToast(t.networkError ?? 'Network error', true); }
    setSaving(false);
  };

  /* ─── Styles ─── */
  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: active ? 700 : 500,
    background: active ? gold : 'transparent',
    color: active ? (isDark ? '#0a0a0a' : '#fff') : (th as any).textMuted,
    borderRadius: active ? 8 : 0,
    transition: 'all .2s',
  });

  const itemRow: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', borderRadius: 8,
    background: isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)',
    marginBottom: 6, transition: 'background .15s',
  };

  const removeBtn: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 6, border: 'none',
    background: isDark ? 'rgba(239,68,68,.15)' : 'rgba(239,68,68,.1)',
    color: '#ef4444', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'all .15s',
  };

  const addItemRow: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 14px', borderRadius: 6, cursor: 'pointer',
    transition: 'background .1s', marginBottom: 2,
  };

  const badge = (color: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
  });

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: isDark ? 'rgba(0,0,0,.65)' : 'rgba(0,0,0,.35)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, animation: 'cdm-fadeIn .2s ease',
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        onClick={e => e.stopPropagation()}
        style={{
          width: '95%', maxWidth: 520,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          background: (th as any).bgCard, border: `1px solid ${(th as any).border}`,
          borderRadius: 16,
          boxShadow: isDark
            ? '0 24px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(200,169,110,.08)'
            : '0 24px 80px rgba(0,0,0,.12)',
          overflow: 'hidden',
          animation: 'cdm-scaleIn .2s ease',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: `1px solid ${(th as any).border}`,
          background: isDark ? 'rgba(200,169,110,.04)' : 'rgba(200,169,110,.03)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: (th as any).text, lineHeight: 1.3 }}>
                {emp.first_name} {emp.last_name}
              </div>
              <div style={{ fontSize: 13, color: gold, fontWeight: 600, marginTop: 2 }}>
                {dayLabel} · {dateLabel}
              </div>
              <div style={{
                fontSize: 10, color: (th as any).textMuted, fontWeight: 600,
                letterSpacing: 1, textTransform: 'uppercase', marginTop: 4,
              }}>
                {emp.department === 'garten' ? 'Garten & Tiefbau' : emp.department === 'unterhalt' ? 'Unterhalt' : emp.department}
              </div>
            </div>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 8, border: `1px solid ${(th as any).border}`,
              background: 'transparent', color: (th as any).textMuted, fontSize: 16,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .15s',
            }}>✕</button>
          </div>

          {/* ── Summary badges ── */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: `${gold}18`, color: gold, border: `1px solid ${gold}25`,
            }}>
              📋 {cellTasks.length} {t.tasks ?? 'tasks'}
            </span>
            <span style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: isDark ? 'rgba(66,165,245,.12)' : 'rgba(66,165,245,.08)',
              color: '#42a5f5', border: '1px solid rgba(66,165,245,.2)',
            }}>
              🚜 {cellMachines.length} {t.machines ?? 'machines'}
            </span>
            {cellAbsences.length > 0 && (
              <span style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: isDark ? 'rgba(255,107,107,.12)' : 'rgba(255,107,107,.08)',
                color: '#ff6b6b', border: '1px solid rgba(255,107,107,.2)',
              }}>
                🏥 {cellAbsences.length} {t.absences ?? 'absences'}
              </span>
            )}
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div style={{
          display: 'flex', gap: 4, padding: '8px 12px',
          background: isDark ? 'rgba(0,0,0,.15)' : 'rgba(0,0,0,.02)',
        }}>
          <button style={tabBtn(activeTab === 'tasks')} onClick={() => setActiveTab('tasks')}>
            📋 {t.tasks ?? 'Tasks'}
          </button>
          <button style={tabBtn(activeTab === 'machines')} onClick={() => setActiveTab('machines')}>
            🚜 {t.machines ?? 'Machines'}
          </button>
          <button style={tabBtn(activeTab === 'absences')} onClick={() => setActiveTab('absences')}>
            🏥 {t.absences ?? 'Absences'}
          </button>
        </div>

        {/* ── Content ── */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '12px 16px',
          opacity: saving ? 0.6 : 1,
          pointerEvents: saving ? 'none' : 'auto',
        }}>

          {/* ═══ TASKS TAB ═══ */}
          {activeTab === 'tasks' && (
            <>
              {cellTasks.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: (th as any).textMuted,
                    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
                  }}>{t.assigned ?? 'Assigned'}</div>
                  {cellTasks.map(alloc => {
                    const task = taskById[alloc.task_id];
                    const color = getTaskColor(alloc.task_id);
                    return (
                      <div key={alloc.id} style={itemRow}>
                        <div style={{ width: 4, height: 36, borderRadius: 4, background: color, flexShrink: 0 }} />
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: (th as any).text,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {task?.name || '?'}
                          </div>
                          <div style={{ fontSize: 10, color: (th as any).textMuted }}>
                            {task?.code || ''} · {task?.schedule_type === 'UNTERHALT' ? 'UH' : 'GT'}
                            {task?.customer ? ` · ${task.customer.name}` : ''}
                          </div>
                        </div>
                        {canEdit && (
                          <button style={removeBtn} onClick={() => removeTask(alloc.id)}
                            title={t.remove ?? 'Remove'}>✕</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {canEdit && cellTasks.length < 2 && (
                <div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: gold,
                    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
                  }}>{t.addTask ?? 'Add Task'}</div>
                  <input
                    ref={taskSearchRef}
                    placeholder={t.searchTasks ?? 'Search tasks...'}
                    value={taskSearch}
                    onChange={e => setTaskSearch(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      border: `1px solid ${(th as any).border}`,
                      background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)',
                      color: (th as any).text, fontSize: 12, outline: 'none', marginBottom: 8,
                    }}
                  />
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {filteredTasks.map(task => {
                      const color = getTaskColor(task.id);
                      const isAssigned = cellTasks.some(a => a.task_id === task.id);
                      return (
                        <div
                          key={task.id}
                          onClick={() => !isAssigned && addTask(task.id)}
                          style={{
                            ...addItemRow,
                            opacity: isAssigned ? 0.4 : 1,
                            cursor: isAssigned ? 'default' : 'pointer',
                          }}
                          onMouseEnter={e => { if (!isAssigned) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div style={badge(color)} />
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: (th as any).text,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {task.name}
                            </div>
                            <div style={{ fontSize: 9, color: (th as any).textMuted }}>
                              {task.code} · {task.schedule_type === 'UNTERHALT' ? 'UH' : 'GT'}
                              {task.customer ? ` · ${task.customer.name}` : ''}
                            </div>
                          </div>
                          {isAssigned && <span style={{ color: gold, fontSize: 13 }}>✓</span>}
                          {!isAssigned && activeTaskIds.has(task.id) && (
                            <span style={{
                              fontSize: 8, color: (th as any).textMuted,
                              background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)',
                              padding: '2px 6px', borderRadius: 4,
                            }}>KW</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {canEdit && cellTasks.length >= 2 && (
                <div style={{ fontSize: 12, color: (th as any).textMuted, textAlign: 'center', padding: 12 }}>
                  {t.max2 ?? 'Maximum 2 tasks per cell'}
                </div>
              )}
            </>
          )}

          {/* ═══ MACHINES TAB ═══ */}
          {activeTab === 'machines' && (
            <>
              {/* ★ Currently assigned to THIS cell */}
              {cellMachines.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: (th as any).textMuted,
                    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
                  }}>{t.assigned ?? 'Assigned'}</div>
                  {cellMachines.map(ma => {
                    const machine = ma.machine || machines.find(m => m.id === ma.machine_id);
                    return (
                      <div key={ma.id} style={itemRow}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: isDark ? 'rgba(66,165,245,.12)' : 'rgba(66,165,245,.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, flexShrink: 0,
                        }}>🚜</div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: (th as any).text,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {machine?.name || '?'}
                          </div>
                          <div style={{ fontSize: 10, color: (th as any).textMuted }}>
                            {machine?.category || ''}{machine?.inventory_nr ? ` · #${machine.inventory_nr}` : ''}
                            {machine?.tonnage ? ` · ${machine.tonnage}t` : ''}
                          </div>
                        </div>
                        {canEdit && (
                          <button style={removeBtn} onClick={() => removeMachine(ma.id)}
                            title={t.remove ?? 'Remove'}>✕</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ★ Add machine — with availability status */}
              {canEdit && (
                <div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: '#42a5f5',
                    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
                  }}>{t.addMachine ?? 'Add Machine'}</div>
                  <input
                    ref={machSearchRef}
                    placeholder={t.searchMachines ?? 'Search machines...'}
                    value={machineSearch}
                    onChange={e => setMachineSearch(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      border: `1px solid ${(th as any).border}`,
                      background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)',
                      color: (th as any).text, fontSize: 12, outline: 'none', marginBottom: 8,
                    }}
                  />
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {filteredMachines.map(machine => {
                      const isInThisCell = cellMachines.some(ma => ma.machine_id === machine.id);
                      const isTakenByOther = !isInThisCell && machinesAllocatedThisDay.has(machine.id);
                      const isUnavailable = isInThisCell || isTakenByOther;

                      return (
                        <div
                          key={machine.id}
                          onClick={() => !isUnavailable && addMachine(machine.id)}
                          style={{
                            ...addItemRow,
                            opacity: isUnavailable ? 0.4 : 1,
                            cursor: isUnavailable ? 'default' : 'pointer',
                            background: isTakenByOther
                              ? (isDark ? 'rgba(239,68,68,.06)' : 'rgba(239,68,68,.04)')
                              : 'transparent',
                          }}
                          onMouseEnter={e => {
                            if (!isUnavailable) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = isTakenByOther
                              ? (isDark ? 'rgba(239,68,68,.06)' : 'rgba(239,68,68,.04)')
                              : 'transparent';
                          }}
                        >
                          <span style={{ fontSize: 14 }}>🚜</span>
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: (th as any).text,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {machine.name}
                            </div>
                            <div style={{ fontSize: 9, color: (th as any).textMuted }}>
                              {machine.category}{machine.inventory_nr ? ` · #${machine.inventory_nr}` : ''}
                              {machine.tonnage ? ` · ${machine.tonnage}t` : ''}
                            </div>
                          </div>
                          {/* ★ Status indicators */}
                          {isInThisCell && <span style={{ color: '#42a5f5', fontSize: 13 }}>✓</span>}
                          {isTakenByOther && (
                            <span style={{
                              fontSize: 9, color: '#ef4444', fontWeight: 700,
                              background: isDark ? 'rgba(239,68,68,.15)' : 'rgba(239,68,68,.1)',
                              padding: '2px 8px', borderRadius: 4,
                            }}>
                              {t.machineInUse ?? 'In Use'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══ ABSENCES TAB ═══ */}
          {activeTab === 'absences' && (
            <>
              {cellAbsences.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: (th as any).textMuted,
                    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
                  }}>{t.current ?? 'Current'}</div>
                  {cellAbsences.map(abs => {
                    const code = String(abs.absence_code);
                    const absInfo = ABS[code as unknown as keyof typeof ABS];
                    const absLabel = (t.abs as any)?.[code] ?? `Absence ${code}`;
                    return (
                      <div key={abs.id} style={itemRow}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: `${absInfo?.bg || '#666'}22`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, flexShrink: 0,
                        }}>{absInfo?.icon || '?'}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: (th as any).text }}>{absLabel}</div>
                          <div style={{ fontSize: 10, color: (th as any).textMuted }}>
                            {abs.source || 'MANUAL'}{abs.notes ? ` · ${abs.notes}` : ''}
                          </div>
                        </div>
                        {canEdit && (
                          <button style={removeBtn} onClick={() => removeAbsence(abs.id)}
                            title={t.remove ?? 'Remove'}>✕</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {canEdit && (
                <div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: '#ff6b6b',
                    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10,
                  }}>{t.setAbsence ?? 'Set Absence'}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {Object.entries(t.abs || {}).map(([code, label]) => {
                      const absInfo = ABS[code as unknown as keyof typeof ABS];
                      const alreadySet = cellAbsences.some(a => String(a.absence_code) === code);
                      return (
                        <button
                          key={code}
                          onClick={() => !alreadySet && addAbsence(code)}
                          disabled={alreadySet}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                            padding: '10px 14px', borderRadius: 8, border: 'none',
                            background: alreadySet
                              ? (isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)')
                              : (isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)'),
                            borderLeft: `4px solid ${absInfo?.bg || '#666'}`,
                            cursor: alreadySet ? 'default' : 'pointer',
                            opacity: alreadySet ? 0.4 : 1,
                            color: (th as any).text, fontSize: 13, fontWeight: 500,
                            transition: 'background .15s', textAlign: 'left',
                          }}
                        >
                          <span style={{ fontSize: 16 }}>{absInfo?.icon || '?'}</span>
                          <span>{label as string}</span>
                          {alreadySet && <span style={{ marginLeft: 'auto', fontSize: 12, color: gold }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
