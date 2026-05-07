// frontend/src/pages/SchedulePage.tsx
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTheme } from '../contexts/themeContext';
import { themes, ABS } from '../i18n/translations';
import { format } from 'date-fns';

/* ─── Types ─── */
interface Allocation { id: string; user_id: string; task_id: string; day_of_week: number; week_id: string; time_slot: number; }
interface User { id: string; first_name: string; last_name: string; department: string; }
interface Week { id: string; week_number: number; year: number; schedule_type: string; status: string; }
interface Task { id: string; code: string; name: string; color: string; schedule_type: string; status?: string; customer?: { id: string; name: string } | null; }

const API = import.meta.env.VITE_API_URL || '';

const T = {
  de: {
    employees: 'Mitarbeiter', assignments: 'Zuweisungen', absences: 'Absenzen',
    objects: 'Objekte', today: 'Heute', absenzen: 'Absenzen', objectDir: 'Aufträge',
    bothDept: 'Beide Abt.', gartenFull: 'Garten & Tiefbau', unterhaltFull: 'Unterhalt',
    days: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
    daysShort: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    abs: { '1': 'Ferien', '2': 'Schule', '3': 'ÜK', '4': 'Unfall', '5': 'Krank', '6': 'Teilzeit' } as Record<string, string>,
    removed: 'Entfernt', cancel: 'Abbrechen', setAbsence: 'Absenz setzen',
    searchTasks: 'Auftrag suchen...', noMatch: 'Kein Treffer', max2: 'Max. 2 Aufträge',
    blocked: 'Blockiert (Absenz)',
  },
};

/* ─── Color palette for tasks ─── */
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
  const { isDark } = useTheme();
  const th = isDark ? themes.dark : themes.light as any;
  const t = T.de;

  /* ─── State ─── */
  const [weekOff, setWeekOff] = useState(0);
  const [dept, setDept] = useState('all');
  const [users, setUsers] = useState<User[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rawAllocs, setRawAllocs] = useState<Allocation[]>([]);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [picker, setPicker] = useState<{ userId: string; day: number; rect: DOMRect } | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [absModal, setAbsModal] = useState<{ userId: string; day: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const dates = getWeekDates(weekOff);
  const kw = getKW(dates[0]);
  const year = dates[0].getFullYear();
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };

  const emps = useMemo(() => users.filter(u => dept === 'all' || u.department === dept), [users, dept]);

  const matchingWeeks = useMemo(() => weeks.filter(w => w.week_number === kw && w.year === year), [weeks, kw, year]);
  const weekIds = useMemo(() => new Set(matchingWeeks.map(w => w.id)), [matchingWeeks]);

  // Build allocation lookup: userId → day → task_id[]
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
    tasks.forEach(t => { m[t.id] = t; });
    return m;
  }, [tasks]);

  // Stats
  const totalSlots = useMemo(() => Object.values(allocMap).reduce((s, u) => s + Object.values(u).reduce((ss, d) => ss + d.taskIds.length, 0), 0), [allocMap]);
  const activeTaskIds = useMemo(() => {
    const s = new Set<string>();
    Object.values(allocMap).forEach(u => Object.values(u).forEach(d => d.taskIds.forEach(id => s.add(id))));
    return s;
  }, [allocMap]);

  const showToast = useCallback((msg: string, err = false) => { setToast({ msg, err }); setTimeout(() => setToast(null), 2800); }, []);

  /* ─── Fetchers ─── */
  const fetchWeeks = async () => {
    try { const r = await fetch(`${API}/api/v1/weeks`, { headers }); const d = await r.json(); setWeeks(d.data || []); } catch {}
  };
  const fetchTasks = async () => {
    try { const r = await fetch(`${API}/api/v1/tasks`, { headers }); const d = await r.json(); setTasks(d.data || []); } catch {}
  };
  const fetchUsers = async () => {
    try { const r = await fetch(`${API}/api/v1/users`, { headers }); const d = await r.json(); setUsers(d.data || []); } catch {}
  };
  const fetchAllocations = async () => {
    if (matchingWeeks.length === 0) { setRawAllocs([]); return; }
    const all: Allocation[] = [];
    for (const w of matchingWeeks) {
      try {
        const r = await fetch(`${API}/api/v1/allocations?week_id=${w.id}`, { headers });
        const d = await r.json();
        if (Array.isArray(d.data)) all.push(...d.data);
      } catch {}
    }
    setRawAllocs(all);
  };

  useEffect(() => { fetchWeeks(); fetchTasks(); fetchUsers(); }, []);
  useEffect(() => { if (weeks.length > 0) fetchAllocations(); }, [weekOff, weeks]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPicker(null);
    };
    if (picker) { document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler); }
  }, [picker]);
  useEffect(() => { if (picker && searchRef.current) searchRef.current.focus(); }, [picker]);

  /* ─── Actions ─── */
  const getCell = (userId: string, day: number) => allocMap[userId]?.[day] || { taskIds: [], allocIds: [] };

  const openPicker = (userId: string, day: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const cell = getCell(userId, day);
    if (cell.taskIds.length >= 2) { showToast(t.max2, true); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPicker({ userId, day, rect });
    setPickerSearch('');
  };

  const assignTask = async (taskId: string) => {
    if (!picker) return;
    const { userId, day } = picker;
    const cell = getCell(userId, day);
    if (cell.taskIds.includes(taskId)) { setPicker(null); return; } // already assigned
    if (cell.taskIds.length >= 2) { showToast(t.max2, true); setPicker(null); return; }

    const week = matchingWeeks.find(w => {
      const task = taskById[taskId];
      return task && w.schedule_type === task.schedule_type;
    }) || matchingWeeks[0];
    if (!week) { showToast('Week not found', true); setPicker(null); return; }

    try {
      const r = await fetch(`${API}/api/v1/allocations`, {
        method: 'POST', headers,
        body: JSON.stringify({ user_id: userId, task_id: taskId, day_of_week: day, week_id: week.id, time_slot: cell.taskIds.length + 1 }),
      });
      if (r.ok) {
        const empName = users.find(u => u.id === userId)?.first_name || '';
        const taskName = taskById[taskId]?.name || '';
        showToast(`${taskName} → ${empName}`);
        await fetchAllocations();
      } else { showToast('Fehler', true); }
    } catch { showToast('Netzwerkfehler', true); }
    setPicker(null);
  };

  const removeAlloc = async (allocId: string, taskId: string) => {
    try {
      const r = await fetch(`${API}/api/v1/allocations/${allocId}`, { method: 'DELETE', headers });
      if (r.ok) { showToast(t.removed); await fetchAllocations(); }
    } catch { showToast('Fehler', true); }
  };

  const assignAbsence = async (userId: string, day: number, code: string) => {
    try {
      const r = await fetch(`${API}/api/v1/absences`, {
        method: 'POST', headers,
        body: JSON.stringify({ userId, date: format(dates[day], 'yyyy-MM-dd'), absenceCode: parseInt(code), source: 'MANUAL' }),
      });
      if (r.ok) {
        showToast(`${t.abs[code]} → ${users.find(u => u.id === userId)?.first_name || ''}`);
      }
    } catch { showToast('Fehler', true); }
    setAbsModal(null);
  };

  /* ─── Filtered picker tasks ─── */
  const pickerTasks = useMemo(() => {
    if (!picker) return [];
    const s = pickerSearch.toLowerCase();
    let list = tasks.filter(t => t.status !== 'CANCELLED');
    if (s) {
      list = list.filter(t =>
        t.name.toLowerCase().includes(s) ||
        t.code.toLowerCase().includes(s) ||
        (t.customer?.name || '').toLowerCase().includes(s)
      );
    }
    // Sort: tasks already used this week first, then alphabetically
    const usedIds = activeTaskIds;
    list.sort((a, b) => {
      const aUsed = usedIds.has(a.id) ? 0 : 1;
      const bUsed = usedIds.has(b.id) ? 0 : 1;
      if (aUsed !== bUsed) return aUsed - bUsed;
      return a.name.localeCompare(b.name);
    });
    return list.slice(0, 50); // cap at 50 for performance
  }, [picker, pickerSearch, tasks, activeTaskIds]);

  const getTaskColor = (taskId: string) => {
    const task = taskById[taskId];
    return task?.color && task.color !== '#8B7355' ? task.color : hashColor(taskId);
  };

  const deptLabel = (d: string) => d === 'garten' ? t.gartenFull : d === 'unterhalt' ? t.unterhaltFull : t.bothDept;

  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", background: th.bg, color: th.text, minHeight: '100vh' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999, padding: '12px 20px', borderRadius: 6,
          background: toast.err ? th.toastErrBg : th.toastBg, color: toast.err ? th.toastErrText : th.toastText,
          border: `1px solid ${toast.err ? th.toastErrBorder : th.toastBorder}`, fontSize: 12, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,.3)', animation: 'fadeSlide .3s ease',
        }}>{toast.msg}</div>
      )}

      <main style={{ padding: '20px 24px' }}>
        {/* ── Header: week nav + stats ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setWeekOff(w => w - 1)} style={navBtn(th)}>‹</button>
            <div style={{ textAlign: 'center', minWidth: 130 }}>
              <div style={{ fontSize: 32, fontWeight: 300, color: th.gold, lineHeight: 1, letterSpacing: 1 }}>KW {kw}</div>
              <div style={{ fontSize: 10, color: th.textDim, marginTop: 4, fontWeight: 400, letterSpacing: .5 }}>
                {fmtDate(dates[0])} — {fmtDate(dates[5])} {year}
              </div>
            </div>
            <button onClick={() => setWeekOff(w => w + 1)} style={navBtn(th)}>›</button>
            <button onClick={() => setWeekOff(0)} style={{
              padding: '6px 12px', borderRadius: 4, border: 'none', background: th.switchActive,
              color: th.gold, cursor: 'pointer', fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const,
            }}>{t.today}</button>
            {/* Dept filter */}
            <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
              {['all', 'garten', 'unterhalt'].map(d => (
                <button key={d} onClick={() => setDept(d)} style={{
                  padding: '5px 10px', borderRadius: 4, border: `1px solid ${dept === d ? th.gold : th.border}`,
                  background: dept === d ? (isDark ? 'rgba(200,169,110,.1)' : 'rgba(200,169,110,.08)') : 'transparent',
                  color: dept === d ? th.gold : th.textDim, cursor: 'pointer', fontSize: 10, fontWeight: 600,
                }}>{d === 'all' ? 'Alle' : d === 'garten' ? 'GT' : 'UH'}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { v: emps.length, l: t.employees },
              { v: totalSlots, l: t.assignments },
              { v: activeTaskIds.size, l: t.objects },
            ].map((s, i) => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 300, color: th.gold, lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: 8, color: th.textGhost, marginTop: 3, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Schedule Grid ── */}
        <div style={{ background: th.bgCard, borderRadius: 4, border: `1px solid ${th.border}`, overflow: 'visible', position: 'relative' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 32 }} />
              <col style={{ width: 150 }} />
              {t.days.map((_, i) => <col key={i} />)}
            </colgroup>
            <thead>
              <tr style={{ height: 36 }}>
                <th style={{ ...thBase(th), background: th.goldGhost }} />
                <th style={{ ...thBase(th), background: th.goldGhost, textAlign: 'left' as const, padding: '6px 12px', fontSize: 9, color: th.goldDim, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' as const }}>
                  {t.employees}
                </th>
                {t.days.map((d, i) => (
                  <th key={d} style={{ ...thBase(th), background: th.goldGhost, textAlign: 'center' as const, padding: '4px' }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: th.gold }}>{d}</div>
                    <div style={{ fontSize: 8, color: th.textGhost, fontWeight: 500 }}>{fmtDate(dates[i])}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emps.map((emp, idx) => (
                <tr key={emp.id} style={{ height: 40, borderTop: idx > 0 ? `1px solid ${th.borderFaint}` : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = th.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Role badge */}
                  <td style={{ textAlign: 'center' as const, borderRight: `1px solid ${th.borderFaint}`, fontSize: 9, fontWeight: 700, color: emp.department === 'garten' ? th.roleV : th.roleM }}>
                    {emp.department === 'garten' ? 'GT' : 'UH'}
                  </td>
                  {/* Name */}
                  <td style={{ padding: '4px 12px', borderRight: `1px solid ${th.borderFaint}` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: th.empName }}>{emp.first_name} {emp.last_name}</div>
                    <div style={{ fontSize: 8, color: th.textGhost, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase' as const }}>
                      {deptLabel(emp.department)}
                    </div>
                  </td>
                  {/* Day cells */}
                  {t.days.map((_, di) => {
                    const cell = getCell(emp.id, di);
                    const hasTasks = cell.taskIds.length > 0;
                    return (
                      <td key={di} style={{
                        borderRight: di < 5 ? `1px solid ${th.borderFaint}` : 'none',
                        padding: '2px 3px', position: 'relative' as const, cursor: 'pointer', verticalAlign: 'middle' as const,
                      }}
                        onClick={e => openPicker(emp.id, di, e)}
                      >
                        {hasTasks ? (
                          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 1, height: '100%', justifyContent: 'center' }}>
                            {cell.taskIds.map((tid, idx) => {
                              const task = taskById[tid];
                              const color = getTaskColor(tid);
                              return (
                                <div key={tid} style={{
                                  background: isDark ? `${color}33` : `${color}22`,
                                  borderLeft: `3px solid ${color}`,
                                  borderRadius: 3, padding: '2px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  minHeight: 16,
                                }} title={task?.name || tid}>
                                  <span style={{
                                    fontSize: 9, fontWeight: 600, color: isDark ? '#ddd' : '#333',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1,
                                  }}>
                                    {task?.name || task?.code || '?'}
                                  </span>
                                  <span style={{
                                    fontSize: 10, color: th.textDim, cursor: 'pointer', marginLeft: 4, lineHeight: 1, flexShrink: 0,
                                  }}
                                    onClick={e => { e.stopPropagation(); removeAlloc(cell.allocIds[idx], tid); }}
                                    title="Entfernen"
                                  >×</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: th.textGhost, fontSize: 16, fontWeight: 300 }}>
                            +
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Active Tasks Legend ── */}
        <div style={{ marginTop: 16, padding: '16px 20px', background: th.bgCard, borderRadius: 4, border: `1px solid ${th.border}` }}>
          <div style={{ fontSize: 9, color: th.goldDim, marginBottom: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' as const }}>
            {t.objectDir} · KW {kw} · {activeTaskIds.size} aktiv
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 4 }}>
            {Array.from(activeTaskIds).map(tid => {
              const task = taskById[tid];
              if (!task) return null;
              const color = getTaskColor(tid);
              const count = Object.values(allocMap).reduce((s, u) => s + Object.values(u).reduce((ss, d) => ss + (d.taskIds.includes(tid) ? 1 : 0), 0), 0);
              return (
                <div key={tid} style={{
                  padding: '6px 10px', background: th.legendItemBg, borderRadius: 4,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderLeft: `3px solid ${color}`,
                }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: th.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{task.name}</div>
                    <div style={{ fontSize: 8, color: th.textDim }}>{task.code} · {task.schedule_type === 'UNTERHALT' ? 'UH' : 'GT'}</div>
                  </div>
                  <span style={{ fontSize: 11, color: th.gold, fontWeight: 700, marginLeft: 8, flexShrink: 0 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Absences Legend (draggable to set) ── */}
        <div style={{ marginTop: 16, padding: '16px 20px', background: th.bgCard, borderRadius: 4, border: `1px solid ${th.border}` }}>
          <div style={{ fontSize: 9, color: th.goldDim, marginBottom: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' as const }}>
            {t.absenzen}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 4 }}>
            {Object.entries(t.abs).map(([code, label]) => {
              const abs = ABS[code as unknown as keyof typeof ABS];
              return (
                <div key={code} style={{
                  padding: '6px 10px', background: th.legendItemBg, borderRadius: 4,
                  display: 'flex', alignItems: 'center', gap: 8, borderLeft: `3px solid ${abs?.bg || '#666'}`,
                }}>
                  <span style={{ fontSize: 14 }}>{abs?.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 500, color: th.textMuted }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* ── TASK PICKER DROPDOWN ── */}
      {picker && (
        <div ref={pickerRef} style={{
          position: 'fixed',
          top: Math.min(picker.rect.bottom + 4, window.innerHeight - 400),
          left: Math.min(picker.rect.left, window.innerWidth - 340),
          width: 320, maxHeight: 380,
          background: th.modalCard, border: `1px solid ${th.border}`, borderRadius: 8,
          boxShadow: isDark ? '0 12px 40px rgba(0,0,0,.6)' : '0 12px 40px rgba(0,0,0,.15)',
          zIndex: 9999, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden',
          animation: 'scaleIn .15s ease',
        }}>
          {/* Search */}
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${th.border}` }}>
            <div style={{ fontSize: 9, color: th.goldDim, fontWeight: 700, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' as const }}>
              {users.find(u => u.id === picker.userId)?.first_name} · {t.daysShort[picker.day]}
            </div>
            <input ref={searchRef} placeholder={t.searchTasks} value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 4, border: `1px solid ${th.border}`,
                background: th.bg, color: th.text, fontSize: 12, outline: 'none',
              }}
            />
          </div>
          {/* Task list */}
          <div style={{ flex: 1, overflowY: 'auto' as const, padding: '4px 0' }}>
            {pickerTasks.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center' as const, color: th.textDim, fontSize: 12 }}>{t.noMatch}</div>
            ) : pickerTasks.map(task => {
              const color = getTaskColor(task.id);
              const isAssigned = getCell(picker.userId, picker.day).taskIds.includes(task.id);
              const isUsedThisWeek = activeTaskIds.has(task.id);
              return (
                <div key={task.id}
                  onClick={() => assignTask(task.id)}
                  style={{
                    padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    background: isAssigned ? (isDark ? 'rgba(200,169,110,.1)' : 'rgba(200,169,110,.08)') : 'transparent',
                    borderLeft: isAssigned ? `3px solid ${th.gold}` : '3px solid transparent',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (!isAssigned) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)'; }}
                  onMouseLeave={e => { if (!isAssigned) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: th.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                      {task.name}
                    </div>
                    <div style={{ fontSize: 9, color: th.textDim }}>
                      {task.code} · {task.schedule_type === 'UNTERHALT' ? 'UH' : 'GT'}
                      {task.customer ? ` · ${task.customer.name}` : ''}
                    </div>
                  </div>
                  {isAssigned && <span style={{ color: th.gold, fontSize: 14, flexShrink: 0 }}>✓</span>}
                  {!isAssigned && isUsedThisWeek && <span style={{ fontSize: 8, color: th.textDim, flexShrink: 0, background: th.switchActive, padding: '2px 5px', borderRadius: 3 }}>KW</span>}
                </div>
              );
            })}
          </div>
          {/* Absence shortcut */}
          <div style={{ borderTop: `1px solid ${th.border}`, padding: '8px 12px', display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
            {Object.entries(t.abs).map(([code, label]) => {
              const abs = ABS[code as unknown as keyof typeof ABS];
              return (
                <button key={code} onClick={() => { assignAbsence(picker.userId, picker.day, code); setPicker(null); }}
                  style={{
                    padding: '4px 8px', borderRadius: 4, border: 'none', background: `${abs?.bg}33`,
                    color: isDark ? abs?.textD : abs?.textL, fontSize: 9, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                  title={label}
                >
                  <span>{abs?.icon}</span>{label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Absence modal (fallback) */}
      {absModal && (
        <div style={{ position: 'fixed', inset: 0, background: th.modalBg, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}
          onClick={() => setAbsModal(null)}>
          <div style={{ background: th.modalCard, border: `1px solid ${th.border}`, borderRadius: 8, padding: 24, width: 280 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 9, color: th.goldDim, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 6 }}>{t.setAbsence}</div>
            <div style={{ fontSize: 16, fontWeight: 400, color: th.gold, marginBottom: 16 }}>
              {users.find(u => u.id === absModal.userId)?.first_name} · {t.days[absModal.day]}
            </div>
            {Object.entries(t.abs).map(([code, label]) => {
              const abs = ABS[code as unknown as keyof typeof ABS];
              return (
                <button key={code} onClick={() => assignAbsence(absModal.userId, absModal.day, code)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', marginBottom: 3,
                    borderRadius: 4, border: 'none', background: th.btnBg, borderLeft: `3px solid ${abs?.bg}`,
                    color: th.textMuted, fontSize: 11, fontWeight: 500, cursor: 'pointer', textAlign: 'left' as const,
                  }}
                ><span style={{ fontSize: 14 }}>{abs?.icon}</span>{label}</button>
              );
            })}
            <button onClick={() => setAbsModal(null)} style={{
              marginTop: 12, width: '100%', padding: 8, borderRadius: 4, border: `1px solid ${th.borderFaint}`,
              background: 'transparent', color: th.textDim, cursor: 'pointer', fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' as const,
            }}>{t.cancel}</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlide { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${th.scrollThumb}; border-radius: 2px; }
      `}</style>
    </div>
  );
}

/* ─── Style helpers ─── */
function navBtn(th: Record<string, string>): React.CSSProperties {
  return { width: 32, height: 32, borderRadius: 4, border: `1px solid ${th.goldFaint}`, background: 'transparent', color: th.gold, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' };
}
function thBase(th: Record<string, string>): React.CSSProperties {
  return { padding: 0, borderBottom: `1px solid ${th.border}`, borderRight: `1px solid ${th.borderFaint}` };
}
