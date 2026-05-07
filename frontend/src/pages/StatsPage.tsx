import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTheme } from '../contexts/themeContext';
import { useAuthStore } from '../contexts/authStore';

/* ────────────────────── types ────────────────────── */
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  departments: string[];
  is_active: boolean;
  manager_id?: string;
}
interface Week {
  id: string;
  week_number: number;
  year: number;
}
interface Allocation {
  id: string;
  user_id: string;
  task_id: string;
  week_id: string;
  day_of_week: number;
  time_slot: string;
  created_by_id?: string;
}
interface Absence {
  id: string;
  user_id: string;
  week_id?: string;
  day_of_week?: number;
  date?: string;
  type: number | string;
  status?: string;
}
interface Task {
  id: string;
  name: string;
  short_code?: string;
  status: string;
  color?: string;
  bg_color?: string;
}
interface Machine {
  id: string;
  name: string;
  category: string;
  status: string;
  notes?: string;
}
interface MachineAllocation {
  id: string;
  machine_id: string;
  user_id?: string;
  task_id?: string;
  date: string;
  start_time?: string;
  end_time?: string;
}

type Period = 'week' | 'month' | 'quarter' | 'year';

/* ────────────────────── i18n ────────────────────── */
const LABELS: Record<string, Record<string, string>> = {
  de: {
    title: 'Statistiken',
    period: 'Zeitraum',
    week: 'Woche', month: 'Monat', quarter: 'Quartal', year: 'Jahr',
    teamOccupation: 'Team-Auslastung',
    successRate: 'Erfolgsrate',
    absenceRate: 'Absenzenquote',
    machineOccupation: 'Maschinen-Auslastung',
    occupied: 'Belegt', free: 'Frei', absent: 'Abwesend',
    completed: 'Abgeschlossen', pending: 'Offen', cancelled: 'Abgebrochen',
    available: 'Verfügbar', inUse: 'In Betrieb', maintenance: 'Wartung',
    totalSlots: 'Gesamte Slots', filledSlots: 'Belegte Slots',
    totalTasks: 'Aufträge gesamt', completedTasks: 'Abgeschlossen',
    totalDays: 'Arbeitstage gesamt', absentDays: 'Abwesende Tage',
    totalMachines: 'Maschinen gesamt', usedMachines: 'Eingesetzte Maschinen',
    byEmployee: 'Nach Mitarbeiter', byDepartment: 'Nach Abteilung',
    byDay: 'Nach Wochentag', byMachine: 'Nach Maschine',
    noData: 'Keine Daten verfügbar',
    employees: 'Mitarbeiter', department: 'Abteilung',
    mon: 'Mo', tue: 'Di', wed: 'Mi', thu: 'Do', fri: 'Fr', sat: 'Sa',
    garten: 'Garten', unterhalt: 'Unterhalt',
    loading: 'Laden…', rate: 'Quote',
    export: 'Exportieren',
    trend: 'Trend', weekNum: 'KW',
    tasks: 'Aufträge',
  },
  en: {
    title: 'Statistics',
    period: 'Period',
    week: 'Week', month: 'Month', quarter: 'Quarter', year: 'Year',
    teamOccupation: 'Team Occupation',
    successRate: 'Success Rate',
    absenceRate: 'Absence Rate',
    machineOccupation: 'Machine Occupation',
    occupied: 'Occupied', free: 'Free', absent: 'Absent',
    completed: 'Completed', pending: 'Pending', cancelled: 'Cancelled',
    available: 'Available', inUse: 'In Use', maintenance: 'Maintenance',
    totalSlots: 'Total Slots', filledSlots: 'Filled Slots',
    totalTasks: 'Total Tasks', completedTasks: 'Completed',
    totalDays: 'Total Workdays', absentDays: 'Absent Days',
    totalMachines: 'Total Machines', usedMachines: 'Used Machines',
    byEmployee: 'By Employee', byDepartment: 'By Department',
    byDay: 'By Weekday', byMachine: 'By Machine',
    noData: 'No data available',
    employees: 'Employees', department: 'Department',
    mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat',
    garten: 'Garden', unterhalt: 'Maintenance',
    loading: 'Loading…', rate: 'Rate',
    export: 'Export',
    trend: 'Trend', weekNum: 'CW',
    tasks: 'Tasks',
  },
  fr: {
    title: 'Statistiques',
    period: 'Période',
    week: 'Semaine', month: 'Mois', quarter: 'Trimestre', year: 'Année',
    teamOccupation: "Taux d'occupation",
    successRate: 'Taux de réussite',
    absenceRate: "Taux d'absence",
    machineOccupation: 'Occupation machines',
    occupied: 'Occupé', free: 'Libre', absent: 'Absent',
    completed: 'Terminé', pending: 'En cours', cancelled: 'Annulé',
    available: 'Disponible', inUse: 'En service', maintenance: 'Maintenance',
    totalSlots: 'Créneaux totaux', filledSlots: 'Créneaux remplis',
    totalTasks: 'Tâches totales', completedTasks: 'Terminées',
    totalDays: 'Jours ouvrables', absentDays: 'Jours absents',
    totalMachines: 'Machines totales', usedMachines: 'Machines utilisées',
    byEmployee: 'Par employé', byDepartment: 'Par département',
    byDay: 'Par jour', byMachine: 'Par machine',
    noData: 'Aucune donnée',
    employees: 'Employés', department: 'Département',
    mon: 'Lun', tue: 'Mar', wed: 'Mer', thu: 'Jeu', fri: 'Ven', sat: 'Sam',
    garten: 'Jardin', unterhalt: 'Entretien',
    loading: 'Chargement…', rate: 'Taux',
    export: 'Exporter',
    trend: 'Tendance', weekNum: 'S',
    tasks: 'Tâches',
  },
  pt: {
    title: 'Estatísticas',
    period: 'Período',
    week: 'Semana', month: 'Mês', quarter: 'Trimestre', year: 'Ano',
    teamOccupation: 'Ocupação da Equipa',
    successRate: 'Taxa de Sucesso',
    absenceRate: 'Taxa de Ausência',
    machineOccupation: 'Ocupação de Máquinas',
    occupied: 'Ocupado', free: 'Livre', absent: 'Ausente',
    completed: 'Concluído', pending: 'Pendente', cancelled: 'Cancelado',
    available: 'Disponível', inUse: 'Em uso', maintenance: 'Manutenção',
    totalSlots: 'Slots totais', filledSlots: 'Slots preenchidos',
    totalTasks: 'Tarefas totais', completedTasks: 'Concluídas',
    totalDays: 'Dias úteis totais', absentDays: 'Dias ausentes',
    totalMachines: 'Máquinas totais', usedMachines: 'Máquinas usadas',
    byEmployee: 'Por funcionário', byDepartment: 'Por departamento',
    byDay: 'Por dia', byMachine: 'Por máquina',
    noData: 'Sem dados',
    employees: 'Funcionários', department: 'Departamento',
    mon: 'Seg', tue: 'Ter', wed: 'Qua', thu: 'Qui', fri: 'Sex', sat: 'Sáb',
    garten: 'Jardim', unterhalt: 'Manutenção',
    loading: 'Carregando…', rate: 'Taxa',
    export: 'Exportar',
    trend: 'Tendência', weekNum: 'S',
    tasks: 'Tarefas',
  },
};

const ABS_LABELS: Record<string, Record<string, string>> = {
  de: { '1': 'Krankheit', '2': 'Urlaub', '3': 'Fortbildung', '4': 'Dienstreise', '5': 'Homeoffice', '6': 'Sonstiges' },
  en: { '1': 'Illness', '2': 'Vacation', '3': 'Training', '4': 'Business Trip', '5': 'Home Office', '6': 'Other' },
  fr: { '1': 'Maladie', '2': 'Vacances', '3': 'Formation', '4': 'Déplacement', '5': 'Télétravail', '6': 'Autre' },
  pt: { '1': 'Doença', '2': 'Férias', '3': 'Formação', '4': 'Viagem', '5': 'Home Office', '6': 'Outro' },
};

/* ────────────────────── helpers ────────────────────── */
const API = '';
const hdr = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

function getISOWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

function getCurrentWeekNumber(): number {
  return getISOWeek(new Date());
}

function getWeeksForPeriod(period: Period, allWeeks: Week[]): Week[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentWeek = getCurrentWeekNumber();

  switch (period) {
    case 'week':
      return allWeeks.filter(w => w.year === currentYear && w.week_number === currentWeek);
    case 'month': {
      const startWeek = Math.max(1, currentWeek - 3);
      return allWeeks.filter(w => w.year === currentYear && w.week_number >= startWeek && w.week_number <= currentWeek);
    }
    case 'quarter': {
      const startWeek = Math.max(1, currentWeek - 12);
      return allWeeks.filter(w => w.year === currentYear && w.week_number >= startWeek && w.week_number <= currentWeek);
    }
    case 'year':
      return allWeeks.filter(w => w.year === currentYear && w.week_number <= currentWeek);
  }
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

/* ────── SVG donut chart ────── */
function Donut({ value, size = 120, strokeWidth = 14, color, trackColor, label, sublabel }: {
  value: number; size?: number; strokeWidth?: number;
  color: string; trackColor: string; label: string; sublabel?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(value, 100) / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontSize: size * 0.22, fontWeight: 700, fill: color }}>
          {value}%
        </text>
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        {sublabel && <div style={{ fontSize: 11, opacity: 0.6 }}>{sublabel}</div>}
      </div>
    </div>
  );
}

/* ────── bar chart ────── */
function BarChart({ data, color, maxVal, th }: {
  data: { label: string; value: number; max: number }[];
  color: string; maxVal: number; th: Record<string, string>;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 90, fontSize: 12, fontWeight: 500, color: th.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {d.label}
          </div>
          <div style={{ flex: 1, height: 22, background: th.borderFaint, borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              width: `${maxVal === 0 ? 0 : (d.value / maxVal) * 100}%`,
              height: '100%', background: color, borderRadius: 6,
              transition: 'width 0.6s ease',
              minWidth: d.value > 0 ? 4 : 0,
            }} />
          </div>
          <div style={{ width: 50, fontSize: 12, fontWeight: 600, color: th.text, textAlign: 'right' }}>
            {pct(d.value, d.max)}%
          </div>
        </div>
      ))}
    </div>
  );
}

/* ────── mini sparkline ────── */
function Sparkline({ data, color, width = 140, height = 40 }: {
  data: number[]; color: string; width?: number; height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {data.length > 0 && (() => {
        const lastX = width;
        const lastY = height - ((data[data.length - 1] - min) / range) * (height - 4) - 2;
        return <circle cx={lastX} cy={lastY} r={3} fill={color} />;
      })()}
    </svg>
  );
}

/* ────── horizontal legend ────── */
function Legend({ items, th }: {
  items: { color: string; label: string; value: string }[];
  th: Record<string, string>;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: it.color }} />
          <span style={{ fontSize: 12, color: th.textMuted }}>{it.label}:</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: th.text }}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════ */
export function StatsPage() {
  const { isDark, th, lang } = useTheme();
  const { token } = useAuthStore();
  const L = LABELS[lang || 'de'] || LABELS.de;

  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<User[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineAllocs, setMachineAllocs] = useState<MachineAllocation[]>([]);

  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const h = hdr(token);
    try {
      const [uRes, wRes, aRes, abRes, tRes, mRes, maRes] = await Promise.allSettled([
        fetch(`${API}/api/v1/users`, { headers: h }),
        fetch(`${API}/api/v1/weeks`, { headers: h }),
        fetch(`${API}/api/v1/allocations`, { headers: h }),
        fetch(`${API}/api/v1/absences`, { headers: h }),
        fetch(`${API}/api/v1/tasks`, { headers: h }),
        fetch(`${API}/api/v1/machines`, { headers: h }),
        fetch(`${API}/api/v1/machines/allocations`, { headers: h }),
      ]);
      if (!mounted.current) return;
      const json = async (r: PromiseSettledResult<Response>): Promise<any[]> => {
        if (r.status !== 'fulfilled' || !r.value.ok) return [];
        try {
            const data = await r.value.json();
            if (Array.isArray(data)) return data;
            if (data && Array.isArray(data.data)) return data.data;
            return [];
        } catch {
            return [];
        }
      };
      setUsers(await json(uRes));
      setWeeks(await json(wRes));
      setAllocations(await json(aRes));
      setAbsences(await json(abRes));
      setTasks(await json(tRes));
      setMachines(await json(mRes));
      setMachineAllocs(await json(maRes));
    } catch (e) {
      console.error('Stats fetch error', e);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const periodWeeks = useMemo(() => getWeeksForPeriod(period, weeks), [period, weeks]);
  const periodWeekIds = useMemo(() => new Set(periodWeeks.map(w => w.id)), [periodWeeks]);
  const activeUsers = useMemo(() => users.filter(u => u.is_active !== false), [users]);

  const periodAllocations = useMemo(
    () => allocations.filter(a => periodWeekIds.has(a.week_id)),
    [allocations, periodWeekIds]
  );
  const periodAbsences = useMemo(
    () => absences.filter(a => a.week_id ? periodWeekIds.has(a.week_id) : false),
    [absences, periodWeekIds]
  );

  /* ══════════ 1. TEAM OCCUPATION ══════════ */
  const teamOccupation = useMemo(() => {
    const numWeeks = periodWeeks.length || 1;
    const daysPerWeek = 6;
    const slotsPerDay = 2;
    const totalSlots = activeUsers.length * numWeeks * daysPerWeek * slotsPerDay;
    const filledSlots = periodAllocations.length;
    const rate = pct(filledSlots, totalSlots);

    const byEmployee = activeUsers.map(u => {
      const userSlots = periodAllocations.filter(a => a.user_id === u.id).length;
      const maxSlots = numWeeks * daysPerWeek * slotsPerDay;
      return { label: `${u.first_name} ${u.last_name}`, value: userSlots, max: maxSlots };
    }).sort((a, b) => (b.value / (b.max || 1)) - (a.value / (a.max || 1)));

    const depts = ['garten', 'unterhalt'];
    const byDept = depts.map(dept => {
      const deptUsers = activeUsers.filter(u => (u.departments || []).includes(dept));
      const deptAllocs = periodAllocations.filter(a => deptUsers.some(u => u.id === a.user_id)).length;
      const maxSlots = deptUsers.length * numWeeks * daysPerWeek * slotsPerDay;
      return { label: L[dept] || dept, value: deptAllocs, max: maxSlots };
    });

    const dayNames = [L.mon, L.tue, L.wed, L.thu, L.fri, L.sat];
    const byDay = [1, 2, 3, 4, 5, 6].map((d, i) => {
      const dayAllocs = periodAllocations.filter(a => a.day_of_week === d).length;
      const maxDay = activeUsers.length * numWeeks * slotsPerDay;
      return { label: dayNames[i], value: dayAllocs, max: maxDay };
    });

    const trend = periodWeeks.map(w => {
      const wAllocs = periodAllocations.filter(a => a.week_id === w.id).length;
      const wMax = activeUsers.length * daysPerWeek * slotsPerDay;
      return pct(wAllocs, wMax);
    });

    return { rate, totalSlots, filledSlots, byEmployee, byDept, byDay, trend };
  }, [periodAllocations, periodWeeks, activeUsers, L]);

  /* ══════════ 2. SUCCESS RATE ══════════ */
  const successRate = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => (t.status || '').toUpperCase() === 'COMPLETED').length;
    const cancelled = tasks.filter(t => (t.status || '').toUpperCase() === 'CANCELLED').length;
    const active = tasks.filter(t => (t.status || '').toUpperCase() === 'ACTIVE').length;
    const rate = pct(completed, total);
    return { rate, total, completed, cancelled, active };
  }, [tasks]);

  /* ══════════ 3. ABSENCE RATE ══════════ */
  const absenceRate = useMemo(() => {
    const numWeeks = periodWeeks.length || 1;
    const daysPerWeek = 6;
    const totalDays = activeUsers.length * numWeeks * daysPerWeek;
    const absentDays = periodAbsences.length;
    const rate = pct(absentDays, totalDays);

    const byEmployee = activeUsers.map(u => {
      const uAbs = periodAbsences.filter(a => a.user_id === u.id).length;
      const maxDays = numWeeks * daysPerWeek;
      return { label: `${u.first_name} ${u.last_name}`, value: uAbs, max: maxDays };
    }).sort((a, b) => (b.value / (b.max || 1)) - (a.value / (a.max || 1)));

    const absTypes: Record<string, number> = {};
    periodAbsences.forEach(a => {
      const key = String(a.type);
      absTypes[key] = (absTypes[key] || 0) + 1;
    });

    const trend = periodWeeks.map(w => {
      const wAbs = periodAbsences.filter(a => a.week_id === w.id).length;
      const wMax = activeUsers.length * daysPerWeek;
      return pct(wAbs, wMax);
    });

    return { rate, totalDays, absentDays, byEmployee, absTypes, trend };
  }, [periodAbsences, periodWeeks, activeUsers]);

  /* ══════════ 4. MACHINE OCCUPATION ══════════ */
  const machineOccupation = useMemo(() => {
    const totalMachines = machines.length;
    const available = machines.filter(m => m.status === 'AVAILABLE').length;
    const inUse = machines.filter(m => m.status === 'IN_USE').length;
    const maint = machines.filter(m => m.status === 'MAINTENANCE').length;
    const usageRate = pct(inUse, totalMachines);

    const allCounts = machines.map(mx => machineAllocs.filter(ma => ma.machine_id === mx.id).length);
    const globalMax = Math.max(...allCounts, 1);

    const byMachine = machines.map(m => {
      const mAllocs = machineAllocs.filter(ma => ma.machine_id === m.id).length;
      return { label: m.name, value: mAllocs, max: globalMax };
    }).sort((a, b) => b.value - a.value);

    const cats = [...new Set(machines.map(m => m.category).filter(Boolean))];
    const byCategory = cats.map(cat => {
      const catMachines = machines.filter(m => m.category === cat);
      const catInUse = catMachines.filter(m => m.status === 'IN_USE').length;
      return { label: cat, value: catInUse, max: catMachines.length };
    });

    return { totalMachines, available, inUse, maint, usageRate, byMachine, byCategory };
  }, [machines, machineAllocs]);

  /* ══════════ COLORS ══════════ */
  const colors = {
    occupation: th.gold || '#d4af37',
    success: '#4ecdc4',
    absence: '#ff6b9d',
    machine: '#95e1d3',
    track: isDark ? '#2a2a2a' : '#e8e8e8',
    green: '#4ecdc4',
    red: '#ff6b6b',
    orange: '#ffa726',
  };

  /* ══════════ STYLES ══════════ */
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: th.bgCard,
    border: `1px solid ${th.border}`,
    borderRadius: 12,
    padding: 24,
    ...extra,
  });

  const kpiCard = (): React.CSSProperties => ({
    background: th.bgCard,
    border: `1px solid ${th.border}`,
    borderRadius: 12,
    padding: '20px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    cursor: 'default',
    transition: 'transform .15s, box-shadow .15s',
  });

  const periodBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    background: active ? th.gold : th.buttonBg,
    color: active ? '#fff' : th.textMuted,
    transition: 'all .15s',
  });

  const sectionTitle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 700,
    color: th.text,
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  };

  const subtab: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    transition: 'all .15s',
  };

  const [teamView, setTeamView] = useState<'employee' | 'department' | 'day'>('employee');
  const [machView, setMachView] = useState<'machine' | 'category'>('machine');

  /* ══════════ CSV EXPORT ══════════ */
  const exportCSV = () => {
    const rows = [
      ['Metric', 'Value', 'Total', 'Percentage'],
      [L.teamOccupation, String(teamOccupation.filledSlots), String(teamOccupation.totalSlots), teamOccupation.rate + '%'],
      [L.successRate, String(successRate.completed), String(successRate.total), successRate.rate + '%'],
      [L.absenceRate, String(absenceRate.absentDays), String(absenceRate.totalDays), absenceRate.rate + '%'],
      [L.machineOccupation, String(machineOccupation.inUse), String(machineOccupation.totalMachines), machineOccupation.usageRate + '%'],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stats-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ══════════ RENDER ══════════ */
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: th.textMuted, fontSize: 16 }}>
        {L.loading}
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto', color: th.text }}>

      {/* ── header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: th.text }}>
          <span style={{ color: th.gold }}>📊</span> {L.title}
        </h1>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['week', 'month', 'quarter', 'year'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={periodBtn(period === p)}>
              {L[p]}
            </button>
          ))}
          <button onClick={exportCSV} style={{ ...periodBtn(false), marginLeft: 8, border: `1px solid ${th.border}` }}>
            ⬇ {L.export}
          </button>
        </div>
      </div>

      {/* ── KPI overview row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 28 }}>

        <div style={kpiCard()}>
          <Donut value={teamOccupation.rate} size={72} strokeWidth={8} color={colors.occupation} trackColor={colors.track} label="" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: th.textMuted }}>{L.teamOccupation}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: colors.occupation }}>{teamOccupation.rate}%</div>
            <div style={{ fontSize: 11, color: th.textDim }}>
              {teamOccupation.filledSlots} / {teamOccupation.totalSlots} {L.filledSlots.toLowerCase()}
            </div>
          </div>
        </div>

        <div style={kpiCard()}>
          <Donut value={successRate.rate} size={72} strokeWidth={8} color={colors.success} trackColor={colors.track} label="" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: th.textMuted }}>{L.successRate}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: colors.success }}>{successRate.rate}%</div>
            <div style={{ fontSize: 11, color: th.textDim }}>
              {successRate.completed} / {successRate.total} {L.completedTasks.toLowerCase()}
            </div>
          </div>
        </div>

        <div style={kpiCard()}>
          <Donut value={absenceRate.rate} size={72} strokeWidth={8} color={colors.absence} trackColor={colors.track} label="" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: th.textMuted }}>{L.absenceRate}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: colors.absence }}>{absenceRate.rate}%</div>
            <div style={{ fontSize: 11, color: th.textDim }}>
              {absenceRate.absentDays} / {absenceRate.totalDays} {L.absentDays.toLowerCase()}
            </div>
          </div>
        </div>

        <div style={kpiCard()}>
          <Donut value={machineOccupation.usageRate} size={72} strokeWidth={8} color={colors.machine} trackColor={colors.track} label="" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: th.textMuted }}>{L.machineOccupation}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: colors.machine }}>{machineOccupation.usageRate}%</div>
            <div style={{ fontSize: 11, color: th.textDim }}>
              {machineOccupation.inUse} / {machineOccupation.totalMachines} {L.usedMachines.toLowerCase()}
            </div>
          </div>
        </div>
      </div>

      {/* ── detail grids ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 20 }}>

        {/* ─── TEAM OCCUPATION DETAIL ─── */}
        <div style={card()}>
          <div style={sectionTitle}>
            <span>👥</span> {L.teamOccupation}
            <span style={{ flex: 1 }} />
            {([
              { key: 'employee' as const, label: L.byEmployee },
              { key: 'department' as const, label: L.byDepartment },
              { key: 'day' as const, label: L.byDay },
            ]).map(v => (
              <button key={v.key} onClick={() => setTeamView(v.key)}
                style={{ ...subtab, background: teamView === v.key ? th.gold : th.buttonBg, color: teamView === v.key ? '#fff' : th.textMuted }}>
                {v.label}
              </button>
            ))}
          </div>
          {teamView === 'employee' && (
            <BarChart data={teamOccupation.byEmployee} color={colors.occupation}
              maxVal={Math.max(...teamOccupation.byEmployee.map(d => d.max), 1)} th={th} />
          )}
          {teamView === 'department' && (
            <BarChart data={teamOccupation.byDept} color={colors.occupation}
              maxVal={Math.max(...teamOccupation.byDept.map(d => d.max), 1)} th={th} />
          )}
          {teamView === 'day' && (
            <BarChart data={teamOccupation.byDay} color={colors.occupation}
              maxVal={Math.max(...teamOccupation.byDay.map(d => d.max), 1)} th={th} />
          )}
          {teamOccupation.trend.length > 1 && (
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: th.textDim, fontWeight: 600 }}>{L.trend}:</span>
              <Sparkline data={teamOccupation.trend} color={colors.occupation} />
              <span style={{ fontSize: 11, color: th.textDim }}>
                {periodWeeks.map(w => `${L.weekNum}${w.week_number}`).join(' → ')}
              </span>
            </div>
          )}
        </div>

        {/* ─── SUCCESS RATE DETAIL ─── */}
        <div style={card()}>
          <div style={sectionTitle}><span>🎯</span> {L.successRate}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 20 }}>
            <Donut value={successRate.rate} size={130} strokeWidth={16} color={colors.success} trackColor={colors.track}
              label={L.completed} sublabel={`${successRate.completed} ${L.tasks.toLowerCase()}`} />
          </div>
          <Legend th={th} items={[
            { color: colors.success, label: L.completed, value: String(successRate.completed) },
            { color: colors.orange, label: L.pending, value: String(successRate.active) },
            { color: colors.red, label: L.cancelled, value: String(successRate.cancelled) },
          ]} />
          <div style={{ marginTop: 16, height: 28, borderRadius: 8, overflow: 'hidden', display: 'flex', background: colors.track }}>
            {successRate.total > 0 && (
              <>
                <div style={{ width: `${pct(successRate.completed, successRate.total)}%`, background: colors.success, transition: 'width 0.6s' }} />
                <div style={{ width: `${pct(successRate.active, successRate.total)}%`, background: colors.orange, transition: 'width 0.6s' }} />
                <div style={{ width: `${pct(successRate.cancelled, successRate.total)}%`, background: colors.red, transition: 'width 0.6s' }} />
              </>
            )}
          </div>
        </div>

        {/* ─── ABSENCE RATE DETAIL ─── */}
        <div style={card()}>
          <div style={sectionTitle}><span>🏥</span> {L.absenceRate}</div>
          <BarChart data={absenceRate.byEmployee} color={colors.absence}
            maxVal={Math.max(...absenceRate.byEmployee.map(d => d.max), 1)} th={th} />
          {Object.keys(absenceRate.absTypes).length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Legend th={th} items={Object.entries(absenceRate.absTypes).map(([type, count]) => {
                const absMap = ABS_LABELS[lang || 'de'] || ABS_LABELS.de;
                return {
                  color: ['#ff6b9d', '#ffa726', '#b388ff', '#4ecdc4', '#42a5f5', '#78909c'][Number(type) - 1] || '#999',
                  label: absMap[type] || `Type ${type}`,
                  value: String(count),
                };
              })} />
            </div>
          )}
          {absenceRate.trend.length > 1 && (
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: th.textDim, fontWeight: 600 }}>{L.trend}:</span>
              <Sparkline data={absenceRate.trend} color={colors.absence} />
            </div>
          )}
        </div>

        {/* ─── MACHINE OCCUPATION DETAIL ─── */}
        <div style={card()}>
          <div style={sectionTitle}>
            <span>🚜</span> {L.machineOccupation}
            <span style={{ flex: 1 }} />
            {([
              { key: 'machine' as const, label: L.byMachine },
              { key: 'category' as const, label: L.byDepartment },
            ]).map(v => (
              <button key={v.key} onClick={() => setMachView(v.key)}
                style={{ ...subtab, background: machView === v.key ? th.gold : th.buttonBg, color: machView === v.key ? '#fff' : th.textMuted }}>
                {v.label}
              </button>
            ))}
          </div>
          {machView === 'machine' && (
            <BarChart data={machineOccupation.byMachine} color={colors.machine}
              maxVal={Math.max(...machineOccupation.byMachine.map(d => d.max), 1)} th={th} />
          )}
          {machView === 'category' && (
            <BarChart data={machineOccupation.byCategory} color={colors.machine}
              maxVal={Math.max(...machineOccupation.byCategory.map(d => d.max), 1)} th={th} />
          )}
          <div style={{ marginTop: 16 }}>
            <Legend th={th} items={[
              { color: colors.green, label: L.available, value: String(machineOccupation.available) },
              { color: colors.machine, label: L.inUse, value: String(machineOccupation.inUse) },
              { color: colors.orange, label: L.maintenance, value: String(machineOccupation.maint) },
            ]} />
          </div>
          <div style={{ marginTop: 12, height: 28, borderRadius: 8, overflow: 'hidden', display: 'flex', background: colors.track }}>
            {machineOccupation.totalMachines > 0 && (
              <>
                <div style={{ width: `${pct(machineOccupation.available, machineOccupation.totalMachines)}%`, background: colors.green, transition: 'width 0.6s' }} />
                <div style={{ width: `${pct(machineOccupation.inUse, machineOccupation.totalMachines)}%`, background: colors.machine, transition: 'width 0.6s' }} />
                <div style={{ width: `${pct(machineOccupation.maint, machineOccupation.totalMachines)}%`, background: colors.orange, transition: 'width 0.6s' }} />
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
