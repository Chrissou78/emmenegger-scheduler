// frontend/src/pages/SchedulePage.tsx
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTheme } from '../contexts/themeContext';
import { themes, ABS } from '../i18n/translations';
import { format } from 'date-fns';
import { useAuthStore } from '../contexts/authStore';
import { useRolesStore } from '../store/rolesStore';
import {
  resolvePermissions,
  getViewTier,
  getScheduleScope,
  isOperational,
  type Role,
  type Permission,
} from '../../../shared/constants/roles';
import { getTranslations, type LangCode } from '../i18n';
import { CellDetailModal } from '../components/CellDetailModal';

/* ─── Theme type ─── */
type Theme = typeof themes.dark;

/* ─── Types ─── */
interface User {
  id: string; first_name: string; last_name: string; department: string;
  departments?: string[]; role?: string; team_leader_id?: string | null; executive_id?: string | null;
}
interface Week { id: string; week_number: number; year: number; schedule_type: string; status: string; }
interface Task {
  id: string; code: string; name: string; color: string; schedule_type: string; status?: string;
  customer_id?: string;
  customer?: { id: string; name: string; city?: string } | null;
}
interface Customer {
  id: string; name: string; company_name?: string; address?: string;
  street?: string; city?: string; postal_code?: string;
  contact_name?: string; contact_phone?: string;
}
interface Machine {
  id: string; name: string; category: string; status: string;
  inventory_nr?: string; tonnage?: number; is_active?: boolean;
}
interface JobMachine {
  id: string;
  machine_id: string;
  machine?: Machine;
}
interface Job {
  id: string;
  week_id: string;
  user_id: string;
  day_of_week: number;
  time_slot: number;
  task_id: string;
  customer_id?: string | null;
  notes?: string | null;
  task?: Task;
  machines?: JobMachine[];
}
interface AbsenceRecord {
  id: string;
  user_id: string;
  date: string;
  absence_code: number;
  source?: string;
  notes?: string;
  week_id?: string;
  day_of_week?: number;
}

const API = import.meta.env.VITE_API_URL || '';
const PAGE_SIZE = 20;

/* ─── Color palette ─── */
const PALETTE = [
  '#B8860B','#4A6741','#5B6E82','#7D4E57','#8E6F3E','#4A4063','#704241','#3B4F64',
  '#6B8E23','#8B4513','#556B2F','#483D8B','#2F4F4F','#8B0000','#006400','#4682B4',
  '#C8A96E','#6B4C3B','#2C3E50','#8B7355','#9B59B6','#1ABC9C','#E67E22','#34495E',
];
function hashColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

/* ─── Helpers ─── */
function getWeekDates(off: number) {
  const n = new Date(); const d = n.getDay(); const diff = d === 0 ? -6 : 1 - d;
  const mon = new Date(n); mon.setDate(n.getDate() + diff + off * 7);
  return Array.from({ length: 6 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return x; });
}
function fmtDate(d: Date) { return `${d.getDate()}.${d.getMonth() + 1}.`; }
function getKW(d: Date) {
  const date = new Date(d); date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const w1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - w1.getTime()) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}

export function SchedulePage() {
  const { isDark, lang } = useTheme();
  const th: Theme = isDark ? themes.dark : themes.light;
  const t = getTranslations(lang as LangCode);

  /* ─── Auth & Permissions ─── */
  const { user, token } = useAuthStore();
  const { permissionMap } = useRolesStore();

  const perms = useMemo(() => {
    const role: Role = user?.role || "EMPLOYEE";
    return resolvePermissions(role, user?.custom_permissions, permissionMap);
  }, [user, permissionMap]);

  const canView = perms.has("schedule.view" as Permission);
  const canEdit = perms.has("schedule.edit" as Permission);

  const userRole = user?.role || 'EMPLOYEE';
  const userDepts: string[] = (() => {
    const raw = user?.departments || (user?.departments ? [user.departments] : []);
    return raw.flat(Infinity) as string[];
  })();

  const viewTier = useMemo(() => getViewTier(userRole), [userRole]);
  const scheduleScope = useMemo(
    () => getScheduleScope(userRole, userDepts),
    [userRole, userDepts]
  );
  const operational = useMemo(() => isOperational(userDepts), [userDepts]);

  /* ─── State ─── */
  const [weekOff, setWeekOff] = useState(0);
  const [dept, setDept] = useState('all');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [absenceRecords, setAbsenceRecords] = useState<AbsenceRecord[]>([]);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  const [selectedTeamLeaderId, setSelectedTeamLeaderId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Cell detail modal
  const [cellModal, setCellModal] = useState<{ userId: string; day: number } | null>(null);

  // Bulk picker (column / row)
  const [bulkPicker, setBulkPicker] = useState<{ type: 'day' | 'employee'; day?: number; userId?: string; rect: DOMRect } | null>(null);
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const bulkRef = useRef<HTMLDivElement>(null);
  const bulkSearchRef = useRef<HTMLInputElement>(null);

  const dates = getWeekDates(weekOff);
  const kw = getKW(dates[0]);
  const year = dates[0].getFullYear();

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  /* ─── Derived data ─── */
  const teamLeaders = useMemo(() =>
    allUsers.filter(u => {
      const r = (u.role || '').toUpperCase();
      return r === 'MANAGER' || r === 'LOCAL_MANAGER';
    }).sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)),
    [allUsers]
  );

  const users = useMemo(() => {
    let list = allUsers;
    if (scheduleScope === 'team') {
      list = list.filter(u => u.team_leader_id === user?.id || u.id === user?.id);
    } else if (scheduleScope === 'all') {
      if (selectedTeamLeaderId) {
        list = list.filter(u =>
          u.team_leader_id === selectedTeamLeaderId ||
          u.id === selectedTeamLeaderId
        );
      }
    }
    return list;
  }, [allUsers, scheduleScope, selectedTeamLeaderId, user?.id]);

  const emps = useMemo(() => users.filter(u => dept === 'all' || u.department === dept), [users, dept]);

  useEffect(() => { setCurrentPage(1); }, [dept, selectedTeamLeaderId, weekOff, scheduleScope]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(emps.length / PAGE_SIZE)), [emps.length]);
  const pagedEmps = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return emps.slice(start, start + PAGE_SIZE);
  }, [emps, currentPage]);

  const matchingWeeks = useMemo(() => weeks.filter(w => w.week_number === kw && w.year === year), [weeks, kw, year]);
  const weekIds = useMemo(() => new Set(matchingWeeks.map(w => w.id)), [matchingWeeks]);

  const taskById = useMemo(() => {
    const m: Record<string, Task> = {};
    tasks.forEach(tk => { m[tk.id] = tk; });
    return m;
  }, [tasks]);

  // ── Job-based maps ──
  const jobMap = useMemo(() => {
    const m: Record<string, Record<number, Job[]>> = {};
    jobs.forEach(j => {
      if (!weekIds.has(j.week_id)) return;
      if (!m[j.user_id]) m[j.user_id] = {};
      if (!m[j.user_id][j.day_of_week]) m[j.user_id][j.day_of_week] = [];
      m[j.user_id][j.day_of_week].push(j);
    });
    // Sort by time_slot
    Object.values(m).forEach(ud => Object.values(ud).forEach(arr => arr.sort((a, b) => a.time_slot - b.time_slot)));
    return m;
  }, [jobs, weekIds]);

  const getCellJobs = useCallback((userId: string, day: number): Job[] => {
    return jobMap[userId]?.[day] || [];
  }, [jobMap]);

  const totalSlots = useMemo(() =>
    Object.values(jobMap).reduce((s, u) => s + Object.values(u).reduce((ss, arr) => ss + arr.length, 0), 0),
  [jobMap]);

  const activeTaskIds = useMemo(() => {
    const s = new Set<string>();
    Object.values(jobMap).forEach(u => Object.values(u).forEach(arr => arr.forEach(j => s.add(j.task_id))));
    return s;
  }, [jobMap]);

  const getCellAbsences = useCallback((userId: string, day: number): AbsenceRecord[] => {
    if (!dates[day]) return [];
    const dateStr = format(dates[day], 'yyyy-MM-dd');
    return absenceRecords.filter(ab =>
      ab.user_id === userId && (
        ab.date === dateStr ||
        (ab.day_of_week === day && ab.week_id && weekIds.has(ab.week_id))
      )
    );
  }, [absenceRecords, dates, weekIds]);

  const showToast = useCallback((msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 2800);
  }, []);

  /* ─── Fetchers ─── */
  const fetchWeeks = async () => {
    try { const r = await fetch(`${API}/api/v1/weeks`, { headers: authHeaders }); if (!r.ok) return; const d = await r.json(); setWeeks(d.data || []); } catch {}
  };
  const fetchTasks = async () => {
    try { const r = await fetch(`${API}/api/v1/tasks`, { headers: authHeaders }); if (!r.ok) return; const d = await r.json(); setTasks(d.data || []); } catch {}
  };
  const fetchUsers = async () => {
    try {
      const r = await fetch(`${API}/api/v1/users?limit=500`, { headers: authHeaders });
      if (!r.ok) return;
      const d = await r.json();
      setAllUsers(d.data || d.items || d || []);
    } catch {}
  };
  const fetchCustomers = async () => {
    try {
      const r = await fetch(`${API}/api/v1/customers?limit=200`, { headers: authHeaders });
      if (!r.ok) return;
      const d = await r.json();
      setCustomers(Array.isArray(d) ? d : d.data || []);
    } catch {}
  };
  const fetchMachines = async () => {
    try {
      const r = await fetch(`${API}/api/v1/machines`, { headers: authHeaders });
      if (!r.ok) return;
      const d = await r.json();
      setMachines(Array.isArray(d) ? d : d.data || []);
    } catch {}
  };
  const fetchJobs = async () => {
    if (matchingWeeks.length === 0) { setJobs([]); return; }
    const all: Job[] = [];
    for (const w of matchingWeeks) {
      try {
        const r = await fetch(`${API}/api/v1/jobs?weekId=${w.id}`, { headers: authHeaders });
        if (!r.ok) continue;
        const d = await r.json();
        if (Array.isArray(d.data)) all.push(...d.data);
      } catch {}
    }
    setJobs(all);
  };
  const fetchAbsenceRecords = async () => {
    if (dates.length === 0) { setAbsenceRecords([]); return; }
    try {
      const startDate = format(dates[0], 'yyyy-MM-dd');
      const endDate = format(dates[dates.length - 1], 'yyyy-MM-dd');
      const r = await fetch(`${API}/api/v1/absences?startDate=${startDate}&endDate=${endDate}`, { headers: authHeaders });
      if (!r.ok) return;
      const d = await r.json();
      setAbsenceRecords(Array.isArray(d) ? d : d.data || []);
    } catch {}
  };

  const refreshCellData = useCallback(async () => {
    await Promise.all([fetchJobs(), fetchAbsenceRecords()]);
  }, [matchingWeeks, dates, authHeaders]);

  /* ─── Initial + week-change fetches ─── */
  useEffect(() => { fetchWeeks(); fetchTasks(); fetchUsers(); fetchMachines(); fetchCustomers(); }, []);
  useEffect(() => {
    if (weeks.length > 0) { fetchJobs(); fetchAbsenceRecords(); }
  }, [weekOff, weeks]);
  useEffect(() => { if (toast) { const tm = setTimeout(() => setToast(null), 3000); return () => clearTimeout(tm); } }, [toast]);

  // Close bulk picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bulkRef.current && !bulkRef.current.contains(e.target as Node)) setBulkPicker(null);
    };
    if (bulkPicker) { document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler); }
  }, [bulkPicker]);
  useEffect(() => { if (bulkPicker && bulkSearchRef.current) bulkSearchRef.current.focus(); }, [bulkPicker]);

  /* ─── Cell helpers ─── */
  const getTaskColor = (taskId: string) => {
    const task = taskById[taskId];
    return task?.color && task.color !== '#8B7355' ? task.color : hashColor(taskId);
  };

  const openCellModal = (userId: string, day: number) => {
    if (!canEdit && !canView) return;
    setBulkPicker(null);
    setCellModal({ userId, day });
  };

  /* ─── Remove job (direct from grid × button) ─── */
  const removeJob = async (jobId: string) => {
    if (!canEdit) return;
    try {
      const r = await fetch(`${API}/api/v1/jobs/${jobId}`, { method: 'DELETE', headers: authHeaders });
      if (r.ok) { showToast(t.removed ?? 'Removed'); await fetchJobs(); }
    } catch { showToast(t.networkError ?? 'Network error', true); }
  };

  /* ─── Bulk actions ─── */
  const bulkAssignTask = async (taskId: string) => {
    if (!bulkPicker || !canEdit) return;
    setBulkLoading(true);
    const task = taskById[taskId];
    const week = matchingWeeks.find(w => task && w.schedule_type === task.schedule_type) || matchingWeeks[0];
    if (!week) { showToast(t.weekNotFound ?? 'Week not found', true); setBulkPicker(null); setBulkLoading(false); return; }

    let success = 0, skip = 0;

    if (bulkPicker.type === 'day' && bulkPicker.day !== undefined) {
      for (const emp of emps) {
        const cellJobs = getCellJobs(emp.id, bulkPicker.day!);
        if (cellJobs.length >= 2 || cellJobs.some(j => j.task_id === taskId)) { skip++; continue; }
        try {
          const r = await fetch(`${API}/api/v1/jobs`, {
            method: 'POST', headers: authHeaders,
            body: JSON.stringify({
              weekId: week.id, userId: emp.id, dayOfWeek: bulkPicker.day,
              timeSlot: cellJobs.length + 1, taskId, customerId: task?.customer_id || null,
            }),
          });
          if (r.ok) success++; else skip++;
        } catch { skip++; }
      }
    } else if (bulkPicker.type === 'employee' && bulkPicker.userId) {
      for (let day = 0; day < 6; day++) {
        const cellJobs = getCellJobs(bulkPicker.userId, day);
        if (cellJobs.length >= 2 || cellJobs.some(j => j.task_id === taskId)) { skip++; continue; }
        try {
          const r = await fetch(`${API}/api/v1/jobs`, {
            method: 'POST', headers: authHeaders,
            body: JSON.stringify({
              weekId: week.id, userId: bulkPicker.userId, dayOfWeek: day,
              timeSlot: cellJobs.length + 1, taskId, customerId: task?.customer_id || null,
            }),
          });
          if (r.ok) success++; else skip++;
        } catch { skip++; }
      }
    }

    await fetchJobs();
    setBulkLoading(false);
    setBulkPicker(null);
    showToast(`${task?.name || ''}: ${success} ✓${skip > 0 ? ` · ${skip} ${t.skipped ?? 'skipped'}` : ''}`);
  };

  const bulkAssignAbsence = async (code: string) => {
    if (!bulkPicker || !canEdit) return;
    setBulkLoading(true);
    let success = 0, skip = 0;

    if (bulkPicker.type === 'day' && bulkPicker.day !== undefined) {
      for (const emp of emps) {
        try {
          const r = await fetch(`${API}/api/v1/absences`, {
            method: 'POST', headers: authHeaders,
            body: JSON.stringify({ userId: emp.id, date: format(dates[bulkPicker.day!], 'yyyy-MM-dd'), absenceCode: parseInt(code), source: 'MANUAL' }),
          });
          if (r.ok) success++; else skip++;
        } catch { skip++; }
      }
    } else if (bulkPicker.type === 'employee' && bulkPicker.userId) {
      for (let day = 0; day < 6; day++) {
        try {
          const r = await fetch(`${API}/api/v1/absences`, {
            method: 'POST', headers: authHeaders,
            body: JSON.stringify({ userId: bulkPicker.userId, date: format(dates[day], 'yyyy-MM-dd'), absenceCode: parseInt(code), source: 'MANUAL' }),
          });
          if (r.ok) success++; else skip++;
        } catch { skip++; }
      }
    }

    await fetchAbsenceRecords();
    setBulkLoading(false);
    setBulkPicker(null);
    showToast(`${(t.abs as any)?.[code] ?? code}: ${success} ✓${skip > 0 ? ` · ${skip} ${t.skipped ?? 'skipped'}` : ''}`);
  };

  /* ─── Bulk picker tasks ─── */
  const bulkPickerTasks = useMemo(() => {
    if (!bulkPicker) return [];
    const s = bulkSearch.toLowerCase();
    let list = tasks.filter(tk => tk.status !== 'CANCELLED');
    if (s) {
      list = list.filter(tk =>
        tk.name.toLowerCase().includes(s) ||
        tk.code.toLowerCase().includes(s) ||
        (tk.customer?.name || '').toLowerCase().includes(s)
      );
    }
    list.sort((a, b) => {
      const aUsed = activeTaskIds.has(a.id) ? 0 : 1;
      const bUsed = activeTaskIds.has(b.id) ? 0 : 1;
      if (aUsed !== bUsed) return aUsed - bUsed;
      return a.name.localeCompare(b.name);
    });
    return list.slice(0, 50);
  }, [bulkPicker, bulkSearch, tasks, activeTaskIds]);

  const deptLabel = (d: string) => d === 'garten' ? (t.gartenFull ?? 'Garten & Tiefbau') : d === 'unterhalt' ? (t.unterhaltFull ?? 'Unterhalt') : (t.bothDept ?? 'All');

  /* ═══ ACCESS GUARD ═══ */
  if (scheduleScope === 'none' || !canView) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: th.text }}>
        <h2>{t.accessDenied ?? 'Access Denied'}</h2>
        <p style={{ color: th.textDim, fontSize: 14, marginTop: 8 }}>
          {t.noAccessSchedule ?? "You don't have access to the schedule view"}
        </p>
      </div>
    );
  }

  /* ═══════════════════════════════════════ RENDER ═══════════════════════════════════════ */
  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", background: th.bg, color: th.text, minHeight: '100vh' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999, padding: '12px 20px', borderRadius: 6,
          background: toast.err ? th.toastErrBg : th.toastBg, color: toast.err ? th.toastErrText : th.toastText,
          border: `1px solid ${toast.err ? th.toastErrBorder : th.toastBorder}`, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,.3)', animation: 'fadeSlide .3s ease',
        }}>{toast.msg}</div>
      )}

      {/* Bulk loading bar */}
      {bulkLoading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 10000,
          background: `linear-gradient(90deg, transparent, ${th.gold}, transparent)`,
          animation: 'bulkProgress 1.5s ease-in-out infinite',
        }} />
      )}

      <main style={{ padding: '20px 24px', opacity: bulkLoading ? 0.7 : 1, pointerEvents: bulkLoading ? 'none' : 'auto' }}>

        {/* ── Header: week nav + dept filter + TL filter + stats ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => setWeekOff(w => w - 1)} style={navBtn(th)}>‹</button>
            <div style={{ textAlign: 'center', minWidth: 130 }}>
              <div style={{ fontSize: 32, fontWeight: 300, color: th.gold, lineHeight: 1, letterSpacing: 1 }}>{t.kw ?? 'KW'} {kw}</div>
              <div style={{ fontSize: 10, color: th.textDim, marginTop: 4, fontWeight: 400, letterSpacing: .5 }}>
                {fmtDate(dates[0])} — {fmtDate(dates[5])} {year}
              </div>
            </div>
            <button onClick={() => setWeekOff(w => w + 1)} style={navBtn(th)}>›</button>
            <button onClick={() => setWeekOff(0)} style={{
              padding: '6px 12px', borderRadius: 4, border: 'none', background: th.switchActive,
              color: th.gold, cursor: 'pointer', fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const,
            }}>{t.today ?? 'Today'}</button>
            <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
              {(['all', 'garten', 'unterhalt'] as const).map(d => (
                <button key={d} onClick={() => setDept(d)} style={{
                  padding: '5px 10px', borderRadius: 4, border: `1px solid ${dept === d ? th.gold : th.border}`,
                  background: dept === d ? (isDark ? 'rgba(200,169,110,.1)' : 'rgba(200,169,110,.08)') : 'transparent',
                  color: dept === d ? th.gold : th.textDim, cursor: 'pointer', fontSize: 10, fontWeight: 600,
                }}>{d === 'all' ? (t.bothDept ?? 'All') : d === 'garten' ? 'GT' : 'UH'}</button>
              ))}
            </div>

            {/* Team Leader Filter */}
            {scheduleScope === 'all' && teamLeaders.length > 0 && (
              <div style={{ marginLeft: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 9, color: th.goldDim, fontWeight: 700,
                  letterSpacing: 1, textTransform: 'uppercase' as const,
                }}>
                  {t.filterByTeamLeader ?? 'Team Leader'}
                </span>
                <select
                  value={selectedTeamLeaderId || ''}
                  onChange={e => setSelectedTeamLeaderId(e.target.value || null)}
                  style={{
                    padding: '5px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    border: `1px solid ${selectedTeamLeaderId ? th.gold : th.border}`,
                    background: selectedTeamLeaderId
                      ? (isDark ? 'rgba(200,169,110,.1)' : 'rgba(200,169,110,.08)')
                      : (isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)'),
                    color: selectedTeamLeaderId ? th.gold : th.text,
                    cursor: 'pointer', outline: 'none', minWidth: 160,
                  }}
                >
                  <option value="">{t.allTeamLeaders ?? 'All Team Leaders'}</option>
                  {teamLeaders.map(tl => (
                    <option key={tl.id} value={tl.id}>{tl.first_name} {tl.last_name}</option>
                  ))}
                </select>
                {selectedTeamLeaderId && (
                  <button onClick={() => setSelectedTeamLeaderId(null)} style={{
                    padding: '4px 8px', borderRadius: 4, border: 'none',
                    background: 'rgba(239,68,68,.15)', color: '#ef4444',
                    fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  }}>✕</button>
                )}
              </div>
            )}

            {scheduleScope === 'team' && (
              <div style={{
                marginLeft: 12, padding: '4px 10px', borderRadius: 4,
                background: isDark ? 'rgba(34,197,94,.1)' : 'rgba(34,197,94,.06)',
                border: '1px solid rgba(34,197,94,.3)',
                fontSize: 10, fontWeight: 600, color: '#22c55e',
              }}>{t.myTeam ?? 'My Team'}</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { v: emps.length, l: t.employees ?? 'Employees' },
              { v: totalSlots, l: t.jobs ?? 'Jobs' },
              { v: activeTaskIds.size, l: t.objects ?? 'Objects' },
            ].map((s) => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 300, color: th.gold, lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: 8, color: th.textGhost, marginTop: 3, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════ SCHEDULE GRID ══════════════════════════ */}
        <div style={{ background: th.bgCard, borderRadius: 8, border: `1px solid ${th.border}`, overflow: 'visible', position: 'relative' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 40 }} />
              <col style={{ width: 200 }} />
              {(t.days as string[]).map((_: string, i: number) => <col key={i} />)}
            </colgroup>
            <thead>
              <tr style={{ height: 48 }}>
                <th style={{ ...thBase(th), background: th.goldGhost }} />
                <th style={{
                  ...thBase(th), background: th.goldGhost, textAlign: 'left' as const,
                  padding: '8px 14px', fontSize: 11, color: th.goldDim, fontWeight: 700,
                  letterSpacing: 2, textTransform: 'uppercase' as const,
                }}>{t.employees ?? 'Employees'}</th>
                {(t.days as string[]).map((d: string, i: number) => (
                  <th key={d} style={{
                    ...thBase(th), background: th.goldGhost, textAlign: 'center' as const, padding: '6px',
                    cursor: canEdit ? 'pointer' : 'default',
                  }}
                    onClick={e => {
                      if (!canEdit) return;
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setCellModal(null);
                      setBulkPicker({ type: 'day', day: i, rect });
                      setBulkSearch('');
                    }}
                    title={canEdit ? `${t.bulkDay ?? 'Bulk assign day'}: ${(t.days as string[])[i]}` : undefined}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: th.gold }}>{d}</div>
                    <div style={{ fontSize: 10, color: th.textGhost, fontWeight: 500, marginTop: 2 }}>{fmtDate(dates[i])}</div>
                    {canEdit && <div style={{ fontSize: 8, color: th.goldDim, marginTop: 2 }}>▼</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedEmps.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: th.textDim, fontSize: 14 }}>
                    {selectedTeamLeaderId
                      ? (t.noEmployeesForTL ?? 'No employees found for this team leader')
                      : (t.noResults ?? 'No results')}
                  </td>
                </tr>
              )}
              {pagedEmps.map((emp, idx) => (
                <tr key={emp.id} style={{
                  borderTop: idx > 0 ? `1px solid ${th.borderFaint}` : 'none',
                  transition: 'background .15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = th.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Dept badge */}
                  <td style={{
                    textAlign: 'center' as const, borderRight: `1px solid ${th.borderFaint}`,
                    fontSize: 11, fontWeight: 700,
                    color: emp.department === 'garten' ? th.roleV : th.roleM, padding: '4px',
                  }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28, borderRadius: 6,
                      background: emp.department === 'garten'
                        ? (isDark ? 'rgba(74,103,65,.2)' : 'rgba(74,103,65,.08)')
                        : (isDark ? 'rgba(125,78,87,.2)' : 'rgba(125,78,87,.08)'),
                      fontSize: 10, fontWeight: 800, letterSpacing: .5,
                    }}>{emp.department === 'garten' ? 'GT' : 'UH'}</div>
                  </td>

                  {/* Name */}
                  <td style={{
                    padding: '6px 14px', borderRight: `1px solid ${th.borderFaint}`,
                    cursor: canEdit ? 'pointer' : 'default', verticalAlign: 'middle' as const,
                  }}
                    onClick={e => {
                      if (!canEdit) return;
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setCellModal(null);
                      setBulkPicker({ type: 'employee', userId: emp.id, rect });
                      setBulkSearch('');
                    }}
                    title={canEdit ? `${t.bulkEmployee ?? 'Bulk assign employee'}: ${emp.first_name}` : undefined}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: th.empName, lineHeight: 1.3 }}>{emp.first_name}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: th.text, lineHeight: 1.3, opacity: 0.7 }}>{emp.last_name}</div>
                    <div style={{
                      fontSize: 9, color: th.textGhost, fontWeight: 500,
                      letterSpacing: 1, textTransform: 'uppercase' as const, marginTop: 2,
                    }}>{deptLabel(emp.department)}{canEdit ? ' · ▶' : ''}</div>
                  </td>

                  {/* ═══ DAY CELLS ═══ */}
                  {(t.days as string[]).map((_: string, di: number) => {
                    const cellJobList = getCellJobs(emp.id, di);
                    const cellAbs = getCellAbsences(emp.id, di);
                    const hasJobs = cellJobList.length > 0;

                    return (
                      <td key={di} style={{
                        borderRight: di < 5 ? `1px solid ${th.borderFaint}` : 'none',
                        padding: '3px 4px', position: 'relative' as const,
                        cursor: 'pointer', verticalAlign: 'top' as const,
                      }}
                        onClick={() => openCellModal(emp.id, di)}
                      >
                        {/* Absence badges */}
                        {cellAbs.length > 0 && (
                          <div style={{ display: 'flex', gap: 2, marginBottom: 2, flexWrap: 'wrap' }}>
                            {cellAbs.map(abs => {
                              const code = String(abs.absence_code);
                              const absInfo = ABS[code as unknown as keyof typeof ABS];
                              return (
                                <span key={abs.id} style={{
                                  fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                                  background: `${absInfo?.bg || '#666'}30`,
                                  color: isDark ? (absInfo as any)?.textD || '#aaa' : (absInfo as any)?.textL || '#666',
                                  display: 'inline-flex', alignItems: 'center', gap: 2, lineHeight: 1.4,
                                }} title={(t.abs as any)?.[code] ?? `Absence ${code}`}>
                                  <span style={{ fontSize: 9 }}>{absInfo?.icon}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Job cards */}
                        {hasJobs ? (
                          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2 }}>
                            {cellJobList.map(job => {
                              const task = job.task || taskById[job.task_id];
                              const color = getTaskColor(job.task_id);
                              const customerName = job.task?.customer?.name;
                              const jm = job.machines || [];

                              return (
                                <div key={job.id} style={{
                                  background: isDark ? `${color}28` : `${color}18`,
                                  borderLeft: `3px solid ${color}`,
                                  borderRadius: 4, padding: '3px 6px', minHeight: 28,
                                  position: 'relative' as const,
                                }} title={`${task?.name || '?'}${customerName ? ` · ${customerName}` : ''}`}>
                                  {/* Task name */}
                                  <div style={{
                                    fontSize: 10, fontWeight: 700, color: isDark ? '#ddd' : '#333',
                                    overflow: 'hidden', textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap' as const,
                                    paddingRight: canEdit ? 14 : 0, lineHeight: 1.3,
                                  }}>{task?.name || task?.code || '?'}</div>

                                  {/* Customer */}
                                  {customerName && (
                                    <div style={{
                                      fontSize: 8, fontWeight: 500,
                                      color: isDark ? 'rgba(200,169,110,.7)' : 'rgba(139,115,85,.7)',
                                      overflow: 'hidden', textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap' as const, lineHeight: 1.3, marginTop: 1,
                                    }}>👤 {customerName}</div>
                                  )}

                                  {/* Machines */}
                                  {jm.length > 0 && (
                                    <div style={{ display: 'flex', gap: 2, marginTop: 1, flexWrap: 'wrap' }}>
                                      {jm.slice(0, 2).map(m => (
                                        <span key={m.id} style={{
                                          fontSize: 7, fontWeight: 600, padding: '0px 3px', borderRadius: 2,
                                          background: isDark ? 'rgba(66,165,245,.15)' : 'rgba(66,165,245,.1)',
                                          color: '#42a5f5', maxWidth: 55,
                                          overflow: 'hidden', textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap' as const, lineHeight: 1.4,
                                        }}>🚜{m.machine?.name?.slice(0, 7) || '?'}</span>
                                      ))}
                                      {jm.length > 2 && <span style={{ fontSize: 7, color: '#42a5f5' }}>+{jm.length - 2}</span>}
                                    </div>
                                  )}

                                  {/* Remove */}
                                  {canEdit && (
                                    <span style={{
                                      position: 'absolute' as const, top: 2, right: 3,
                                      fontSize: 10, color: th.textDim, cursor: 'pointer', lineHeight: 1,
                                      borderRadius: 3, width: 14, height: 14,
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      transition: 'background .15s',
                                    }}
                                      onClick={e => { e.stopPropagation(); removeJob(job.id); }}
                                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,.15)'; e.currentTarget.style.color = '#ef4444'; }}
                                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = th.textDim; }}
                                      title={t.remove ?? 'Remove'}
                                    >×</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : cellAbs.length === 0 ? (
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            height: 44, color: th.textGhost, fontSize: 20, fontWeight: 300,
                          }}>{canEdit ? '+' : ''}</div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '14px 20px', borderTop: `1px solid ${th.border}`,
              background: isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.015)',
            }}>
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                style={pageBtn(th, isDark, false, currentPage === 1)} title="First">«</button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                style={pageBtn(th, isDark, false, currentPage === 1)} title="Previous">‹</button>
              {(() => {
                const pages: (number | '...')[] = [];
                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  if (currentPage > 3) pages.push('...');
                  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
                  if (currentPage < totalPages - 2) pages.push('...');
                  pages.push(totalPages);
                }
                return pages.map((p, i) =>
                  p === '...' ? (
                    <span key={`dots-${i}`} style={{ color: th.textDim, fontSize: 12, padding: '0 4px' }}>…</span>
                  ) : (
                    <button key={p} onClick={() => setCurrentPage(p as number)}
                      style={pageBtn(th, isDark, currentPage === p, false)}>{p}</button>
                  )
                );
              })()}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                style={pageBtn(th, isDark, false, currentPage === totalPages)} title="Next">›</button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                style={pageBtn(th, isDark, false, currentPage === totalPages)} title="Last">»</button>
              <span style={{ marginLeft: 12, fontSize: 11, color: th.textDim, fontWeight: 500 }}>
                {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, emps.length)} / {emps.length}
              </span>
            </div>
          )}
        </div>

        {/* ── Active Tasks Legend ── */}
        <div style={{ marginTop: 16, padding: '16px 20px', background: th.bgCard, borderRadius: 8, border: `1px solid ${th.border}` }}>
          <div style={{
            fontSize: 10, color: th.goldDim, marginBottom: 12, fontWeight: 700,
            letterSpacing: 2, textTransform: 'uppercase' as const,
          }}>{t.activeTasks ?? 'Active Tasks'} · {t.kw ?? 'KW'} {kw} · {activeTaskIds.size}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
            {Array.from(activeTaskIds).map(tid => {
              const task = taskById[tid];
              if (!task) return null;
              const color = getTaskColor(tid);
              const count = Object.values(jobMap).reduce((s, u) =>
                s + Object.values(u).reduce((ss, arr) => ss + arr.filter(j => j.task_id === tid).length, 0), 0);
              return (
                <div key={tid} style={{
                  padding: '8px 12px', background: th.legendItemBg, borderRadius: 6,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderLeft: `3px solid ${color}`,
                }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{
                      fontSize: 12, fontWeight: 600, color: th.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    }}>{task.name}</div>
                    <div style={{ fontSize: 9, color: th.textDim }}>
                      {task.code} · {task.schedule_type === 'UNTERHALT' ? 'UH' : 'GT'}
                      {task.customer ? ` · ${task.customer.name}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: th.gold, fontWeight: 700, marginLeft: 8, flexShrink: 0 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Absences Legend ── */}
        <div style={{ marginTop: 16, padding: '16px 20px', background: th.bgCard, borderRadius: 8, border: `1px solid ${th.border}` }}>
          <div style={{
            fontSize: 10, color: th.goldDim, marginBottom: 12, fontWeight: 700,
            letterSpacing: 2, textTransform: 'uppercase' as const,
          }}>{t.absenceLegend ?? 'Absences'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 4 }}>
            {Object.entries(t.abs || {}).map(([code, label]) => {
              const abs = ABS[code as unknown as keyof typeof ABS];
              return (
                <div key={code} style={{
                  padding: '6px 10px', background: th.legendItemBg, borderRadius: 4,
                  display: 'flex', alignItems: 'center', gap: 8,
                  borderLeft: `3px solid ${abs?.bg || '#666'}`,
                }}>
                  <span style={{ fontSize: 14 }}>{abs?.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: th.textMuted }}>{label as string}</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* ══════════ CELL DETAIL MODAL ══════════ */}
      {cellModal && (() => {
        const modalEmp = allUsers.find(u => u.id === cellModal.userId);
        if (!modalEmp) return null;
        return (
          <CellDetailModal
            user={modalEmp}
            day={cellModal.day}
            dayLabel={(t.days as string[])[cellModal.day] ?? ''}
            dateLabel={fmtDate(dates[cellModal.day])}
            dateISO={format(dates[cellModal.day], 'yyyy-MM-dd')}
            jobs={getCellJobs(cellModal.userId, cellModal.day)}
            tasks={tasks}
            customers={customers}
            machines={machines}
            absences={getCellAbsences(cellModal.userId, cellModal.day)}
            activeTaskIds={activeTaskIds}
            weekIds={Array.from(weekIds)}
            allWeekJobs={jobs}
            canEdit={canEdit}
            isDark={isDark}
            th={th}
            lang={lang}
            gold={th.gold}
            authHeaders={authHeaders}
            apiUrl={API}
            onClose={() => setCellModal(null)}
            onRefresh={refreshCellData}
            showToast={showToast}
            getTaskColor={getTaskColor}
          />
        );
      })()}

      {/* ══════════ BULK PICKER ══════════ */}
      {canEdit && bulkPicker && (
        <div ref={bulkRef} style={{
          position: 'fixed',
          top: Math.min(bulkPicker.rect.bottom + 4, window.innerHeight - 420),
          left: Math.min(bulkPicker.rect.left, window.innerWidth - 360),
          width: 340, maxHeight: 400,
          background: th.modalCard, border: `1px solid ${th.gold}`, borderRadius: 8,
          boxShadow: isDark ? '0 12px 40px rgba(0,0,0,.6)' : '0 12px 40px rgba(0,0,0,.15)',
          zIndex: 9999, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden',
          animation: 'scaleIn .15s ease',
          opacity: bulkLoading ? 0.6 : 1,
          pointerEvents: bulkLoading ? 'none' as const : 'auto' as const,
        }}>
          <div style={{
            padding: '10px 12px', borderBottom: `1px solid ${th.border}`,
            background: isDark ? 'rgba(200,169,110,.05)' : 'rgba(200,169,110,.03)',
          }}>
            <div style={{
              fontSize: 10, color: th.gold, fontWeight: 700, letterSpacing: 1,
              marginBottom: 6, textTransform: 'uppercase' as const,
            }}>
              {bulkPicker.type === 'day'
                ? `▼ ${(t.days as string[])[bulkPicker.day!]} — ${t.bulkDay ?? 'Bulk Day'}`
                : `▶ ${allUsers.find(u => u.id === bulkPicker.userId)?.first_name} ${allUsers.find(u => u.id === bulkPicker.userId)?.last_name} — ${t.bulkEmployee ?? 'Bulk Employee'}`
              }
            </div>
            <input ref={bulkSearchRef} placeholder={t.searchTasks ?? 'Search tasks...'} value={bulkSearch}
              onChange={e => setBulkSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 4, border: `1px solid ${th.border}`,
                background: th.bg, color: th.text, fontSize: 12, outline: 'none',
              }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' as const, padding: '4px 0' }}>
            {bulkPickerTasks.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center' as const, color: th.textDim, fontSize: 12 }}>{t.noMatch ?? 'No match'}</div>
            ) : bulkPickerTasks.map(task => {
              const color = getTaskColor(task.id);
              const isUsedThisWeek = activeTaskIds.has(task.id);
              return (
                <div key={task.id}
                  onClick={() => bulkAssignTask(task.id)}
                  style={{
                    padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    borderLeft: '3px solid transparent', transition: 'background .1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: th.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    }}>{task.name}</div>
                    <div style={{ fontSize: 9, color: th.textDim }}>
                      {task.code} · {task.schedule_type === 'UNTERHALT' ? 'UH' : 'GT'}
                      {task.customer ? ` · ${task.customer.name}` : ''}
                    </div>
                  </div>
                  {isUsedThisWeek && (
                    <span style={{
                      fontSize: 8, color: th.textDim, flexShrink: 0,
                      background: th.switchActive, padding: '2px 5px', borderRadius: 3,
                    }}>{t.kw ?? 'KW'}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ borderTop: `1px solid ${th.border}`, padding: '8px 12px', display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
            {Object.entries(t.abs || {}).map(([code, label]) => {
              const abs = ABS[code as unknown as keyof typeof ABS];
              return (
                <button key={code} onClick={() => bulkAssignAbsence(code)}
                  style={{
                    padding: '4px 8px', borderRadius: 4, border: 'none', background: `${abs?.bg}33`,
                    color: isDark ? abs?.textD : abs?.textL, fontSize: 9, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                  title={label as string}
                ><span>{abs?.icon}</span>{label as string}</button>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlide { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes bulkProgress { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes cdm-fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cdm-scaleIn { from { transform: scale(.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}

/* ─── Style helpers ─── */
function navBtn(th: Theme): React.CSSProperties {
  return {
    width: 36, height: 36, borderRadius: 6, border: `1px solid ${th.border}`,
    background: 'transparent', color: th.gold, fontSize: 20, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all .15s', fontWeight: 300,
  };
}

function thBase(th: Theme): React.CSSProperties {
  return { borderBottom: `1px solid ${th.border}`, padding: 0 };
}

function pageBtn(th: Theme, isDark: boolean, isActive: boolean, isDisabled: boolean): React.CSSProperties {
  return {
    width: 32, height: 32, borderRadius: 4, border: `1px solid ${isActive ? th.gold : th.border}`,
    background: isActive ? (isDark ? 'rgba(200,169,110,.15)' : 'rgba(200,169,110,.1)') : 'transparent',
    color: isActive ? th.gold : isDisabled ? th.textGhost : th.textDim,
    fontSize: 13, fontWeight: isActive ? 700 : 500, cursor: isDisabled ? 'default' : 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all .15s', opacity: isDisabled ? 0.4 : 1,
  };
}
