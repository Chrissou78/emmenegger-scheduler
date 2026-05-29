// frontend/src/components/CellDetailModal.tsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { themes, ABS } from '../i18n/translations';
import { getTranslations, type LangCode } from '../i18n';
import type { Job, JobMachine, Task, Customer, Machine } from '../types/job';

/* ─── Types ─── */
interface Absence {
  id: string; user_id: string; date: string;
  absence_code: number; source?: string; notes?: string;
}
interface CellUser {
  id: string; first_name: string; last_name: string; department: string;
}

type Theme = typeof themes.dark;
type WizardStep = 'task' | 'customer' | 'machines' | 'confirm';

export interface CellDetailModalProps {
  user: CellUser;
  day: number;
  dayLabel: string;
  dateLabel: string;
  dateISO: string;

  jobs: Job[];
  tasks: Task[];
  customers: Customer[];
  machines: Machine[];
  absences: Absence[];
  activeTaskIds: Set<string>;
  weekIds: string[];

  allWeekJobs: Job[];

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
    jobs, tasks, customers, machines, absences,
    activeTaskIds, weekIds,
    allWeekJobs,
    canEdit, isDark, th, lang, gold,
    authHeaders, apiUrl,
    onClose, onRefresh, showToast, getTaskColor,
  } = props;

  const t = getTranslations(lang as LangCode);
  const modalRef = useRef<HTMLDivElement>(null);

  /* ─── State ─── */
  const [saving, setSaving] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('task');

  // Wizard selections
  const [wizTaskId, setWizTaskId] = useState('');
  const [wizCustomerId, setWizCustomerId] = useState<string | null>(null);
  const [wizMachineIds, setWizMachineIds] = useState<string[]>([]);

  // Search fields
  const [taskSearch, setTaskSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [machineSearch, setMachineSearch] = useState('');

  const taskSearchRef = useRef<HTMLInputElement>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const machineSearchRef = useRef<HTMLInputElement>(null);

  // Focus search on step change
  useEffect(() => {
    if (wizardStep === 'task') taskSearchRef.current?.focus();
    if (wizardStep === 'customer') customerSearchRef.current?.focus();
    if (wizardStep === 'machines') machineSearchRef.current?.focus();
  }, [wizardStep, showWizard]);

  /* ─── Derived ─── */
  const cellJobs = jobs;
  const cellAbsences = absences;

  // Machines allocated this day across ALL users (for conflict detection)
  const machinesAllocatedThisDay = useMemo(() => {
    const set = new Set<string>();
    for (const job of allWeekJobs) {
      if (job.day_of_week === day && job.machines) {
        for (const jm of job.machines) {
          set.add(jm.machine_id);
        }
      }
    }
    return set;
  }, [allWeekJobs, day]);

  // Machine IDs in THIS cell
  const cellMachineIds = useMemo(() => {
    const set = new Set<string>();
    for (const job of cellJobs) {
      if (job.machines) {
        for (const jm of job.machines) set.add(jm.machine_id);
      }
    }
    return set;
  }, [cellJobs]);

  /* ─── Wizard: selected task details ─── */
  const wizTask = useMemo(() => tasks.find(tk => tk.id === wizTaskId), [tasks, wizTaskId]);
  const wizCustomer = useMemo(() => customers.find(c => c.id === wizCustomerId), [customers, wizCustomerId]);

  /* ─── Filtered lists ─── */
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
    const assignedIds = new Set(cellJobs.map(j => j.task_id));
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
  }, [taskSearch, tasks, cellJobs, activeTaskIds]);

  const filteredCustomers = useMemo(() => {
    const s = customerSearch.toLowerCase();
    let list = customers;
    if (s) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(s) ||
        (c.company_name || '').toLowerCase().includes(s) ||
        (c.city || '').toLowerCase().includes(s)
      );
    }
    return list.slice(0, 40);
  }, [customerSearch, customers]);

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
    list.sort((a, b) => {
      const aSelected = wizMachineIds.includes(a.id) ? 0 : 1;
      const bSelected = wizMachineIds.includes(b.id) ? 0 : 1;
      if (aSelected !== bSelected) return aSelected - bSelected;
      const aTaken = machinesAllocatedThisDay.has(a.id) && !cellMachineIds.has(a.id) ? 1 : 0;
      const bTaken = machinesAllocatedThisDay.has(b.id) && !cellMachineIds.has(b.id) ? 1 : 0;
      if (aTaken !== bTaken) return aTaken - bTaken;
      return a.name.localeCompare(b.name);
    });
    return list.slice(0, 40);
  }, [machineSearch, machines, wizMachineIds, machinesAllocatedThisDay, cellMachineIds]);

  /* ─── Wizard: Start ─── */
  const startWizard = () => {
    setWizTaskId('');
    setWizCustomerId(null);
    setWizMachineIds([]);
    setWizardStep('task');
    setTaskSearch('');
    setCustomerSearch('');
    setMachineSearch('');
    setShowWizard(true);
  };

  /* ─── Wizard: Select Task → auto-fill customer from task ─── */
  const selectWizTask = (taskId: string) => {
    setWizTaskId(taskId);
    const task = tasks.find(tk => tk.id === taskId);
    if (task?.customer) {
      setWizCustomerId(task.customer.id);
    } else {
      setWizCustomerId(null);
    }
    setWizardStep('customer');
  };

  /* ─── Wizard: Save Job ─── */
  const saveJob = async () => {
    if (!wizTaskId || saving) return;
    setSaving(true);

    const weekId = weekIds[0];
    if (!weekId) {
      showToast(t.weekNotFound ?? 'Week not found', true);
      setSaving(false);
      return;
    }

    try {
      const r = await fetch(`${apiUrl}/api/v1/jobs`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          weekId,
          userId: emp.id,
          dayOfWeek: day,
          timeSlot: cellJobs.length + 1,
          taskId: wizTaskId,
          customerId: wizCustomerId,
          machineIds: wizMachineIds,
        }),
      });

      if (r.ok) {
        const taskName = wizTask?.name || '';
        showToast(`${taskName} → ${emp.first_name}`);
        setShowWizard(false);
        await onRefresh();
      } else {
        const err = await r.json().catch(() => ({}));
        if (r.status === 409) {
          showToast(err.error || (t.maxJobs ?? 'Maximum 2 jobs per cell'), true);
        } else {
          showToast(err.error || err.message || t.error || 'Error', true);
        }
      }
    } catch { showToast(t.networkError ?? 'Network error', true); }
    setSaving(false);
  };

  /* ─── Remove Job ─── */
  const removeJob = async (jobId: string) => {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const r = await fetch(`${apiUrl}/api/v1/jobs/${jobId}`, {
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

  /* ─── Add Machine to existing Job ─── */
  const addMachineToJob = async (jobId: string, machineId: string) => {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const r = await fetch(`${apiUrl}/api/v1/jobs/${jobId}/machines`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ machineId }),
      });
      if (r.ok) {
        const mc = machines.find(m => m.id === machineId);
        showToast(`🚜 ${mc?.name || ''} → ${emp.first_name}`);
        await onRefresh();
      } else {
        const err = await r.json().catch(() => ({}));
        showToast(err.error || 'Error', true);
      }
    } catch { showToast(t.networkError ?? 'Network error', true); }
    setSaving(false);
  };

  /* ─── Remove Machine from Job ─── */
  const removeMachineFromJob = async (jobId: string, jobMachineId: string) => {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const r = await fetch(`${apiUrl}/api/v1/jobs/${jobId}/machines/${jobMachineId}`, {
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

  /* ─── Absence actions ─── */
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
        showToast(`${(t.abs as any)?.[code] ?? `Absence ${code}`} → ${emp.first_name}`);
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

  const stepIndicator = (step: WizardStep, label: string, num: number) => {
    const isActive = wizardStep === step;
    const isPast = (
      (step === 'task' && ['customer', 'machines', 'confirm'].includes(wizardStep)) ||
      (step === 'customer' && ['machines', 'confirm'].includes(wizardStep)) ||
      (step === 'machines' && wizardStep === 'confirm')
    );
    return (
      <div key={step} style={{
        display: 'flex', alignItems: 'center', gap: 6, opacity: isActive ? 1 : isPast ? 0.7 : 0.35,
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isActive ? gold : isPast ? `${gold}40` : (isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.06)'),
          color: isActive ? (isDark ? '#0a0a0a' : '#fff') : isPast ? gold : (th as any).textMuted,
        }}>{isPast ? '✓' : num}</div>
        <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? gold : (th as any).textMuted }}>{label}</span>
      </div>
    );
  };

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
          width: '95%', maxWidth: 560,
          maxHeight: '88vh', display: 'flex', flexDirection: 'column',
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
            }}>✕</button>
          </div>

          {/* Summary badges */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: `${gold}18`, color: gold, border: `1px solid ${gold}25`,
            }}>
              📋 {cellJobs.length} {t.jobs ?? 'Jobs'}
            </span>
            <span style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: isDark ? 'rgba(66,165,245,.12)' : 'rgba(66,165,245,.08)',
              color: '#42a5f5', border: '1px solid rgba(66,165,245,.2)',
            }}>
              🚜 {cellJobs.reduce((s, j) => s + (j.machines?.length || 0), 0)} {t.machines ?? 'machines'}
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

        {/* ── Content ── */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '12px 16px',
          opacity: saving ? 0.6 : 1,
          pointerEvents: saving ? 'none' : 'auto',
        }}>

          {/* ═══ EXISTING JOBS ═══ */}
          {!showWizard && cellJobs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: (th as any).textMuted,
                letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
              }}>{t.jobs ?? 'Jobs'}</div>
              {cellJobs.map(job => {
                const task = job.task || tasks.find(tk => tk.id === job.task_id);
                const color = getTaskColor(job.task_id);
                const customer = job.task?.customer;
                const jobMachines = job.machines || [];

                return (
                  <div key={job.id} style={{
                    ...itemRow,
                    flexDirection: 'column', alignItems: 'stretch', gap: 6,
                    borderLeft: `4px solid ${color}`,
                    padding: '12px 14px',
                  }}>
                    {/* Job header: task + remove */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{
                          fontSize: 14, fontWeight: 700, color: (th as any).text,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {task?.name || '?'}
                        </div>
                        <div style={{ fontSize: 10, color: (th as any).textMuted, marginTop: 1 }}>
                          {task?.code || ''} · {task?.schedule_type === 'UNTERHALT' ? 'UH' : 'GT'}
                          · Slot {job.time_slot}
                        </div>
                      </div>
                      {canEdit && (
                        <button style={removeBtn} onClick={() => removeJob(job.id)} title={t.remove ?? 'Remove'}>✕</button>
                      )}
                    </div>

                    {/* Customer */}
                    {customer ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 8px', borderRadius: 6,
                        background: isDark ? 'rgba(200,169,110,.08)' : 'rgba(200,169,110,.05)',
                      }}>
                        <span style={{ fontSize: 12 }}>👤</span>
                        <div style={{ fontSize: 11, fontWeight: 600, color: gold }}>
                          {customer.name}
                          {customer.city && <span style={{ fontWeight: 400, color: (th as any).textMuted }}> · {customer.city}</span>}
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 8px', borderRadius: 6,
                        background: isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)',
                      }}>
                        <span style={{ fontSize: 12 }}>🏭</span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: (th as any).textMuted, fontStyle: 'italic' }}>
                          {t.intern ?? 'Internal'}
                        </span>
                      </div>
                    )}

                    {/* Machines */}
                    {jobMachines.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {jobMachines.map(jm => {
                          const mc = jm.machine || machines.find(m => m.id === jm.machine_id);
                          return (
                            <div key={jm.id} style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              padding: '3px 8px', borderRadius: 4,
                              background: isDark ? 'rgba(66,165,245,.1)' : 'rgba(66,165,245,.06)',
                              fontSize: 10, fontWeight: 600, color: '#42a5f5',
                            }}>
                              🚜 {mc?.name || '?'}
                              {canEdit && (
                                <span
                                  style={{ cursor: 'pointer', fontSize: 12, marginLeft: 2, color: '#ef4444' }}
                                  onClick={() => removeMachineFromJob(job.id, jm.id)}
                                >×</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add machine to this job */}
                    {canEdit && (
                      <MachineAdder
                        jobId={job.id}
                        machines={machines}
                        machinesAllocatedThisDay={machinesAllocatedThisDay}
                        cellMachineIds={cellMachineIds}
                        isDark={isDark}
                        th={th}
                        gold={gold}
                        t={t}
                        onAdd={(machineId) => addMachineToJob(job.id, machineId)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ ADD JOB BUTTON ═══ */}
          {!showWizard && canEdit && cellJobs.length < 2 && (
            <button
              onClick={startWizard}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: `2px dashed ${gold}40`,
                background: isDark ? 'rgba(200,169,110,.05)' : 'rgba(200,169,110,.03)',
                color: gold, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                transition: 'all .15s', marginBottom: 16,
              }}
            >
              + {t.addJob ?? 'Add Job'}
            </button>
          )}

          {!showWizard && canEdit && cellJobs.length >= 2 && (
            <div style={{ fontSize: 12, color: (th as any).textMuted, textAlign: 'center', padding: 12, marginBottom: 16 }}>
              {t.maxJobs ?? 'Maximum 2 jobs per cell'}
            </div>
          )}

          {/* ═══ WIZARD ═══ */}
          {showWizard && (
            <div style={{ marginBottom: 16 }}>
              {/* Step indicators */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                {stepIndicator('task', t.pickTask ?? 'Task', 1)}
                <span style={{ color: (th as any).textMuted, fontSize: 10 }}>→</span>
                {stepIndicator('customer', t.pickCustomer ?? 'Customer', 2)}
                <span style={{ color: (th as any).textMuted, fontSize: 10 }}>→</span>
                {stepIndicator('machines', t.pickMachines ?? 'Machines', 3)}
                <span style={{ color: (th as any).textMuted, fontSize: 10 }}>→</span>
                {stepIndicator('confirm', t.saveJob ?? 'Save', 4)}
              </div>

              {/* ── STEP 1: Pick Task ── */}
              {wizardStep === 'task' && (
                <div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: gold,
                    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
                  }}>{t.pickTask ?? 'Select Task'}</div>
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
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                    {filteredTasks.map(task => {
                      const color = getTaskColor(task.id);
                      const isAssigned = cellJobs.some(j => j.task_id === task.id);
                      return (
                        <div key={task.id}
                          onClick={() => !isAssigned && selectWizTask(task.id)}
                          style={{
                            ...addItemRow,
                            opacity: isAssigned ? 0.4 : 1,
                            cursor: isAssigned ? 'default' : 'pointer',
                          }}
                          onMouseEnter={e => { if (!isAssigned) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
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
                        </div>
                                              );
                    })}
                  </div>
                  <button onClick={() => { setShowWizard(false); }} style={{
                    marginTop: 8, padding: '6px 14px', borderRadius: 6, border: `1px solid ${(th as any).border}`,
                    background: 'transparent', color: (th as any).textMuted, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer',
                  }}>{t.cancel ?? 'Cancel'}</button>
                </div>
              )}

              {/* ── STEP 2: Pick Customer ── */}
              {wizardStep === 'customer' && (
                <div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: gold,
                    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
                  }}>{t.pickCustomer ?? 'Select Customer'}</div>

                  {/* Show pre-selected from task */}
                  {wizTask?.customer && (
                    <div style={{
                      padding: '10px 14px', borderRadius: 8, marginBottom: 8,
                      background: isDark ? 'rgba(200,169,110,.1)' : 'rgba(200,169,110,.06)',
                      border: `1px solid ${gold}30`,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{ fontSize: 14 }}>👤</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: gold }}>
                          {wizTask.customer.name}
                        </div>
                        <div style={{ fontSize: 9, color: (th as any).textMuted }}>
                          {t.autoFromTask ?? 'Auto-linked from task'}
                        </div>
                      </div>
                      <span style={{ color: gold, fontSize: 13 }}>✓</span>
                    </div>
                  )}

                  <input
                    ref={customerSearchRef}
                    placeholder={t.searchCustomers ?? 'Search customers...'}
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      border: `1px solid ${(th as any).border}`,
                      background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)',
                      color: (th as any).text, fontSize: 12, outline: 'none', marginBottom: 8,
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {filteredCustomers.map(cust => {
                      const isSelected = wizCustomerId === cust.id;
                      return (
                        <div key={cust.id}
                          onClick={() => setWizCustomerId(isSelected ? null : cust.id)}
                          style={{
                            ...addItemRow,
                            background: isSelected ? (isDark ? 'rgba(200,169,110,.1)' : 'rgba(200,169,110,.06)') : 'transparent',
                            border: isSelected ? `1px solid ${gold}30` : '1px solid transparent',
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)'; }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span style={{ fontSize: 14, flexShrink: 0 }}>👤</span>
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{
                              fontSize: 12, fontWeight: 600, color: (th as any).text,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>{cust.name}</div>
                            <div style={{ fontSize: 9, color: (th as any).textMuted }}>
                              {[cust.city, cust.address].filter(Boolean).join(' · ') || '—'}
                            </div>
                          </div>
                          {isSelected && <span style={{ color: gold, fontSize: 13 }}>✓</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Navigation */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => setWizardStep('task')} style={{
                      flex: 1, padding: '8px', borderRadius: 6, border: `1px solid ${(th as any).border}`,
                      background: 'transparent', color: (th as any).textMuted, fontSize: 11, fontWeight: 600,
                      cursor: 'pointer',
                    }}>← {t.back ?? 'Back'}</button>
                    <button onClick={() => {
                      setWizCustomerId(null);
                      setWizardStep('machines');
                    }} style={{
                      padding: '8px 14px', borderRadius: 6, border: `1px dashed ${(th as any).border}`,
                      background: 'transparent', color: (th as any).textMuted, fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', fontStyle: 'italic',
                    }}>{t.skipCustomer ?? 'Skip — internal task'}</button>
                    <button onClick={() => setWizardStep('machines')} style={{
                      flex: 1, padding: '8px', borderRadius: 6, border: 'none',
                      background: gold, color: isDark ? '#0a0a0a' : '#fff', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer',
                    }}>{t.next ?? 'Next'} →</button>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Pick Machines ── */}
              {wizardStep === 'machines' && (
                <div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: gold,
                    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4,
                  }}>{t.pickMachines ?? 'Attach Machines'}</div>
                  <div style={{ fontSize: 10, color: (th as any).textMuted, marginBottom: 8 }}>
                    {t.machinesOptional ?? 'Optional — select machines or skip'}
                  </div>

                  {/* Selected machines summary */}
                  {wizMachineIds.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                      {wizMachineIds.map(mid => {
                        const mc = machines.find(m => m.id === mid);
                        return (
                          <span key={mid} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 8px', borderRadius: 4,
                            background: isDark ? 'rgba(66,165,245,.12)' : 'rgba(66,165,245,.08)',
                            color: '#42a5f5', fontSize: 10, fontWeight: 600,
                          }}>
                            🚜 {mc?.name || '?'}
                            <span
                              style={{ cursor: 'pointer', fontSize: 12, color: '#ef4444' }}
                              onClick={() => setWizMachineIds(prev => prev.filter(id => id !== mid))}
                            >×</span>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <input
                    ref={machineSearchRef}
                    placeholder={t.searchMachines ?? 'Search machines...'}
                    value={machineSearch}
                    onChange={e => setMachineSearch(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      border: `1px solid ${(th as any).border}`,
                      background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)',
                      color: (th as any).text, fontSize: 12, outline: 'none', marginBottom: 8,
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {filteredMachines.map(machine => {
                      const isSelected = wizMachineIds.includes(machine.id);
                      const isInCell = cellMachineIds.has(machine.id);
                      const isTakenElsewhere = !isInCell && !isSelected && machinesAllocatedThisDay.has(machine.id);
                      const isClickable = !isTakenElsewhere;

                      return (
                        <div key={machine.id}
                          onClick={() => {
                            if (!isClickable) return;
                            if (isSelected) {
                              setWizMachineIds(prev => prev.filter(id => id !== machine.id));
                            } else {
                              setWizMachineIds(prev => [...prev, machine.id]);
                            }
                          }}
                          style={{
                            ...addItemRow,
                            opacity: isTakenElsewhere ? 0.35 : 1,
                            cursor: isClickable ? 'pointer' : 'default',
                            background: isSelected ? (isDark ? 'rgba(66,165,245,.1)' : 'rgba(66,165,245,.06)') : 'transparent',
                            border: isSelected ? '1px solid rgba(66,165,245,.25)' : '1px solid transparent',
                          }}
                          onMouseEnter={e => { if (isClickable && !isSelected) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)'; }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div style={{
                            width: 28, height: 28, borderRadius: 6,
                            background: isDark ? 'rgba(66,165,245,.1)' : 'rgba(66,165,245,.06)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, flexShrink: 0,
                          }}>🚜</div>
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{
                              fontSize: 12, fontWeight: 600, color: (th as any).text,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>{machine.name}</div>
                            <div style={{ fontSize: 9, color: (th as any).textMuted }}>
                              {machine.category}{machine.inventory_nr ? ` · ${machine.inventory_nr}` : ''}
                              {machine.tonnage ? ` · ${machine.tonnage}t` : ''}
                            </div>
                          </div>
                          {isSelected && <span style={{ color: '#42a5f5', fontSize: 13 }}>✓</span>}
                          {isTakenElsewhere && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, color: '#ef4444',
                              background: isDark ? 'rgba(239,68,68,.12)' : 'rgba(239,68,68,.08)',
                              padding: '2px 8px', borderRadius: 4,
                            }}>{t.inUse ?? 'In Use'}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Navigation */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => setWizardStep('customer')} style={{
                      flex: 1, padding: '8px', borderRadius: 6, border: `1px solid ${(th as any).border}`,
                      background: 'transparent', color: (th as any).textMuted, fontSize: 11, fontWeight: 600,
                      cursor: 'pointer',
                    }}>← {t.back ?? 'Back'}</button>
                    <button onClick={() => setWizardStep('confirm')} style={{
                      flex: 1, padding: '8px', borderRadius: 6, border: 'none',
                      background: gold, color: isDark ? '#0a0a0a' : '#fff', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer',
                    }}>{t.next ?? 'Next'} →</button>
                  </div>
                </div>
              )}

              {/* ── STEP 4: Confirm & Save ── */}
              {wizardStep === 'confirm' && (
                <div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: gold,
                    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12,
                  }}>{t.confirmJob ?? 'Confirm Job'}</div>

                  {/* Summary card */}
                  <div style={{
                    padding: '14px 16px', borderRadius: 10,
                    background: isDark ? 'rgba(200,169,110,.06)' : 'rgba(200,169,110,.03)',
                    border: `1px solid ${gold}25`,
                    marginBottom: 12,
                  }}>
                    {/* Task */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: wizTask ? getTaskColor(wizTask.id) : '#666',
                        flexShrink: 0,
                      }} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: (th as any).text }}>
                          {wizTask?.name || '?'}
                        </div>
                        <div style={{ fontSize: 10, color: (th as any).textMuted }}>
                          {wizTask?.code} · {wizTask?.schedule_type === 'UNTERHALT' ? 'UH' : 'GT'}
                        </div>
                      </div>
                    </div>

                    {/* Customer */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 14 }}>{wizCustomerId ? '👤' : '🏭'}</span>
                      <div style={{ fontSize: 12, fontWeight: 600, color: wizCustomerId ? gold : (th as any).textMuted }}>
                        {wizCustomer?.name || wizTask?.customer?.name || (t.intern ?? 'Internal')}
                      </div>
                    </div>

                    {/* Machines */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14 }}>🚜</span>
                      <div style={{ fontSize: 12, color: (th as any).textMuted }}>
                        {wizMachineIds.length === 0
                          ? (t.noMachines ?? 'No machines')
                          : wizMachineIds.map(mid => machines.find(m => m.id === mid)?.name || '?').join(', ')
                        }
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setWizardStep('machines')} style={{
                      flex: 1, padding: '10px', borderRadius: 6, border: `1px solid ${(th as any).border}`,
                      background: 'transparent', color: (th as any).textMuted, fontSize: 11, fontWeight: 600,
                      cursor: 'pointer',
                    }}>← {t.back ?? 'Back'}</button>
                    <button onClick={saveJob} disabled={saving} style={{
                      flex: 2, padding: '10px', borderRadius: 6, border: 'none',
                      background: gold, color: isDark ? '#0a0a0a' : '#fff', fontSize: 13, fontWeight: 700,
                      cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1,
                    }}>
                      {saving ? '...' : `✓ ${t.saveJob ?? 'Save Job'}`}
                    </button>
                  </div>

                  <button onClick={() => setShowWizard(false)} style={{
                    marginTop: 8, width: '100%', padding: '6px', borderRadius: 6,
                    border: 'none', background: 'transparent',
                    color: (th as any).textMuted, fontSize: 10, fontWeight: 600,
                    cursor: 'pointer',
                  }}>{t.cancel ?? 'Cancel'}</button>
                </div>
              )}
            </div>
          )}

          {/* ═══ ABSENCES ═══ */}
          <div>
            {cellAbsences.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: (th as any).textMuted,
                  letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
                }}>{t.absences ?? 'Absences'}</div>
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
                        <button style={removeBtn} onClick={() => removeAbsence(abs.id)} title={t.remove ?? 'Remove'}>✕</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {canEdit && !showWizard && (
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
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Mini-component: Add machine to an existing job ─── */
function MachineAdder({ jobId, machines, machinesAllocatedThisDay, cellMachineIds, isDark, th, gold, t, onAdd }: {
  jobId: string;
  machines: Machine[];
  machinesAllocatedThisDay: Set<string>;
  cellMachineIds: Set<string>;
  isDark: boolean;
  th: Theme;
  gold: string;
  t: any;
  onAdd: (machineId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) ref.current?.focus(); }, [open]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    let list = machines.filter(m => m.is_active !== false);
    if (s) {
      list = list.filter(m =>
        m.name.toLowerCase().includes(s) ||
        m.category.toLowerCase().includes(s) ||
        (m.inventory_nr || '').toLowerCase().includes(s)
      );
    }
    return list.slice(0, 20);
  }, [search, machines]);

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setSearch(''); }} style={{
        padding: '4px 10px', borderRadius: 4, border: `1px dashed rgba(66,165,245,.3)`,
        background: 'transparent', color: '#42a5f5', fontSize: 10, fontWeight: 600,
        cursor: 'pointer',
      }}>+ 🚜 {t.addMachine ?? 'Add Machine'}</button>
    );
  }

  return (
    <div style={{
      padding: '8px', borderRadius: 6,
      background: isDark ? 'rgba(66,165,245,.05)' : 'rgba(66,165,245,.03)',
      border: '1px solid rgba(66,165,245,.15)',
    }}>
      <input
        ref={ref}
        placeholder={t.searchMachines ?? 'Search machines...'}
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '6px 8px', borderRadius: 4,
          border: `1px solid ${(th as any).border}`,
          background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)',
          color: (th as any).text, fontSize: 11, outline: 'none', marginBottom: 4,
          boxSizing: 'border-box',
        }}
      />
      <div style={{ maxHeight: 120, overflowY: 'auto' }}>
        {filtered.map(mc => {
          const isInCell = cellMachineIds.has(mc.id);
          const isTaken = !isInCell && machinesAllocatedThisDay.has(mc.id);
          const clickable = !isInCell && !isTaken;
          return (
            <div key={mc.id}
              onClick={() => { if (clickable) { onAdd(mc.id); setOpen(false); } }}
              style={{
                padding: '4px 8px', borderRadius: 4, cursor: clickable ? 'pointer' : 'default',
                opacity: isTaken ? 0.35 : isInCell ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                transition: 'background .1s',
              }}
              onMouseEnter={e => { if (clickable) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 11 }}>🚜</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: (th as any).text, fontWeight: 500 }}>
                {mc.name}
              </span>
              {isInCell && <span style={{ color: gold, fontSize: 11 }}>✓</span>}
              {isTaken && <span style={{ fontSize: 8, color: '#ef4444', fontWeight: 700 }}>{t.inUse ?? 'In Use'}</span>}
            </div>
          );
        })}
      </div>
      <button onClick={() => setOpen(false)} style={{
        marginTop: 4, padding: '3px 8px', borderRadius: 4, border: 'none',
        background: 'transparent', color: (th as any).textMuted, fontSize: 9, cursor: 'pointer',
      }}>{t.cancel ?? 'Cancel'}</button>
    </div>
  );
}
