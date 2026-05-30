// frontend/src/pages/MachineSchedulePage.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../contexts/themeContext';
import { themes, ABS } from '../i18n/translations';
import { format } from 'date-fns';
import { useAuthStore } from '../contexts/authStore';
import { useRolesStore } from '../store/rolesStore';
import {
  resolvePermissions,
  getScheduleScope,
  type Role,
  type Permission,
} from '../../../shared/constants/roles';
import { getTranslations, type LangCode } from '../i18n';

/* ─── Theme type ─── */
type Theme = typeof themes.dark;

/* ─── Types ─── */
interface User {
  id: string; first_name: string; last_name: string; department: string;
  departments?: string[]; role?: string;
}
interface Week {
  id: string; week_number: number; year: number; schedule_type: string; status: string;
}
interface Task {
  id: string; code: string; name: string; color: string; schedule_type: string;
  status?: string; customer_id?: string;
  customer?: { id: string; name: string; city?: string } | null;
}
interface Customer {
  id: string; name: string; company_name?: string; address?: string;
  street?: string; city?: string; postal_code?: string;
  contact_name?: string; contact_phone?: string;
}
interface Machine {
  id: string; name: string; category: string;
  inventory_nr?: string; tonnage?: number; is_active?: boolean;
  type?: string; brand?: string; model?: string; license_plate?: string;
  department?: string; status?: string;
}
interface JobMachine {
  id: string; machine_id: string; machine?: Machine;
}
interface Job {
  id: string; week_id: string; user_id: string; day_of_week: number;
  time_slot: number; task_id: string; customer_id?: string | null;
  notes?: string | null; task?: Task; machines?: JobMachine[];
}

const API = import.meta.env.VITE_API_URL || '';

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

/* ─── Category labels ─── */
const CATEGORY_LABELS: Record<string, string> = {
  EXCAVATOR: 'Excavator', DUMPER: 'Dumper', ROLLER: 'Roller', LOADER: 'Loader',
  CRANE: 'Crane', TRUCK: 'Truck', VAN: 'Van', CAR: 'Car', TRAILER: 'Trailer',
  MOWER: 'Mower', CHAINSAW: 'Chainsaw', COMPACTOR: 'Compactor', GENERATOR: 'Generator',
  PUMP: 'Pump', LIGHT_EQUIPMENT: 'Light Equipment', OTHER: 'Other',
};

const CATEGORY_ICONS: Record<string, string> = {
  EXCAVATOR: '⛏', DUMPER: '🚛', ROLLER: '🛞', LOADER: '🏗',
  CRANE: '🏗', TRUCK: '🚚', VAN: '🚐', CAR: '🚗', TRAILER: '🚜',
  MOWER: '🌿', CHAINSAW: '🪚', COMPACTOR: '🔨', GENERATOR: '⚡',
  PUMP: '💧', LIGHT_EQUIPMENT: '🔧', OTHER: '📦',
};

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

/* ─── Machine-to-day allocation entry ─── */
interface MachineAlloc {
  job: Job;
  employee: User | undefined;
  task: Task | undefined;
  customerName: string | null;
}

export function MachineSchedulePage() {
  const { isDark, lang } = useTheme();
  const th: Theme = isDark ? themes.dark : themes.light;
  const t = getTranslations(lang as LangCode);

  /* ─── Auth & Permissions ─── */
  const { user, token } = useAuthStore();
  const { permissionMap } = useRolesStore();

  const perms = useMemo(() => {
    const role: Role = user?.role || 'EMPLOYEE';
    return resolvePermissions(role, user?.custom_permissions, permissionMap);
  }, [user, permissionMap]);

  const canView = perms.has('machines.view' as Permission);

  /* ─── State ─── */
  const [weekOff, setWeekOff] = useState(0);
  const [machineSearch, setMachineSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const dates = getWeekDates(weekOff);
  const kw = getKW(dates[0]);
  const year = dates[0].getFullYear();

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  /* ─── Derived ─── */
  const matchingWeeks = useMemo(() => weeks.filter(w => w.week_number === kw && w.year === year), [weeks, kw, year]);
  const weekIds = useMemo(() => new Set(matchingWeeks.map(w => w.id)), [matchingWeeks]);

  const userById = useMemo(() => {
    const m: Record<string, User> = {};
    allUsers.forEach(u => { m[u.id] = u; });
    return m;
  }, [allUsers]);

  const taskById = useMemo(() => {
    const m: Record<string, Task> = {};
    tasks.forEach(tk => { m[tk.id] = tk; });
    return m;
  }, [tasks]);

  const customerById = useMemo(() => {
    const m: Record<string, Customer> = {};
    customers.forEach(c => { m[c.id] = c; });
    return m;
  }, [customers]);

  const getTaskColor = (taskId: string) => {
    const task = taskById[taskId];
    return task?.color && task.color !== '#8B7355' ? task.color : hashColor(taskId);
  };

  /* ─── Resolve customer name from a job ─── */
  const resolveCustomerName = useCallback((job: Job): string | null => {
    const rawCust = job.task?.customer;
    const customerObj = (rawCust && !Array.isArray(rawCust)) ? rawCust
      : (Array.isArray(rawCust) && rawCust.length > 0) ? (rawCust as any)[0]
      : null;
    if (customerObj?.name) return customerObj.name;
    if (job.customer_id) {
      const c = customerById[job.customer_id];
      if (c?.name) return c.name;
    }
    const task = job.task || taskById[job.task_id];
    if (task?.customer_id) {
      const c = customerById[task.customer_id];
      if (c?.name) return c.name;
    }
    return null;
  }, [customerById, taskById]);

  /* ─── Build machine → day → allocations map ─── */
  const machineAllocMap = useMemo(() => {
    // machine_id → day_of_week → MachineAlloc[]
    const m: Record<string, Record<number, MachineAlloc[]>> = {};

    jobs.forEach(job => {
      if (!weekIds.has(job.week_id)) return;
      const jm = job.machines || [];
      jm.forEach(machineLink => {
        const mid = machineLink.machine_id;
        if (!m[mid]) m[mid] = {};
        if (!m[mid][job.day_of_week]) m[mid][job.day_of_week] = [];
        m[mid][job.day_of_week].push({
          job,
          employee: userById[job.user_id],
          task: job.task || taskById[job.task_id],
          customerName: resolveCustomerName(job),
        });
      });
    });

    // Sort by time_slot
    Object.values(m).forEach(dayMap =>
      Object.values(dayMap).forEach(arr => arr.sort((a, b) => a.job.time_slot - b.job.time_slot))
    );

    return m;
  }, [jobs, weekIds, userById, taskById, resolveCustomerName]);

  /* ─── Active machines (only those with at least 1 allocation or in filter) ─── */
  const activeMachines = useMemo(() => {
    let list = machines.filter(m => m.is_active !== false);

    // Category filter
    if (filterCategory !== 'all') {
      list = list.filter(m => (m.category || '').toUpperCase() === filterCategory.toUpperCase());
    }

    // Search filter
    if (machineSearch.trim()) {
      const s = machineSearch.toLowerCase().trim();
      list = list.filter(m =>
        m.name.toLowerCase().includes(s) ||
        (m.inventory_nr || '').toLowerCase().includes(s) ||
        (m.category || '').toLowerCase().includes(s) ||
        (m.license_plate || '').toLowerCase().includes(s) ||
        (m.brand || '').toLowerCase().includes(s)
      );
    }

    return list.sort((a, b) => {
      // Sort: machines with allocations first, then by category, then name
      const aHas = machineAllocMap[a.id] ? 1 : 0;
      const bHas = machineAllocMap[b.id] ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      const catCmp = (a.category || '').localeCompare(b.category || '');
      if (catCmp !== 0) return catCmp;
      return a.name.localeCompare(b.name);
    });
  }, [machines, filterCategory, machineSearch, machineAllocMap]);

  /* ─── Group machines by category ─── */
  const groupedMachines = useMemo(() => {
    const groups: Record<string, Machine[]> = {};
    activeMachines.forEach(m => {
      const cat = (m.category || 'OTHER').toUpperCase();
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(m);
    });
    // Sort categories: those with allocations first
    const sorted = Object.entries(groups).sort(([catA, machinesA], [catB, machinesB]) => {
      const aAlloc = machinesA.some(m => machineAllocMap[m.id]);
      const bAlloc = machinesB.some(m => machineAllocMap[m.id]);
      if (aAlloc !== bAlloc) return bAlloc ? 1 : -1;
      return catA.localeCompare(catB);
    });
    return sorted;
  }, [activeMachines, machineAllocMap]);

  /* ─── Stats ─── */
  const stats = useMemo(() => {
    let totalAllocs = 0;
    let machinesInUse = 0;
    const uniqueTasks = new Set<string>();
    const uniqueEmployees = new Set<string>();

    Object.entries(machineAllocMap).forEach(([mid, dayMap]) => {
      let hasAlloc = false;
      Object.values(dayMap).forEach(allocs => {
        totalAllocs += allocs.length;
        hasAlloc = true;
        allocs.forEach(a => {
          uniqueTasks.add(a.job.task_id);
          uniqueEmployees.add(a.job.user_id);
        });
      });
      if (hasAlloc) machinesInUse++;
    });

    return { totalAllocs, machinesInUse, uniqueTasks: uniqueTasks.size, uniqueEmployees: uniqueEmployees.size };
  }, [machineAllocMap]);

  /* ─── Available categories for filter ─── */
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    machines.filter(m => m.is_active !== false).forEach(m => cats.add((m.category || 'OTHER').toUpperCase()));
    return Array.from(cats).sort();
  }, [machines]);

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
      if (!r.ok) return; const d = await r.json();
      setAllUsers(d.data || d.items || d || []);
    } catch {}
  };
  const fetchCustomers = async () => {
    try {
      const r = await fetch(`${API}/api/v1/customers?limit=200`, { headers: authHeaders });
      if (!r.ok) return; const d = await r.json();
      setCustomers(Array.isArray(d) ? d : d.data || []);
    } catch {}
  };
  const fetchMachines = async () => {
    try {
      const r = await fetch(`${API}/api/v1/machines`, { headers: authHeaders });
      if (!r.ok) return; const d = await r.json();
      setMachines(Array.isArray(d) ? d : d.data || []);
    } catch {}
  };
  const fetchJobs = async () => {
    if (matchingWeeks.length === 0) { setJobs([]); return; }
    setLoading(true);
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
    setLoading(false);
  };

  /* ─── Initial + week-change fetches ─── */
  useEffect(() => { fetchWeeks(); fetchTasks(); fetchUsers(); fetchMachines(); fetchCustomers(); }, []);
  useEffect(() => { if (weeks.length > 0) fetchJobs(); }, [weekOff, weeks]);
  useEffect(() => { if (toast) { const tm = setTimeout(() => setToast(null), 3000); return () => clearTimeout(tm); } }, [toast]);

  /* ═══ ACCESS GUARD ═══ */
  if (!canView) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: th.text }}>
        <h2>{t.accessDenied ?? 'Access Denied'}</h2>
        <p style={{ color: th.textDim, fontSize: 14, marginTop: 8 }}>
          {t.noAccessMachines ?? "You don't have access to the machine schedule view"}
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

      {/* Loading bar */}
      {loading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 10000,
          background: `linear-gradient(90deg, transparent, ${th.gold}, transparent)`,
          animation: 'bulkProgress 1.5s ease-in-out infinite',
        }} />
      )}

      <main style={{ padding: '20px 24px', opacity: loading ? 0.7 : 1 }}>

        {/* ── Header: week nav + filters + stats ── */}
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

            {/* Title badge */}
            <div style={{
              marginLeft: 12, padding: '6px 14px', borderRadius: 6,
              background: isDark ? 'rgba(66,165,245,.08)' : 'rgba(66,165,245,.06)',
              border: `1px solid ${isDark ? 'rgba(66,165,245,.2)' : 'rgba(66,165,245,.15)'}`,
              fontSize: 11, fontWeight: 700, color: '#42a5f5',
              letterSpacing: 1, textTransform: 'uppercase' as const,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 14 }}>🚜</span>
              {t.machineSchedule ?? 'Machine Schedule'}
            </div>

            {/* Category filter */}
            <div style={{ display: 'flex', gap: 3, marginLeft: 12, flexWrap: 'wrap' }}>
              <button onClick={() => setFilterCategory('all')} style={{
                padding: '4px 8px', borderRadius: 4, border: `1px solid ${filterCategory === 'all' ? th.gold : th.border}`,
                background: filterCategory === 'all' ? (isDark ? 'rgba(0,229,160,.1)' : 'rgba(5,150,105,.08)') : 'transparent',
                color: filterCategory === 'all' ? th.gold : th.textDim, cursor: 'pointer', fontSize: 9, fontWeight: 600,
              }}>{t.all ?? 'All'}</button>
              {availableCategories.map(cat => (
                <button key={cat} onClick={() => setFilterCategory(cat)} style={{
                  padding: '4px 8px', borderRadius: 4,
                  border: `1px solid ${filterCategory === cat ? th.gold : th.border}`,
                  background: filterCategory === cat ? (isDark ? 'rgba(0,229,160,.1)' : 'rgba(5,150,105,.08)') : 'transparent',
                  color: filterCategory === cat ? th.gold : th.textDim, cursor: 'pointer', fontSize: 9, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  <span style={{ fontSize: 10 }}>{CATEGORY_ICONS[cat] || '📦'}</span>
                  {(CATEGORY_LABELS[cat] || cat).slice(0, 10)}
                </button>
              ))}
            </div>

            {/* Machine Search */}
            <div style={{ marginLeft: 12, position: 'relative' as const }}>
              <input
                placeholder={t.searchMachine ?? 'Search machine...'}
                value={machineSearch}
                onChange={e => setMachineSearch(e.target.value)}
                style={{
                  padding: '6px 30px 6px 10px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                  border: `1px solid ${machineSearch ? th.gold : th.border}`,
                  background: machineSearch
                    ? (isDark ? 'rgba(0,229,160,.1)' : 'rgba(5,150,105,.06)')
                    : (isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)'),
                  color: th.text, outline: 'none', width: 170,
                  transition: 'border-color .15s, background .15s',
                }}
              />
              {machineSearch ? (
                <span
                  onClick={() => setMachineSearch('')}
                  style={{
                    position: 'absolute' as const, right: 8, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 12, color: '#ef4444', cursor: 'pointer', fontWeight: 700, lineHeight: 1,
                  }}
                >✕</span>
              ) : (
                <span style={{
                  position: 'absolute' as const, right: 8, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 12, color: th.textGhost, pointerEvents: 'none', lineHeight: 1,
                }}>&#x1F50D;</span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { v: activeMachines.length, l: t.machines ?? 'Machines' },
              { v: stats.machinesInUse, l: t.inUse ?? 'In Use' },
              { v: stats.totalAllocs, l: t.allocations ?? 'Allocations' },
              { v: stats.uniqueEmployees, l: t.employees ?? 'Employees' },
            ].map((s) => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 300, color: th.gold, lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: 8, color: th.textGhost, marginTop: 3, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════ MACHINE SCHEDULE GRID ══════════════════════════ */}
        <div style={{ background: th.bgCard, borderRadius: 8, border: `1px solid ${th.border}`, overflow: 'visible', position: 'relative' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 44 }} />
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
                }}>{t.machines ?? 'Machines'}</th>
                {(t.days as string[]).map((d: string, i: number) => (
                  <th key={d} style={{
                    ...thBase(th), background: th.goldGhost, textAlign: 'center' as const, padding: '6px',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: th.gold }}>{d}</div>
                    <div style={{ fontSize: 10, color: th.textGhost, fontWeight: 500, marginTop: 2 }}>{fmtDate(dates[i])}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeMachines.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: th.textDim, fontSize: 14 }}>
                    {machineSearch
                      ? (t.noSearchResults ?? `No machines matching "${machineSearch}"`)
                      : (t.noResults ?? 'No results')}
                  </td>
                </tr>
              )}

              {/* Render grouped by category */}
              {groupedMachines.map(([category, catMachines]) => {
                const catIcon = CATEGORY_ICONS[category] || '📦';
                const catLabel = CATEGORY_LABELS[category] || category;
                const catAllocCount = catMachines.reduce((sum, m) => {
                  const dayMap = machineAllocMap[m.id];
                  if (!dayMap) return sum;
                  return sum + Object.values(dayMap).reduce((ds, arr) => ds + arr.length, 0);
                }, 0);
                const isExpanded = expandedCategory === null || expandedCategory === category;

                return [
                  /* ─── Category header row ─── */
                  <tr key={`cat-${category}`}
                    onClick={() => setExpandedCategory(prev => prev === category ? null : category)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = th.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = isDark ? 'rgba(66,165,245,.03)' : 'rgba(66,165,245,.02)')}
                  >
                    <td colSpan={8} style={{
                      padding: '8px 14px',
                      background: isDark ? 'rgba(66,165,245,.03)' : 'rgba(66,165,245,.02)',
                      borderTop: `1px solid ${th.border}`,
                      borderBottom: `1px solid ${th.borderFaint}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 10, color: th.textDim, fontWeight: 700, transition: 'transform .15s',
                          display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
                        }}>▶</span>
                        <span style={{ fontSize: 14 }}>{catIcon}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: '#42a5f5',
                          letterSpacing: 1, textTransform: 'uppercase' as const,
                        }}>{catLabel}</span>
                        <span style={{
                          fontSize: 10, color: th.textDim, fontWeight: 500, marginLeft: 4,
                        }}>({catMachines.length})</span>
                        {catAllocCount > 0 && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10,
                            background: isDark ? 'rgba(0,229,160,.12)' : 'rgba(5,150,105,.1)',
                            color: th.gold, marginLeft: 4,
                          }}>{catAllocCount} {t.allocations ?? 'alloc.'}</span>
                        )}
                      </div>
                    </td>
                  </tr>,

                  /* ─── Machine rows ─── */
                  ...(isExpanded ? catMachines.map((machine, idx) => {
                    const dayMap = machineAllocMap[machine.id] || {};
                    const hasAnyAlloc = Object.keys(dayMap).length > 0;

                    return (
                      <tr key={machine.id} style={{
                        borderTop: idx > 0 ? `1px solid ${th.borderFaint}` : 'none',
                        transition: 'background .15s',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.background = th.rowHover)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Status dot */}
                        <td style={{
                          textAlign: 'center' as const, borderRight: `1px solid ${th.borderFaint}`,
                          padding: '4px', verticalAlign: 'middle' as const,
                        }}>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 28, height: 28, borderRadius: 6,
                            background: hasAnyAlloc
                              ? (isDark ? 'rgba(66,165,245,.15)' : 'rgba(66,165,245,.08)')
                              : (isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)'),
                          }}>
                            <span style={{ fontSize: 12 }}>{catIcon}</span>
                          </div>
                        </td>

                        {/* Machine name */}
                        <td style={{
                          padding: '6px 14px', borderRight: `1px solid ${th.borderFaint}`,
                          verticalAlign: 'middle' as const,
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: th.empName, lineHeight: 1.3 }}>
                            {machine.name}
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 500, color: th.text, lineHeight: 1.3, opacity: 0.6 }}>
                            {machine.inventory_nr || machine.license_plate || ''}
                          </div>
                          <div style={{
                            fontSize: 9, color: th.textGhost, fontWeight: 500,
                            letterSpacing: 1, textTransform: 'uppercase' as const, marginTop: 1,
                            display: 'flex', gap: 6, alignItems: 'center',
                          }}>
                            {machine.brand && <span>{machine.brand}</span>}
                            {machine.tonnage && <span>{machine.tonnage}t</span>}
                          </div>
                        </td>

                        {/* ═══ DAY CELLS ═══ */}
                        {(t.days as string[]).map((_: string, di: number) => {
                          const allocs = dayMap[di] || [];
                          const hasAllocs = allocs.length > 0;

                          return (
                            <td key={di} style={{
                              borderRight: di < 5 ? `1px solid ${th.borderFaint}` : 'none',
                              padding: '3px 4px', verticalAlign: 'top' as const,
                            }}>
                              {hasAllocs ? (
                                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2 }}>
                                  {allocs.map((alloc, ai) => {
                                    const color = getTaskColor(alloc.job.task_id);
                                    const emp = alloc.employee;
                                    const task = alloc.task;

                                    return (
                                      <div key={`${alloc.job.id}-${ai}`} style={{
                                        background: isDark ? `${color}28` : `${color}18`,
                                        borderLeft: `3px solid ${color}`,
                                        borderRadius: 4, padding: '3px 6px', minHeight: 28,
                                      }} title={[
                                        task?.name || '?',
                                        alloc.customerName ? `Customer: ${alloc.customerName}` : '',
                                        emp ? `Employee: ${emp.first_name} ${emp.last_name}` : '',
                                      ].filter(Boolean).join('\n')}>
                                        {/* Task name */}
                                        <div style={{
                                          fontSize: 10, fontWeight: 700, color: isDark ? '#ddd' : '#333',
                                          overflow: 'hidden', textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap' as const, lineHeight: 1.3,
                                        }}>{task?.name || task?.code || '?'}</div>

                                        {/* Employee */}
                                        {emp && (
                                          <div style={{
                                            fontSize: 8, fontWeight: 600,
                                            color: isDark ? 'rgba(0,229,160,.7)' : 'rgba(5,150,105,.8)',
                                            overflow: 'hidden', textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap' as const, lineHeight: 1.3, marginTop: 1,
                                          }}>&#x1F464; {emp.first_name} {emp.last_name?.charAt(0)}.</div>
                                        )}

                                        {/* Customer */}
                                        {alloc.customerName && (
                                          <div style={{
                                            fontSize: 8, fontWeight: 500,
                                            color: isDark ? 'rgba(200,169,110,.6)' : 'rgba(139,115,85,.6)',
                                            overflow: 'hidden', textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap' as const, lineHeight: 1.3, marginTop: 1,
                                          }}>&#x1F3E2; {alloc.customerName}</div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  height: 40, color: th.textGhost, fontSize: 10, fontWeight: 300,
                                }}>—</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }) : [])
                ];
              })}
            </tbody>
          </table>
        </div>

        {/* ── Utilization Summary ── */}
        <div style={{ marginTop: 16, padding: '16px 20px', background: th.bgCard, borderRadius: 8, border: `1px solid ${th.border}` }}>
          <div style={{
            fontSize: 10, color: th.goldDim, marginBottom: 12, fontWeight: 700,
            letterSpacing: 2, textTransform: 'uppercase' as const,
          }}>{t.machineUtilization ?? 'Machine Utilization'} · {t.kw ?? 'KW'} {kw}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6 }}>
            {activeMachines.filter(m => machineAllocMap[m.id]).map(machine => {
              const dayMap = machineAllocMap[machine.id] || {};
              const totalDays = Object.keys(dayMap).length;
              const totalAllocs = Object.values(dayMap).reduce((s, arr) => s + arr.length, 0);
              const pct = Math.round((totalDays / 6) * 100);
              const catIcon = CATEGORY_ICONS[(machine.category || '').toUpperCase()] || '📦';

              return (
                <div key={machine.id} style={{
                  padding: '10px 14px', background: th.legendItemBg, borderRadius: 6,
                  display: 'flex', alignItems: 'center', gap: 12,
                  borderLeft: `3px solid #42a5f5`,
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{catIcon}</span>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{
                      fontSize: 12, fontWeight: 600, color: th.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    }}>{machine.name}</div>
                    <div style={{ fontSize: 9, color: th.textDim }}>
                      {machine.inventory_nr || machine.license_plate || (machine.brand ?? '')}
                      {' · '}{totalDays}/6 {t.days_used ?? 'days'} · {totalAllocs} {t.allocations ?? 'allocs'}
                    </div>
                    {/* Utilization bar */}
                    <div style={{
                      marginTop: 4, height: 4, borderRadius: 2, width: '100%',
                      background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 2, width: `${pct}%`,
                        background: pct >= 80 ? th.gold
                          : pct >= 50 ? '#42a5f5'
                          : isDark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.12)',
                        transition: 'width .3s ease',
                      }} />
                    </div>
                  </div>
                  <span style={{
                    fontSize: 14, color: pct >= 80 ? th.gold : pct >= 50 ? '#42a5f5' : th.textDim,
                    fontWeight: 700, flexShrink: 0,
                  }}>{pct}%</span>
                </div>
              );
            })}
            {activeMachines.filter(m => machineAllocMap[m.id]).length === 0 && (
              <div style={{ padding: 20, color: th.textDim, fontSize: 12, textAlign: 'center', gridColumn: '1 / -1' }}>
                {t.noMachineAllocations ?? 'No machine allocations this week'}
              </div>
            )}
          </div>
        </div>

        {/* ── Idle Machines ── */}
        {(() => {
          const idle = activeMachines.filter(m => !machineAllocMap[m.id]);
          if (idle.length === 0) return null;
          return (
            <div style={{ marginTop: 16, padding: '16px 20px', background: th.bgCard, borderRadius: 8, border: `1px solid ${th.border}` }}>
              <div style={{
                fontSize: 10, color: th.textDim, marginBottom: 12, fontWeight: 700,
                letterSpacing: 2, textTransform: 'uppercase' as const,
              }}>{t.idleMachines ?? 'Idle Machines'} · {idle.length}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {idle.map(machine => {
                  const catIcon = CATEGORY_ICONS[(machine.category || '').toUpperCase()] || '📦';
                  return (
                    <div key={machine.id} style={{
                      padding: '6px 12px', background: th.legendItemBg, borderRadius: 6,
                      display: 'flex', alignItems: 'center', gap: 6,
                      border: `1px solid ${th.borderFaint}`,
                      opacity: 0.6,
                    }}>
                      <span style={{ fontSize: 12 }}>{catIcon}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: th.textDim }}>{machine.name}</span>
                      {(machine.inventory_nr || machine.license_plate) && (
                        <span style={{ fontSize: 9, color: th.textGhost }}>
                          {machine.inventory_nr || machine.license_plate}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </main>

      <style>{`
        @keyframes fadeSlide { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes bulkProgress { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
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
