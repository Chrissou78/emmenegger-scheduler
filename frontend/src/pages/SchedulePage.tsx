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
import { CellDetailModal } from '../components/CellDetailModal'; // ★ NEW

/* ─── Theme type ─── */
type Theme = typeof themes.dark;

/* ─── Types ─── */
interface Allocation { id: string; user_id: string; task_id: string; day_of_week: number; week_id: string; time_slot: number; }
interface User { id: string; first_name: string; last_name: string; department: string; departments?: string[]; role?: string; team_leader_id?: string | null; executive_id?: string | null; }
interface Week { id: string; week_number: number; year: number; schedule_type: string; status: string; }
interface Task { id: string; code: string; name: string; color: string; schedule_type: string; status?: string; customer?: { id: string; name: string } | null; }
interface Machine {
  id: string; name: string; category: string; status: string;
  inventory_nr?: string; tonnage?: number; is_active?: boolean;
}

interface MachineAllocation {
  id: string; machine_id: string; user_id?: string; task_id?: string;
  week_id: string;
  day_of_week: number;
  date?: string; start_time?: string; end_time?: string;
  machine?: Machine;
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

/* ─── Pagination constant ─── */
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
  const [rawAllocs, setRawAllocs] = useState<Allocation[]>([]);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  const [selectedTeamLeaderId, setSelectedTeamLeaderId] = useState<string | null>(null);

  // ★ Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // ★ NEW — Machines, machine allocations, absences
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineAllocs, setMachineAllocs] = useState<MachineAllocation[]>([]);
  const [absenceRecords, setAbsenceRecords] = useState<AbsenceRecord[]>([]);

  // ★ NEW — Cell detail modal state (replaces single-cell picker for click)
  const [cellModal, setCellModal] = useState<{ userId: string; day: number } | null>(null);

  // Single cell picker (kept for legacy / quick-add via right-click or similar)
  const [picker, setPicker] = useState<{ userId: string; day: number; rect: DOMRect } | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Bulk picker (column / row)
  const [bulkPicker, setBulkPicker] = useState<{ type: 'day' | 'employee'; day?: number; userId?: string; rect: DOMRect } | null>(null);
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const bulkRef = useRef<HTMLDivElement>(null);
  const bulkSearchRef = useRef<HTMLInputElement>(null);

  // Absence modal
  const [absModal, setAbsModal] = useState<{ userId: string; day: number } | null>(null);

  const dates = getWeekDates(weekOff);
  const kw = getKW(dates[0]);
  const year = dates[0].getFullYear();

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

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

  // ★ Reset page to 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [dept, selectedTeamLeaderId, weekOff, scheduleScope]);

  // ★ Pagination derived values
  const totalPages = useMemo(() => Math.max(1, Math.ceil(emps.length / PAGE_SIZE)), [emps.length]);
  const pagedEmps = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return emps.slice(start, start + PAGE_SIZE);
  }, [emps, currentPage]);

  const matchingWeeks = useMemo(() => weeks.filter(w => w.week_number === kw && w.year === year), [weeks, kw, year]);
  const weekIds = useMemo(() => new Set(matchingWeeks.map(w => w.id)), [matchingWeeks]);

  const allocMap = useMemo(() => {
    const m: Record<string, Record<number, { taskIds: string[]; allocIds: string[] }>> = {};
    rawAllocs.forEach(a => {
      if (!weekIds.has(a.week_id)) return;
      if (!m[a.user_id]) m[a.user_id] = {};
      if (!m[a.user_id][a.day_of_week]) m[a.user_id][a.day_of_week] = { taskIds: [], allocIds: [] };
      if (!m[a.user_id][a.day_of_week].taskIds.includes(a.task_id)) {
        m[a.user_id][a.day_of_week].taskIds.push(a.task_id);
        m[a.user_id][a.day_of_week].allocIds.push(a.id);
      }
    });
    return m;
  }, [rawAllocs, weekIds]);

  const taskById = useMemo(() => {
    const m: Record<string, Task> = {};
    tasks.forEach(tk => { m[tk.id] = tk; });
    return m;
  }, [tasks]);

  // ★ NEW — machine lookup
  const machineById = useMemo(() => {
    const m: Record<string, Machine> = {};
    machines.forEach(mc => { m[mc.id] = mc; });
    return m;
  }, [machines]);

  const totalSlots = useMemo(() =>
    Object.values(allocMap).reduce((s, u) => s + Object.values(u).reduce((ss, d) => ss + d.taskIds.length, 0), 0),
  [allocMap]);

  const activeTaskIds = useMemo(() => {
    const s = new Set<string>();
    Object.values(allocMap).forEach(u => Object.values(u).forEach(d => d.taskIds.forEach(id => s.add(id))));
    return s;
  }, [allocMap]);

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
  const fetchAllocations = async () => {
    if (matchingWeeks.length === 0) { setRawAllocs([]); return; }
    const all: Allocation[] = [];
    for (const w of matchingWeeks) {
      try {
        const r = await fetch(`${API}/api/v1/allocations?week_id=${w.id}`, { headers: authHeaders });
        if (!r.ok) continue;
        const d = await r.json();
        if (Array.isArray(d.data)) all.push(...d.data);
      } catch {}
    }
    setRawAllocs(all);
  };

  // ★ NEW — fetch machines
  const fetchMachines = async () => {
    try {
      const r = await fetch(`${API}/api/v1/machines`, { headers: authHeaders });
      if (!r.ok) return;
      const d = await r.json();
      setMachines(Array.isArray(d) ? d : d.data || []);
    } catch {}
  };

  const fetchMachineAllocations = async () => {
    if (matchingWeeks.length === 0) { setMachineAllocs([]); return; }
    const all: MachineAllocation[] = [];
    for (const w of matchingWeeks) {
      try {
        const r = await fetch(`${API}/api/v1/machines/allocations?weekId=${w.id}`, { headers: authHeaders });
        if (!r.ok) continue;
        const d = await r.json();
        const arr = Array.isArray(d) ? d : d.data || [];
        // Ensure week_id is always set
        all.push(...arr.map((ma: any) => ({ ...ma, week_id: ma.week_id || w.id })));
      } catch {}
    }
    setMachineAllocs(all);
  };

  // ★ NEW — fetch absence records for the current week
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

  // ★ NEW — refresh all cell-related data (called by modal after changes)
  const refreshCellData = useCallback(async () => {
    await Promise.all([fetchAllocations(), fetchMachineAllocations(), fetchAbsenceRecords()]);
  }, [matchingWeeks, dates, authHeaders]);

  // ★ NEW — helpers to get cell-specific machine allocs and absences
  const getCellMachineAllocs = useCallback((userId: string, day: number): MachineAllocation[] => {
    return machineAllocs.filter(ma =>
      ma.user_id === userId && ma.day_of_week === day && (!ma.week_id || weekIds.has(ma.week_id))
    );
  }, [machineAllocs, weekIds]);

  const getCellAbsences = useCallback((userId: string, day: number): AbsenceRecord[] => {
    const dateStr = format(dates[day], 'yyyy-MM-dd');
    return absenceRecords.filter(ab =>
      ab.user_id === userId && (
        ab.date === dateStr ||
        (ab.day_of_week === day && ab.week_id && weekIds.has(ab.week_id))
      )
    );
  }, [absenceRecords, dates, weekIds]);

  useEffect(() => { fetchWeeks(); fetchTasks(); fetchUsers(); fetchMachines(); }, []); // ★ added fetchMachines
  useEffect(() => {
    if (weeks.length > 0) {
      fetchAllocations();
      fetchMachineAllocations();  // ★ NEW
      fetchAbsenceRecords();      // ★ NEW
    }
  }, [weekOff, weeks]);
  useEffect(() => { if (toast) { const tm = setTimeout(() => setToast(null), 3000); return () => clearTimeout(tm); } }, [toast]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPicker(null);
    };
    if (picker) { document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler); }
  }, [picker]);
  useEffect(() => { if (picker && searchRef.current) searchRef.current.focus(); }, [picker]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bulkRef.current && !bulkRef.current.contains(e.target as Node)) setBulkPicker(null);
    };
    if (bulkPicker) { document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler); }
  }, [bulkPicker]);
  useEffect(() => { if (bulkPicker && bulkSearchRef.current) bulkSearchRef.current.focus(); }, [bulkPicker]);

  /* ─── Cell helpers ─── */
  const getCell = (userId: string, day: number) => allocMap[userId]?.[day] || { taskIds: [], allocIds: [] };

  const getTaskColor = (taskId: string) => {
    const task = taskById[taskId];
    return task?.color && task.color !== '#8B7355' ? task.color : hashColor(taskId);
  };

  /* ─── Single cell actions ─── */
  // ★ CHANGED: cell click now opens the CellDetailModal
  const openCellModal = (userId: string, day: number) => {
    if (!canEdit && !canView) return;
    setBulkPicker(null);
    setPicker(null);
    setCellModal({ userId, day });
  };

  const assignTask = async (taskId: string) => {
    if (!picker) return;
    const { userId, day } = picker;
    const cell = getCell(userId, day);
    if (cell.taskIds.includes(taskId)) { setPicker(null); return; }
    if (cell.taskIds.length >= 2) { showToast(t.max2 ?? 'Max 2', true); setPicker(null); return; }

    const task = taskById[taskId];
    const week = matchingWeeks.find(w => task && w.schedule_type === task.schedule_type) || matchingWeeks[0];
    if (!week) { showToast(t.weekNotFound ?? 'Week not found', true); setPicker(null); return; }

    try {
      const r = await fetch(`${API}/api/v1/allocations`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ user_id: userId, task_id: taskId, day_of_week: day, week_id: week.id, time_slot: cell.taskIds.length + 1 }),
      });
      if (r.ok) {
        const empName = allUsers.find(u => u.id === userId)?.first_name || '';
        showToast(`${task?.name || ''} → ${empName}`);
        await fetchAllocations();
      } else { showToast(t.error ?? 'Error', true); }
    } catch { showToast(t.networkError ?? 'Network error', true); }
    setPicker(null);
  };

  const removeAlloc = async (allocId: string) => {
    if (!canEdit) return;
    try {
      const r = await fetch(`${API}/api/v1/allocations/${allocId}`, { method: 'DELETE', headers: authHeaders });
      if (r.ok) { showToast(t.removed ?? 'Removed'); await fetchAllocations(); }
    } catch { showToast(t.networkError ?? 'Network error', true); }
  };

  const assignAbsence = async (userId: string, day: number, code: string) => {
    if (!canEdit) return;
    try {
      const r = await fetch(`${API}/api/v1/absences`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ userId, date: format(dates[day], 'yyyy-MM-dd'), absenceCode: parseInt(code), source: 'MANUAL' }),
      });
      if (r.ok) {
        showToast(`${(t.abs as any)?.[code] ?? code} → ${allUsers.find(u => u.id === userId)?.first_name || ''}`);
      }
    } catch { showToast(t.networkError ?? 'Network error', true); }
    setAbsModal(null);
    setPicker(null);
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
        const cell = getCell(emp.id, bulkPicker.day!);
        if (cell.taskIds.length >= 2 || cell.taskIds.includes(taskId)) { skip++; continue; }
        try {
          const r = await fetch(`${API}/api/v1/allocations`, {
            method: 'POST', headers: authHeaders,
            body: JSON.stringify({ user_id: emp.id, task_id: taskId, day_of_week: bulkPicker.day, week_id: week.id, time_slot: cell.taskIds.length + 1 }),
          });
          if (r.ok) success++; else skip++;
        } catch { skip++; }
      }
    } else if (bulkPicker.type === 'employee' && bulkPicker.userId) {
      for (let day = 0; day < 6; day++) {
        const cell = getCell(bulkPicker.userId, day);
        if (cell.taskIds.length >= 2 || cell.taskIds.includes(taskId)) { skip++; continue; }
        try {
          const r = await fetch(`${API}/api/v1/allocations`, {
            method: 'POST', headers: authHeaders,
            body: JSON.stringify({ user_id: bulkPicker.userId, task_id: taskId, day_of_week: day, week_id: week.id, time_slot: cell.taskIds.length + 1 }),
          });
          if (r.ok) success++; else skip++;
        } catch { skip++; }
      }
    }

    await fetchAllocations();
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

    await fetchAllocations();
    setBulkLoading(false);
    setBulkPicker(null);
    showToast(`${(t.abs as any)?.[code] ?? code}: ${success} ✓${skip > 0 ? ` · ${skip} ${t.skipped ?? 'skipped'}` : ''}`);
  };

  /* ─── Filtered picker tasks ─── */
  const pickerTasks = useMemo(() => {
    if (!picker) return [];
    const s = pickerSearch.toLowerCase();
    let list = tasks.filter(tk => tk.status !== 'CANCELLED');
    if (s) {
      list = list.filter(tk =>
        tk.name.toLowerCase().includes(s) ||
        tk.code.toLowerCase().includes(s) ||
        (tk.customer?.name || '').toLowerCase().includes(s)
      );
    }
    const usedIds = activeTaskIds;
    list.sort((a, b) => {
      const aUsed = usedIds.has(a.id) ? 0 : 1;
      const bUsed = usedIds.has(b.id) ? 0 : 1;
      if (aUsed !== bUsed) return aUsed - bUsed;
      return a.name.localeCompare(b.name);
    });
    return list.slice(0, 50);
  }, [picker, pickerSearch, tasks, activeTaskIds]);

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
    const usedIds = activeTaskIds;
    list.sort((a, b) => {
      const aUsed = usedIds.has(a.id) ? 0 : 1;
      const bUsed = usedIds.has(b.id) ? 0 : 1;
      if (aUsed !== bUsed) return aUsed - bUsed;
      return a.name.localeCompare(b.name);
    });
    return list.slice(0, 50);
  }, [bulkPicker, bulkSearch, tasks, activeTaskIds]);

  const deptLabel = (d: string) => d === 'garten' ? (t.gartenFull ?? 'Garten & Tiefbau') : d === 'unterhalt' ? (t.unterhaltFull ?? 'Unterhalt') : (t.bothDept ?? 'All');

  /* ═══════════════════════════════════════ ACCESS GUARD ═══════════════════════════════════════ */
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
                    <option key={tl.id} value={tl.id}>
                      {tl.first_name} {tl.last_name}
                    </option>
                  ))}
                </select>
                {selectedTeamLeaderId && (
                  <button
                    onClick={() => setSelectedTeamLeaderId(null)}
                    style={{
                      padding: '4px 8px', borderRadius: 4, border: 'none',
                      background: 'rgba(239,68,68,.15)', color: '#ef4444',
                      fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    }}
                  >✕</button>
                )}
              </div>
            )}

            {/* Scope indicator for team leaders */}
            {scheduleScope === 'team' && (
              <div style={{
                marginLeft: 12, padding: '4px 10px', borderRadius: 4,
                background: isDark ? 'rgba(34,197,94,.1)' : 'rgba(34,197,94,.06)',
                border: '1px solid rgba(34,197,94,.3)',
                fontSize: 10, fontWeight: 600, color: '#22c55e',
              }}>
                {t.myTeam ?? 'My Team'}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { v: emps.length, l: t.employees ?? 'Employees' },
              { v: totalSlots, l: t.assignments ?? 'Assignments' },
              { v: activeTaskIds.size, l: t.objects ?? 'Objects' },
            ].map((s) => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 300, color: th.gold, lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: 8, color: th.textGhost, marginTop: 3, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Schedule Grid ── */}
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
                }}>
                  {t.employees ?? 'Employees'}
                </th>
                {(t.days as string[]).map((d: string, i: number) => (
                  <th key={d}
                    style={{
                      ...thBase(th), background: th.goldGhost, textAlign: 'center' as const, padding: '6px',
                      cursor: canEdit ? 'pointer' : 'default',
                    }}
                    onClick={e => {
                      if (!canEdit) return;
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setPicker(null);
                      setCellModal(null); // ★ close modal if open
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
                  <td colSpan={8} style={{
                    textAlign: 'center', padding: 40, color: th.textDim, fontSize: 14,
                  }}>
                    {selectedTeamLeaderId
                      ? (t.noEmployeesForTL ?? 'No employees found for this team leader')
                      : (t.noResults ?? 'No results')}
                  </td>
                </tr>
              )}
              {pagedEmps.map((emp, idx) => (
                <tr key={emp.id} style={{
                  height: 56,
                  borderTop: idx > 0 ? `1px solid ${th.borderFaint}` : 'none',
                  transition: 'background .15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = th.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Role badge */}
                  <td style={{
                    textAlign: 'center' as const, borderRight: `1px solid ${th.borderFaint}`,
                    fontSize: 11, fontWeight: 700,
                    color: emp.department === 'garten' ? th.roleV : th.roleM,
                    padding: '4px',
                  }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28, borderRadius: 6,
                      background: emp.department === 'garten'
                        ? (isDark ? 'rgba(74,103,65,.2)' : 'rgba(74,103,65,.08)')
                        : (isDark ? 'rgba(125,78,87,.2)' : 'rgba(125,78,87,.08)'),
                      fontSize: 10, fontWeight: 800, letterSpacing: .5,
                    }}>
                      {emp.department === 'garten' ? 'GT' : 'UH'}
                    </div>
                  </td>
                  {/* Name — 2-line layout */}
                  <td style={{
                    padding: '6px 14px', borderRight: `1px solid ${th.borderFaint}`,
                    cursor: canEdit ? 'pointer' : 'default',
                    verticalAlign: 'middle' as const,
                  }}
                    onClick={e => {
                      if (!canEdit) return;
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setPicker(null);
                      setCellModal(null); // ★ close modal if open
                      setBulkPicker({ type: 'employee', userId: emp.id, rect });
                      setBulkSearch('');
                    }}
                    title={canEdit ? `${t.bulkEmployee ?? 'Bulk assign employee'}: ${emp.first_name}` : undefined}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: th.empName, lineHeight: 1.3 }}>
                      {emp.first_name}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: th.text, lineHeight: 1.3, opacity: 0.7 }}>
                      {emp.last_name}
                    </div>
                    <div style={{
                      fontSize: 9, color: th.textGhost, fontWeight: 500,
                      letterSpacing: 1, textTransform: 'uppercase' as const, marginTop: 2,
                    }}>
                      {deptLabel(emp.department)}{canEdit ? ' · ▶' : ''}
                    </div>
                  </td>
                  {/* Day cells — ★ CHANGED: onClick opens CellDetailModal */}
                  {(t.days as string[]).map((_: string, di: number) => {
                    const cell = getCell(emp.id, di);
                    const hasTasks = cell.taskIds.length > 0;
                    const cellMachines = getCellMachineAllocs(emp.id, di);    // ★ NEW
                    const cellAbs = getCellAbsences(emp.id, di);              // ★ NEW
                    return (
                      <td key={di} style={{
                        borderRight: di < 5 ? `1px solid ${th.borderFaint}` : 'none',
                        padding: '4px 5px', position: 'relative' as const,
                        cursor: 'pointer',
                        verticalAlign: 'middle' as const,
                      }}
                        onClick={() => openCellModal(emp.id, di)}  /* ★ CHANGED */
                      >
                        {hasTasks ? (
                          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2, height: '100%', justifyContent: 'center' }}>
                            {cell.taskIds.map((tid, tidx) => {
                              const task = taskById[tid];
                              const color = getTaskColor(tid);
                              return (
                                <div key={tid} style={{
                                  background: isDark ? `${color}33` : `${color}22`,
                                  borderLeft: `3px solid ${color}`,
                                  borderRadius: 4, padding: '4px 8px',
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  minHeight: 22,
                                }} title={task?.name || tid}>
                                  <span style={{
                                    fontSize: 11, fontWeight: 600, color: isDark ? '#ddd' : '#333',
                                    overflow: 'hidden', textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap' as const, flex: 1,
                                  }}>
                                    {task?.name || task?.code || '?'}
                                  </span>
                                  {canEdit && (
                                    <span style={{
                                      fontSize: 12, color: th.textDim, cursor: 'pointer',
                                      marginLeft: 6, lineHeight: 1, flexShrink: 0,
                                      borderRadius: 3, width: 16, height: 16,
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      transition: 'background .15s',
                                    }}
                                      onClick={e => { e.stopPropagation(); removeAlloc(cell.allocIds[tidx]); }}
                                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,.15)'; e.currentTarget.style.color = '#ef4444'; }}
                                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = th.textDim; }}
                                      title={t.remove ?? 'Remove'}
                                    >×</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            height: '100%', color: th.textGhost, fontSize: 20, fontWeight: 300,
                          }}>{canEdit ? '+' : ''}</div>
                        )}
                        {/* ★ NEW — Small indicators for machines & absences */}
                        {(cellMachines.length > 0 || cellAbs.length > 0) && (
                          <div style={{
                            position: 'absolute', bottom: 2, right: 4,
                            display: 'flex', gap: 3, alignItems: 'center',
                          }}>
                            {cellMachines.length > 0 && (
                              <span style={{ fontSize: 9, opacity: 0.6 }} title={`${cellMachines.length} machine(s)`}>
                                🚜{cellMachines.length > 1 ? cellMachines.length : ''}
                              </span>
                            )}
                            {cellAbs.length > 0 && (
                              <span style={{ fontSize: 9, opacity: 0.6 }} title={`${cellAbs.length} absence(s)`}>
                                🏥{cellAbs.length > 1 ? cellAbs.length : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* PAGINATION CONTROLS */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '14px 20px',
              borderTop: `1px solid ${th.border}`,
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
          }}>
            {t.activeTasks ?? 'Active Tasks'} · {t.kw ?? 'KW'} {kw} · {activeTaskIds.size}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
            {Array.from(activeTaskIds).map(tid => {
              const task = taskById[tid];
              if (!task) return null;
              const color = getTaskColor(tid);
              const count = Object.values(allocMap).reduce((s, u) =>
                s + Object.values(u).reduce((ss, d) => ss + (d.taskIds.includes(tid) ? 1 : 0), 0), 0);
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
          }}>
            {t.absenceLegend ?? 'Absences'}
          </div>
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

      {/* ══════════ ★ NEW — CELL DETAIL MODAL ══════════ */}
      {cellModal && (() => {
        const modalEmp = allUsers.find(u => u.id === cellModal.userId);
        if (!modalEmp) return null;
        const cell = getCell(cellModal.userId, cellModal.day);
        const cellAllocations = cell.allocIds.map((aid, i) => {
          const raw = rawAllocs.find(a => a.id === aid);
          return raw || { id: aid, user_id: cellModal.userId, task_id: cell.taskIds[i], day_of_week: cellModal.day, week_id: '', time_slot: i + 1 };
        });
        return (
          <CellDetailModal
            user={modalEmp}
            day={cellModal.day}
            dayLabel={(t.days as string[])[cellModal.day] ?? ''}
            dateLabel={fmtDate(dates[cellModal.day])}
            dateISO={format(dates[cellModal.day], 'yyyy-MM-dd')}
            allocations={cellAllocations}
            tasks={tasks}
            taskById={taskById}
            machines={machines}
            machineAllocations={getCellMachineAllocs(cellModal.userId, cellModal.day)}
            absences={getCellAbsences(cellModal.userId, cellModal.day)}
            activeTaskIds={activeTaskIds}
            weekIds={Array.from(weekIds)}
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

      {/* ══════════ BULK TASK PICKER (column / row) ══════════ */}
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

      {/* ══════════ ABSENCE MODAL (fallback) ══════════ */}
      {canEdit && absModal && (
        <div style={{
          position: 'fixed', inset: 0, background: th.modalBg, display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 500,
        }} onClick={() => setAbsModal(null)}>
          <div style={{
            background: th.modalCard, border: `1px solid ${th.border}`,
            borderRadius: 8, padding: 24, width: 280,
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              fontSize: 9, color: th.goldDim, fontWeight: 700, letterSpacing: 2,
              textTransform: 'uppercase' as const, marginBottom: 6,
            }}>{t.setAbsence ?? 'Set Absence'}</div>
            <div style={{ fontSize: 16, fontWeight: 400, color: th.gold, marginBottom: 16 }}>
              {allUsers.find(u => u.id === absModal.userId)?.first_name} · {(t.days as string[])[absModal.day]}
            </div>
            {Object.entries(t.abs || {}).map(([code, label]) => {
              const abs = ABS[code as unknown as keyof typeof ABS];
              return (
                <button key={code} onClick={() => assignAbsence(absModal.userId, absModal.day, code)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '9px 12px', marginBottom: 3, borderRadius: 4, border: 'none',
                    background: th.btnBg, borderLeft: `3px solid ${abs?.bg}`,
                    color: th.textMuted, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    textAlign: 'left' as const,
                  }}
                ><span style={{ fontSize: 14 }}>{abs?.icon}</span>{label as string}</button>
              );
            })}
            <button onClick={() => setAbsModal(null)} style={{
              marginTop: 12, width: '100%', padding: 8, borderRadius: 4,
              border: `1px solid ${th.borderFaint}`, background: 'transparent',
              color: th.textDim, cursor: 'pointer', fontSize: 10, fontWeight: 600,
              letterSpacing: 1, textTransform: 'uppercase' as const,
            }}>{t.cancel ?? 'Cancel'}</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlide { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes bulkProgress { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${th.scrollThumb}; border-radius: 2px; }
      `}</style>
    </div>
  );
}

/* ─── Style helpers ─── */
function navBtn(th: Theme): React.CSSProperties {
  return {
    width: 32, height: 32, borderRadius: 4, border: `1px solid ${th.goldFaint}`,
    background: 'transparent', color: th.gold, cursor: 'pointer', fontSize: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}
function thBase(th: Theme): React.CSSProperties {
  return { padding: 0, borderBottom: `1px solid ${th.border}`, borderRight: `1px solid ${th.borderFaint}` };
}

function pageBtn(th: Theme, isDark: boolean, isActive: boolean, isDisabled: boolean): React.CSSProperties {
  return {
    width: 32, height: 32, borderRadius: 6,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: isActive ? 800 : 500,
    cursor: isDisabled ? 'default' : 'pointer',
    opacity: isDisabled ? 0.3 : 1,
    background: isActive
      ? (isDark ? 'rgba(200,169,110,.2)' : 'rgba(200,169,110,.15)')
      : 'transparent',
    color: isActive ? th.gold : th.text,
    border: isActive ? `1px solid ${th.gold}` : `1px solid transparent`,
    transition: 'all .15s',
  };
}
