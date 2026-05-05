import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/themeContext';
import { themes, JOB_COLORS, ABS } from '../i18n/translations';
import { format, startOfWeek, addDays, getWeek } from 'date-fns';
import io from 'socket.io-client';

interface Allocation {
  id: string;
  user_id: string;
  task_id: string;
  day_of_week: number;
  week_id: string;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  department: string;
}

interface Week {
  id: string;
  week_number: number;
  year: number;
  schedule_type: string;
  status: string;
  created_by_id: string;
  published_at: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Task {
  id: string;
  code: string;
  name: string;
}

const T = {
  de: {
    brand: 'Emmenegger',
    sub: 'Disposition & Planung',
    employees: 'Mitarbeiter',
    assignments: 'Zuweisungen',
    absences: 'Absenzen',
    objects: 'Objekte',
    today: 'Heute',
    objekte: 'Objekte',
    absenzen: 'Absenzen',
    setAbsence: 'Absenz setzen',
    cancel: 'Abbrechen',
    clickRemove: 'Klicken zum Entfernen',
    blocked: 'Blockiert: Absenz am',
    removed: 'Zuweisung entfernt',
    set: 'gesetzt',
    objectDir: 'Objektverzeichnis',
    bothDept: 'Beide Abt.',
    gartenFull: 'Garten & Tiefbau',
    unterhaltFull: 'Unterhalt',
    all: 'Alle',
    garten: 'Garten',
    unterhalt: 'Unterhalt',
    days: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
    abs: { '1': 'Ferien', '2': 'Schule', '3': 'ÜK', '4': 'Unfall', '5': 'Krank', '6': 'Teilzeit' },
  },
};

function getWeekDates(off: number) {
  const n = new Date();
  const d = n.getDay();
  const diff = d === 0 ? -6 : 1 - d;
  const mon = new Date(n);
  mon.setDate(n.getDate() + diff + off * 7);
  return Array.from({ length: 6 }, (_, i) => {
    const x = new Date(mon);
    x.setDate(mon.getDate() + i);
    return x;
  });
}

function fmtDate(d: Date) {
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

function getKW(d: Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const w1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - w1.getTime()) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}

export function SchedulePage() {
  const { isDark } = useTheme();
  const th = isDark ? themes.dark : themes.light;
  const t = T.de;

  const [weekOff, setWeekOff] = useState(0);
  const [dept, setDept] = useState('all');
  const [users, setUsers] = useState<User[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [taskMap, setTaskMap] = useState<Record<string, string>>({});
  const [alloc, setAlloc] = useState<Record<string, Record<number, { slots?: string[]; absences?: string[] }>>>({});
  const [selectedEmp, setSelectedEmp] = useState<string | null>(null);
  const [absModal, setAbsModal] = useState<{ user_id: string; day: number } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'info' | 'ok' | 'err' } | null>(null);
  const [hover, setHover] = useState<{ e: string; d: number } | null>(null);

  const dates = getWeekDates(weekOff);
  const kw = getKW(dates[0]);
  const emps = users.filter(u => dept === 'all' || u.department === dept);

  const totalSlots = Object.values(alloc).reduce(
    (s, userAlloc) => s + Object.values(userAlloc).reduce((us, dayAlloc) => us + (dayAlloc.slots?.length || 0), 0),
    0
  );
  const totalAbs = Object.values(alloc).reduce(
    (s, userAlloc) => s + Object.values(userAlloc).reduce((us, dayAlloc) => us + (dayAlloc.absences?.length || 0), 0),
    0
  );
  const activeJobs = new Set(
    Object.values(alloc).flatMap(userAlloc =>
      Object.values(userAlloc).flatMap((a: any) => a.slots || []).filter((s: string) => JOB_COLORS[s as keyof typeof JOB_COLORS])
    )
  );

  const showToast = (msg: string, type: 'info' | 'ok' | 'err' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  // Socket.IO
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001');
    socket.on('connect', () => console.log('✅ Socket connected'));
    socket.on('allocation:created', () => {
      console.log('📢 Allocation created');
      fetchAllocations();
    });
    socket.on('allocation:deleted', () => {
      console.log('📢 Allocation deleted');
      fetchAllocations();
    });
    return () => socket.close();
  }, []);

  // Fetch weeks
  useEffect(() => {
    const fetchWeeks = async () => {
      const token = localStorage.getItem('token');
      try {
        const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/v1/weeks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json();
        setWeeks(Array.isArray(data.data) ? data.data : []);
        console.log('📅 Weeks loaded:', data.data?.length);
      } catch (err) {
        console.error('❌ Error fetching weeks:', err);
      }
    };
    fetchWeeks();
  }, []);

  // Fetch tasks
  useEffect(() => {
    const fetchTasks = async () => {
      const token = localStorage.getItem('token');
      try {
        const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/v1/tasks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json();
        const map: Record<string, string> = {};
        if (Array.isArray(data.data)) {
          data.data.forEach((task: Task) => {
            map[task.id] = task.code.toLowerCase();
          });
        }
        setTaskMap(map);
        console.log('📋 Task map created:', Object.keys(map).length);
      } catch (err) {
        console.error('❌ Error fetching tasks:', err);
      }
    };
    fetchTasks();
  }, []);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem('token');
      try {
        const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/v1/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json();
        setUsers(Array.isArray(data.data) ? data.data : []);
        console.log('👥 Users set:', data.data?.length);
      } catch (err) {
        console.error('❌ Error fetching users:', err);
      }
    };
    fetchUsers();
  }, [dept]);

  // Fetch allocations
  useEffect(() => {
    fetchAllocations();
  }, [weekOff, users.length, taskMap]);

  const fetchAllocations = async () => {
    const token = localStorage.getItem('token');
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/v1/allocations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();

      // Get current week ID
      const currentKW = getKW(dates[0]);
      const currentYear = dates[0].getFullYear();
      const currentWeek = weeks.find(w => w.week_number === currentKW && w.year === currentYear);

      console.log('📊 Raw allocations from API:', data.data?.slice(0, 5).map((a: any) => ({ user_id: a.user_id, day_of_week: a.day_of_week, task_id: a.task_id })));
      console.log('📊 Filtering for week:', currentWeek?.id, 'KW', currentKW, 'Year', currentYear);

      const newAlloc: Record<string, Record<number, { slots?: string[]; absences?: string[] }>> = {};

      if (Array.isArray(data.data)) {
        data.data.forEach((a: Allocation) => {
          // FILTER: Only include allocations from current week
          if (a.week_id !== currentWeek?.id) {
            console.log('⏭️ Skipping allocation from different week:', a.week_id);
            return;
          }

          if (!newAlloc[a.user_id]) newAlloc[a.user_id] = {};
          if (!newAlloc[a.user_id][a.day_of_week]) {
            newAlloc[a.user_id][a.day_of_week] = { slots: [] };
          }

          const code = taskMap[a.task_id];
          if (code) {
            // Check if slot already exists, don't add duplicates
            if (!newAlloc[a.user_id][a.day_of_week].slots!.includes(code)) {
              newAlloc[a.user_id][a.day_of_week].slots!.push(code);
              console.log('✅ Added allocation:', a.user_id, 'day', a.day_of_week, 'code', code);
            }
          }
        });
      }

      setAlloc(newAlloc);
      console.log('📊 Final allocations:', newAlloc);
    } catch (err) {
      console.error('❌ Error fetching allocations:', err);
    }
  };

  const getA = (userId: string, day: number) => alloc[userId]?.[day];

  const drop = async (userId: string, day: number, code: string) => {
    if (!code) {
      console.warn('⚠️ No code data');
      return;
    }

    console.log('📥 DROP triggered:', userId, day, 'code=', code);

    // Check if it's an absence code
    const isAbsence = Object.keys(T.de.abs).includes(code);

    if (isAbsence) {
      // Handle absence drop
      setAlloc(p => {
        const newAlloc = { ...p };
        if (!newAlloc[userId]) newAlloc[userId] = {};
        if (!newAlloc[userId][day]) newAlloc[userId][day] = { slots: [], absences: [] };
        if (!newAlloc[userId][day].absences) newAlloc[userId][day].absences = [];
        if (!newAlloc[userId][day].absences!.includes(code)) {
          newAlloc[userId][day].absences!.push(code);
        }
        return newAlloc;
      });
      const absLabel = T.de.abs[code as keyof typeof T.de.abs];
      showToast(`${absLabel} → ${users.find(e => e.id === userId)?.first_name || 'Unknown'}`, 'ok');
      return;
    }

    // Handle task drop (original logic)
    const ex = getA(userId, day);
    if (ex?.absences && ex.absences.length > 0) {
      showToast(`${t.blocked} ${t.days[day]}`, 'err');
      return;
    }

    const token = localStorage.getItem('token');

    // Find task ID by matching the code
    const taskId = Object.entries(taskMap).find(([_, taskCode]) => taskCode === code)?.[0];

    if (!taskId) {
      console.warn('⚠️ Task not found for code:', code);
      showToast('Task not found', 'err');
      return;
    }

    // Get the current week number and year from dates[0]
    const currentKW = getKW(dates[0]);
    const currentYear = dates[0].getFullYear();

    // Find the matching week
    const currentWeek = weeks.find(w => w.week_number === currentKW && w.year === currentYear);

    if (!currentWeek) {
      console.warn('⚠️ Current week not found. Looking for KW', currentKW, 'Year', currentYear);
      showToast('Week not found', 'err');
      return;
    }

    console.log('✅ Found week:', currentWeek.id);

    try {
      // Calculate next time_slot: count existing slots + 1
      const existingSlots = alloc[userId]?.[day]?.slots?.length || 0;
      const nextTimeSlot = existingSlots + 1;

      console.log('📊 Existing slots for this cell:', existingSlots, 'Next time_slot:', nextTimeSlot);

      const payload = {
        user_id: userId,
        task_id: taskId,
        day_of_week: day,
        week_id: currentWeek.id,
        time_slot: nextTimeSlot,
      };

      console.log('📤 Payload:', payload);

      const resp = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/v1/allocations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (resp.ok) {
        console.log('✅ Allocation created successfully');
        await fetchAllocations();
        const job = JOB_COLORS[code as keyof typeof JOB_COLORS];
        const empName = users.find(e => e.id === userId)?.first_name || 'Unknown';
        showToast(`${job?.label || code} → ${empName}`, 'ok');
      } else {
        const err = await resp.json();
        console.error('❌ Server error:', err);
        showToast(`Error: ${err.message || 'Failed to create allocation'}`, 'err');
      }
    } catch (err) {
      console.error('❌ Error creating allocation:', err);
      showToast('Network error', 'err');
    }
  };

  const rm = async (userId: string, day: number) => {
    const token = localStorage.getItem('token');

    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/v1/allocations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();

      const allocToDelete = data.data?.find((a: Allocation) => a.user_id === userId && a.day_of_week === day);

      if (allocToDelete) {
        const delResp = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/v1/allocations/${allocToDelete.id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (delResp.ok) {
          await fetchAllocations();
          showToast(t.removed, 'info');
          console.log('✅ Allocation deleted');
        }
      }
    } catch (err) {
      console.error('❌ Error deleting allocation:', err);
    }
  };

  const rmAbsence = (userId: string, day: number, absenceCode: string) => {
    setAlloc(p => {
      const newAlloc = { ...p };
      if (newAlloc[userId] && newAlloc[userId][day]) {
        newAlloc[userId][day].absences = newAlloc[userId][day].absences?.filter(a => a !== absenceCode) || [];
      }
      return newAlloc;
    });
    showToast(t.removed, 'info');
  };

  const jobBg = (code: string) => {
    const job = JOB_COLORS[code as keyof typeof JOB_COLORS];
    return isDark ? job?.bgD : job?.bgL;
  };

  const jobText = (code: string) => {
    const job = JOB_COLORS[code as keyof typeof JOB_COLORS];
    return isDark ? job?.textD : job?.textL;
  };

  const absBg = (code: string) => {
    const abs = ABS[code as keyof typeof ABS];
    return isDark ? abs?.bgD : abs?.bgL;
  };

  const absText = (code: string) => {
    const abs = ABS[code as keyof typeof ABS];
    return isDark ? abs?.textD : abs?.textL;
  };

  const deptLabel = (d: string) =>
    d === 'garten' ? t.gartenFull : d === 'unterhalt' ? t.unterhaltFull : t.bothDept;

  return (
    <div
      style={{
        fontFamily: "'Cormorant Garamond','Garamond','Georgia',serif",
        background: th.bg,
        color: th.text,
        minHeight: '100vh',
        transition: 'background 0.4s ease, color 0.4s ease',
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />

      {/* TOAST */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 1000,
            background: toast.type === 'err' ? th.toastErrBg : th.toastBg,
            color: toast.type === 'err' ? th.toastErrText : th.toastText,
            padding: '12px 20px',
            borderRadius: 2,
            fontSize: 12,
            fontFamily: "'Outfit',sans-serif",
            fontWeight: 500,
            letterSpacing: 0.3,
            border: `1px solid ${toast.type === 'err' ? th.toastErrBorder : th.toastBorder}`,
            backdropFilter: 'blur(20px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            animation: 'fadeSlide 0.35s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* MAIN */}
      <main style={{ padding: '20px 24px', minHeight: '100vh' }}>
        {/* Week nav + stats */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setWeekOff(w => w - 1)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 2,
                border: `1px solid ${th.goldFaint}`,
                background: 'transparent',
                color: th.gold,
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = th.switchActive;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              ‹
            </button>

            <div style={{ textAlign: 'center', minWidth: 130 }}>
              <div style={{ fontSize: 32, fontWeight: 300, color: th.gold, lineHeight: 1, letterSpacing: 1 }}>
                KW {kw}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: th.textDim,
                  marginTop: 4,
                  fontFamily: "'Outfit',sans-serif",
                  fontWeight: 400,
                  letterSpacing: 0.5,
                }}
              >
                {fmtDate(dates[0])} — {fmtDate(dates[5])}
              </div>
            </div>

            <button
              onClick={() => setWeekOff(w => w + 1)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 2,
                border: `1px solid ${th.goldFaint}`,
                background: 'transparent',
                color: th.gold,
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = th.switchActive;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              ›
            </button>

            <button
              onClick={() => setWeekOff(0)}
              style={{
                padding: '6px 12px',
                borderRadius: 2,
                border: 'none',
                background: th.switchActive,
                color: th.gold,
                cursor: 'pointer',
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                fontFamily: "'Outfit',sans-serif",
              }}
            >
              {t.today}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { v: emps.length, l: t.employees },
              { v: totalSlots, l: t.assignments },
              { v: totalAbs, l: t.absences },
              { v: activeJobs.size, l: t.objects },
            ].map((s, i) => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 300, color: th.statColors?.[i] || th.gold, lineHeight: 1 }}>
                  {s.v}
                </div>
                <div
                  style={{
                    fontSize: 8,
                    color: th.textGhost,
                    marginTop: 3,
                    fontFamily: "'Outfit',sans-serif",
                    fontWeight: 600,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GRID */}
        <div
          style={{
            background: th.bgCard,
            borderRadius: 2,
            border: `1px solid ${th.border}`,
            overflow: 'hidden',
            boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 32 }} />
              <col style={{ width: 140 }} />
              {t.days.map((_, i) => (
                <col key={i} />
              ))}
            </colgroup>
            <thead>
              <tr style={{ height: 32 }}>
                <th
                  style={{
                    padding: '0',
                    borderBottom: `1px solid ${th.border}`,
                    borderRight: `1px solid ${th.borderFaint}`,
                    background: th.goldGhost,
                  }}
                />
                <th
                  style={{
                    padding: '6px 12px',
                    textAlign: 'left',
                    borderBottom: `1px solid ${th.border}`,
                    borderRight: `1px solid ${th.borderFaint}`,
                    background: th.goldGhost,
                    fontSize: 8,
                    color: th.goldDim,
                    fontFamily: "'Outfit',sans-serif",
                    fontWeight: 600,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                  }}
                >
                  {t.employees}
                </th>
                {t.days.map((d, i) => (
                  <th
                    key={d}
                    style={{
                      padding: '4px 4px',
                      textAlign: 'center',
                      borderBottom: `1px solid ${th.border}`,
                      borderRight: i < 5 ? `1px solid ${th.borderFaint}` : 'none',
                      background: th.goldGhost,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 400, color: th.gold, letterSpacing: 0.5 }}>
                      {d}
                    </div>
                    <div
                      style={{
                        fontSize: 8,
                        color: th.textGhost,
                        marginTop: 0,
                        fontFamily: "'Outfit',sans-serif",
                        fontWeight: 500,
                      }}
                    >
                      {fmtDate(dates[i])}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emps.map((emp, idx) => {
                const isSel = selectedEmp === emp.id;
                return (
                  <tr
                    key={emp.id}
                    style={{
                      height: 28,
                      borderTop: idx > 0 ? `1px solid ${th.borderFaint}` : 'none',
                      background: isSel ? th.goldGhost : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      if (!isSel) (e.currentTarget as HTMLTableRowElement).style.background = th.rowHover;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLTableRowElement).style.background = isSel ? th.goldGhost : 'transparent';
                    }}
                  >
                    <td
                      style={{
                        padding: '0',
                        textAlign: 'center',
                        borderRight: `1px solid ${th.borderFaint}`,
                        fontSize: 9,
                        fontWeight: 700,
                        color: emp.department === 'garten' ? th.roleV : th.roleM,
                      }}
                    >
                      {emp.department === 'garten' ? 'V' : 'M'}
                    </td>
                    <td
                      style={{
                        padding: '4px 12px',
                        borderRight: `1px solid ${th.borderFaint}`,
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedEmp(selectedEmp === emp.id ? null : emp.id)}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: isSel ? th.empNameSel : th.empName,
                          letterSpacing: 0.3,
                        }}
                      >
                        {emp.first_name} {emp.last_name}
                      </div>
                      <div
                        style={{
                          fontSize: 7,
                          color: isSel ? th.goldDim : th.textGhost,
                          fontFamily: "'Outfit',sans-serif",
                          fontWeight: 500,
                          letterSpacing: 1,
                          textTransform: 'uppercase',
                          marginTop: 0,
                        }}
                      >
                        {deptLabel(emp.department)}
                      </div>
                    </td>
                    {t.days.map((_, di) => {
                      const a = getA(emp.id, di);
                      const isHover = hover?.e === emp.id && hover?.d === di;

                      return (
                        <td
                          key={di}
                          style={{
                            background: isHover ? th.cellHover : 'transparent',
                            borderRight: di < 5 ? `1px solid ${th.borderFaint}` : 'none',
                            cursor: 'pointer',
                            position: 'relative',
                            padding: '2px 1px',
                            overflow: 'hidden',
                            height: 28,
                          }}
                          onMouseEnter={() => setHover({ e: emp.id, d: di })}
                          onMouseLeave={() => setHover(null)}
                          onDragEnter={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            setHover({ e: emp.id, d: di });
                          }}
                          onDragOver={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = 'copy';
                          }}
                          onDragLeave={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (e.target === e.currentTarget) setHover(null);
                          }}
                          onDrop={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            const code = e.dataTransfer.getData('text/plain');
                            console.log('📥 DROP on', emp.id, di, 'code=', code);
                            drop(emp.id, di, code);
                            setHover(null);
                          }}
                          onClick={() => {
                            if ((!a?.slots || a.slots.length === 0) && (!a?.absences || a.absences.length === 0)) {
                              setAbsModal({ user_id: emp.id, day: di });
                            }
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'row', gap: '1px', height: '100%', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                            {a?.absences?.map((absCode, idx) => (
                              <div
                                key={`abs-${idx}`}
                                onClick={e => {
                                  e.stopPropagation();
                                  rmAbsence(emp.id, di, absCode);
                                }}
                                style={{
                                  background: absBg(absCode),
                                  color: absText(absCode),
                                  padding: '2px 3px',
                                  borderRadius: '2px',
                                  fontSize: '8px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'opacity 0.2s',
                                  flex: 1,
                                  textAlign: 'center',
                                  minHeight: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '1px',
                                  borderLeft: `2px solid ${absBg(absCode)}`,
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.opacity = '0.8';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.opacity = '1';
                                }}
                                title={T.de.abs[absCode as keyof typeof T.de.abs]}
                              >
                                <span style={{ flexShrink: 0 }}>{ABS[absCode as keyof typeof ABS]?.icon}</span>
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '7px' }}>
                                  {T.de.abs[absCode as keyof typeof T.de.abs]}
                                </span>
                              </div>
                            ))}
                            {a?.slots?.map((code, idx) => (
                              <div
                                key={`slot-${idx}`}
                                onClick={e => {
                                  e.stopPropagation();
                                  rm(emp.id, di);
                                }}
                                style={{
                                  background: jobBg(code),
                                  color: jobText(code),
                                  padding: '2px 4px',
                                  borderRadius: '2px',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'opacity 0.2s',
                                  flex: 1,
                                  textAlign: 'center',
                                  minHeight: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.opacity = '0.8';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.opacity = '1';
                                }}
                              >
                                {code.toUpperCase()}
                              </div>
                            ))}
                            {isHover && (!a?.slots || a.slots.length === 0) && (!a?.absences || a.absences.length === 0) && (
                              <div style={{ color: th.goldFaint, fontSize: 14, fontWeight: 300 }}>+</div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* LEGEND - TASKS */}
        <div
          style={{
            marginTop: 16,
            padding: '16px 20px',
            background: th.bgCard,
            borderRadius: 2,
            border: `1px solid ${th.border}`,
          }}
        >
          <div
            style={{
              fontSize: 8,
              color: th.goldDim,
              marginBottom: 12,
              fontFamily: "'Outfit',sans-serif",
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            {t.objectDir} · KW {kw}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 4,
            }}
          >
            {Object.entries(JOB_COLORS).map(([code, job]) => {
              const count = Object.values(alloc).reduce((s, userAlloc) => {
                return (
                  s +
                  Object.values(userAlloc).reduce((us, dayAlloc: any) => {
                    return us + (dayAlloc.slots?.filter((x: string) => x === code).length || 0);
                  }, 0)
                );
              }, 0);

              return (
                <div
                  key={code}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('text/plain', code);
                    console.log('🎯 Drag START from legend:', code);
                  }}
                  onDragEnd={() => {
                    console.log('🎯 Drag END from legend');
                  }}
                  style={{
                    padding: '8px 10px',
                    background: th.legendItemBg,
                    borderRadius: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderLeft: '2px solid transparent',
                    backgroundImage: `linear-gradient(${th.bgCard},${th.bgCard}), ${isDark ? job.bgD : job.bgL}`,
                    backgroundOrigin: 'padding-box, border-box',
                    backgroundClip: 'padding-box, border-box',
                    border: '1px solid transparent',
                    cursor: 'grab',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateX(3px)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateX(0)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 2,
                        background: isDark ? job.bgD : job.bgL,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isDark ? job.textD : job.textL,
                        fontSize: 11,
                        fontWeight: 700,
                        boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 2px rgba(0,0,0,0.08)',
                        flexShrink: 0,
                      }}
                    >
                      {code.toUpperCase()}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        color: th.textMuted,
                        fontFamily: "'Outfit',sans-serif",
                      }}
                    >
                      {job.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      color: count > 0 ? th.legendCountActive : th.legendCountInactive,
                      fontFamily: "'Outfit',sans-serif",
                      fontWeight: 600,
                      flexShrink: 0,
                      marginLeft: 8,
                    }}
                  >
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* LEGEND - ABSENCES */}
        <div
          style={{
            marginTop: 16,
            padding: '16px 20px',
            background: th.bgCard,
            borderRadius: 2,
            border: `1px solid ${th.border}`,
          }}
        >
          <div
            style={{
              fontSize: 8,
              color: th.goldDim,
              marginBottom: 12,
              fontFamily: "'Outfit',sans-serif",
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            {t.absenzen} · KW {kw}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 4,
            }}
          >
            {Object.entries(T.de.abs).map(([code, label]) => {
              const abs = ABS[code as keyof typeof ABS];
              const count = Object.values(alloc).reduce((s, userAlloc) => {
                return (
                  s +
                  Object.values(userAlloc).reduce((us, dayAlloc: any) => {
                    return us + (dayAlloc.absences?.filter((x: string) => x === code).length || 0);
                  }, 0)
                );
              }, 0);

              return (
                <div
                  key={code}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('text/plain', code);
                    console.log('🎯 Drag START absence:', code);
                  }}
                  onDragEnd={() => {
                    console.log('🎯 Drag END absence');
                  }}
                  style={{
                    padding: '8px 10px',
                    background: th.legendItemBg,
                    borderRadius: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderLeft: '2px solid transparent',
                    backgroundImage: `linear-gradient(${th.bgCard},${th.bgCard}), ${isDark ? abs?.bgD : abs?.bgL}`,
                    backgroundOrigin: 'padding-box, border-box',
                    backgroundClip: 'padding-box, border-box',
                    border: '1px solid transparent',
                    cursor: 'grab',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateX(3px)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateX(0)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 2,
                        background: isDark ? abs?.bgD : abs?.bgL,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isDark ? abs?.textD : abs?.textL,
                        fontSize: 12,
                        fontWeight: 700,
                        boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 2px rgba(0,0,0,0.08)',
                        flexShrink: 0,
                      }}
                    >
                      {abs?.icon}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        color: th.textMuted,
                        fontFamily: "'Outfit',sans-serif",
                      }}
                    >
                      {label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      color: count > 0 ? th.legendCountActive : th.legendCountInactive,
                      fontFamily: "'Outfit',sans-serif",
                      fontWeight: 600,
                      flexShrink: 0,
                      marginLeft: 8,
                    }}
                  >
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* ABSENCE MODAL (Alternative method) */}
      {absModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: th.modalBg,
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 500,
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setAbsModal(null)}
        >
          <div
            style={{
              background: th.modalCard,
              border: `1px solid ${th.border}`,
              borderRadius: 2,
              padding: 24,
              width: 280,
              boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.5)' : '0 16px 48px rgba(0,0,0,0.1)',
              animation: 'scaleIn 0.25s cubic-bezier(0.16,1,0.3,1)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: 8,
                color: th.goldDim,
                marginBottom: 6,
                fontFamily: "'Outfit',sans-serif",
                fontWeight: 600,
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              {t.setAbsence}
            </div>
            <div style={{ fontSize: 16, fontWeight: 400, color: th.gold, marginBottom: 3 }}>
              {users.find(e => e.id === absModal.user_id)?.first_name}
            </div>
            <div
              style={{
                fontSize: 10,
                color: th.textDim,
                marginBottom: 16,
                fontFamily: "'Outfit',sans-serif",
              }}
            >
              {t.days[absModal.day]}, {fmtDate(dates[absModal.day])}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {Object.entries(T.de.abs).map(([code, label]) => {
                const abs = ABS[code as keyof typeof ABS];
                return (
                  <button
                    key={code}
                    onClick={() => {
                      if (absModal) drop(absModal.user_id, absModal.day, code);
                      setAbsModal(null);
                    }}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 2,
                      border: 'none',
                      background: th.btnBg,
                      borderLeft: `2px solid ${abs?.bg}`,
                      color: th.textMuted,
                      fontSize: 11,
                      fontWeight: 500,
                      fontFamily: "'Outfit',sans-serif",
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = th.btnBgHover;
                      (e.currentTarget as HTMLButtonElement).style.color = th.gold;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = th.btnBg;
                      (e.currentTarget as HTMLButtonElement).style.color = th.textMuted;
                    }}
                  >
                    <span style={{ fontSize: 12, width: 16, textAlign: 'center' }}>
                      {abs?.icon}
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setAbsModal(null)}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '8px',
                borderRadius: 2,
                border: `1px solid ${th.borderFaint}`,
                background: 'transparent',
                color: th.textDim,
                cursor: 'pointer',
                fontSize: 9,
                fontFamily: "'Outfit',sans-serif",
                fontWeight: 500,
                letterSpacing: 1,
                textTransform: 'uppercase',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.color = th.textMuted;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.color = th.textDim;
              }}
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlide { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${th.scrollThumb}; border-radius: 2px; }
      `}</style>
    </div>
  );
}
