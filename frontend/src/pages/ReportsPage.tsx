import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/themeContext';
import { themes, JOB_COLORS, ABS } from '../i18n/translations';
import { format } from 'date-fns';
import { useAuthStore } from '../contexts/authStore';
import { supabase } from '../lib/supabaseClient';

// ─── INTERFACES ───

interface Allocation {
  id: string;
  user_id: string;
  task_id: string;
  day_of_week: number;
  week_id: string;
  time_slot: number;
}

interface Week {
  id: string;
  week_number: number;
  year: number;
  schedule_type: string;
  status: string;
}

interface Task {
  id: string;
  code: string;
  name: string;
}

interface AbsenceRecord {
  id: string;
  user_id: string;
  date: string;
  absence_code: number;
}

interface TimeReport {
  id: string;
  user_id: string;
  task_id: string;
  date: string;
  planned_hours: number | null;
  actual_hours: number | null;
  status: string;
  work_description: string | null;
  notes: string | null;
  photos: string[];
  submitted_at: string | null;
}

interface ReportModal {
  taskCode: string;
  taskId: string;
  taskLabel: string;
  dayIndex: number;
  date: string;
  existingReport: TimeReport | null;
}

// ─── TRANSLATIONS ───

const T = {
  de: {
    mySchedule: 'Mein Wochenplan',
    today: 'Heute',
    tasks: 'Aufträge',
    absences: 'Absenzen',
    days: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
    abs: { '1': 'Ferien', '2': 'Schule', '3': 'ÜK', '4': 'Unfall', '5': 'Krank', '6': 'Teilzeit' } as Record<string, string>,
    greeting: 'Hallo',
    yourWeek: 'Deine Woche auf einen Blick',
    free: 'Frei',
    reportTime: 'Zeit erfassen',
    startTime: 'Startzeit',
    endTime: 'Endzeit',
    totalHours: 'Total Stunden',
    plannedHours: 'Geplant',
    actualHours: 'Effektiv',
    description: 'Beschreibung der Arbeit',
    notes: 'Zusätzliche Bemerkungen',
    photos: 'Fotos',
    addPhoto: 'Foto hinzufügen',
    save: 'Speichern',
    cancel: 'Abbrechen',
    saved: 'Rapport gespeichert',
    updated: 'Rapport aktualisiert',
    error: 'Fehler beim Speichern',
    reported: 'Erfasst',
    notReported: 'Offen',
    uploadingPhoto: 'Foto wird hochgeladen...',
    removePhoto: 'Foto entfernen',
    clickToReport: 'Antippen zum Erfassen',
    status: {
      PLANNED: 'Geplant',
      COMPLETED: 'Erledigt',
      PARTIAL: 'Teilweise',
      NOT_DONE: 'Nicht erledigt',
      ADDED: 'Zusätzlich',
    } as Record<string, string>,
  },
};

// ─── HELPERS ───

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

function isToday(d: Date) {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function timeToHours(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h + m / 60;
}

function hoursToDisplay(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

// ─── COMPONENT ───

export function ReportsPage() {
  const { isDark } = useTheme();
  const th = isDark ? themes.dark : themes.light;
  const t = T.de;
  const { user } = useAuthStore();

  const [weekOff, setWeekOff] = useState(0);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [taskMap, setTaskMap] = useState<Record<string, { code: string; name: string }>>({});
  const [mySlots, setMySlots] = useState<Record<number, string[]>>({});
  const [myAbsences, setMyAbsences] = useState<Record<number, string[]>>({});
  const [reports, setReports] = useState<TimeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ReportModal | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  // Modal form state
  const [formStartTime, setFormStartTime] = useState('07:00');
  const [formEndTime, setFormEndTime] = useState('16:00');
  const [formPlannedHours, setFormPlannedHours] = useState('8');
  const [formDescription, setFormDescription] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [formStatus, setFormStatus] = useState('COMPLETED');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dates = getWeekDates(weekOff);
  const kw = getKW(dates[0]);

  const totalTasks = Object.values(mySlots).reduce((s, arr) => s + arr.length, 0);
  const totalAbs = Object.values(myAbsences).reduce((s, arr) => s + arr.length, 0);

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  // ─── DATA FETCHING ───

  useEffect(() => {
    const fetchWeeks = async () => {
      const token = localStorage.getItem('token');
      try {
        const resp = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/weeks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json();
        setWeeks(Array.isArray(data.data) ? data.data : []);
      } catch (err) {
        console.error('❌ Error fetching weeks:', err);
      }
    };
    fetchWeeks();
  }, []);

  useEffect(() => {
    const fetchTasks = async () => {
      const token = localStorage.getItem('token');
      try {
        const resp = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/tasks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json();
        const map: Record<string, { code: string; name: string }> = {};
        if (Array.isArray(data.data)) {
          data.data.forEach((task: Task) => {
            map[task.id] = { code: task.code.toLowerCase(), name: task.name };
          });
        }
        setTaskMap(map);
      } catch (err) {
        console.error('❌ Error fetching tasks:', err);
      }
    };
    fetchTasks();
  }, []);

  useEffect(() => {
    if (!user || weeks.length === 0 || Object.keys(taskMap).length === 0) return;

    const fetchMyData = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      const currentKW = getKW(dates[0]);
      const currentYear = dates[0].getFullYear();
      const currentWeek = weeks.find(w => w.week_number === currentKW && w.year === currentYear);

      // Allocations
      const slots: Record<number, string[]> = {};
      try {
        const resp = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/allocations?user_id=${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json();
        if (Array.isArray(data.data)) {
          data.data.forEach((a: Allocation) => {
            if (a.week_id !== currentWeek?.id) return;
            if (!slots[a.day_of_week]) slots[a.day_of_week] = [];
            const task = taskMap[a.task_id];
            if (task && !slots[a.day_of_week].includes(task.code)) {
              slots[a.day_of_week].push(task.code);
            }
          });
        }
      } catch (err) {
        console.error('❌ Error fetching allocations:', err);
      }
      setMySlots(slots);

      // Absences
      const absences: Record<number, string[]> = {};
      const startDate = format(dates[0], 'yyyy-MM-dd');
      const endDate = format(dates[5], 'yyyy-MM-dd');
      try {
        const resp = await fetch(
          `${import.meta.env.VITE_API_URL || ''}/api/v1/absences?startDate=${startDate}&endDate=${endDate}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await resp.json();
        if (Array.isArray(data.data)) {
          data.data.forEach((abs: AbsenceRecord) => {
            if (abs.user_id !== user.id) return;
            const absDate = new Date(abs.date + 'T00:00:00');
            const dayIndex = dates.findIndex(
              d => d.getFullYear() === absDate.getFullYear() &&
                  d.getMonth() === absDate.getMonth() &&
                  d.getDate() === absDate.getDate()
            );
            if (dayIndex === -1) return;
            if (!absences[dayIndex]) absences[dayIndex] = [];
            const code = String(abs.absence_code);
            if (!absences[dayIndex].includes(code)) absences[dayIndex].push(code);
          });
        }
      } catch (err) {
        console.error('❌ Error fetching absences:', err);
      }
      setMyAbsences(absences);

      // Time reports for the week
      try {
        const resp = await fetch(
          `${import.meta.env.VITE_API_URL || ''}/api/v1/reports?startDate=${startDate}&endDate=${endDate}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await resp.json();
        setReports(Array.isArray(data.data) ? data.data : []);
      } catch (err) {
        console.error('❌ Error fetching reports:', err);
      }

      setLoading(false);
    };

    fetchMyData();
  }, [weekOff, weeks, taskMap, user]);

  // ─── REPORT HELPERS ───

  const getReportForTaskDay = (taskCode: string, dayIndex: number): TimeReport | null => {
    const dateStr = format(dates[dayIndex], 'yyyy-MM-dd');
    const taskId = Object.entries(taskMap).find(([_, v]) => v.code === taskCode)?.[0];
    if (!taskId) return null;
    return reports.find(r => r.task_id === taskId && r.date === dateStr) || null;
  };

  const openReportModal = (taskCode: string, dayIndex: number) => {
    const taskEntry = Object.entries(taskMap).find(([_, v]) => v.code === taskCode);
    if (!taskEntry) return;
    const [taskId, taskInfo] = taskEntry;
    const dateStr = format(dates[dayIndex], 'yyyy-MM-dd');
    const existing = reports.find(r => r.task_id === taskId && r.date === dateStr) || null;
    const job = JOB_COLORS[taskCode as keyof typeof JOB_COLORS];

    setModal({
      taskCode,
      taskId,
      taskLabel: job?.label || taskInfo.name,
      dayIndex,
      date: dateStr,
      existingReport: existing,
    });

    // Pre-fill form
    if (existing) {
      const actualH = existing.actual_hours || 0;
      const startH = 7;
      const endH = startH + actualH;
      const endHrs = Math.floor(endH);
      const endMins = Math.round((endH - endHrs) * 60);
      setFormStartTime('07:00');
      setFormEndTime(`${String(endHrs).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`);
      setFormPlannedHours(String(existing.planned_hours || 8));
      setFormDescription(existing.work_description || '');
      setFormNotes(existing.notes || '');
      setFormPhotos(existing.photos || []);
      setFormStatus(existing.status || 'COMPLETED');
    } else {
      setFormStartTime('07:00');
      setFormEndTime('16:00');
      setFormPlannedHours('8');
      setFormDescription('');
      setFormNotes('');
      setFormPhotos([]);
      setFormStatus('COMPLETED');
    }
  };

  const computeActualHours = (): number => {
    const start = timeToHours(formStartTime);
    const end = timeToHours(formEndTime);
    return Math.max(0, Math.round((end - start) * 100) / 100);
  };

  // ─── PHOTO UPLOAD ───

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from('report-photos')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('report-photos')
        .getPublicUrl(fileName);

      setFormPhotos(prev => [...prev, urlData.publicUrl]);
    } catch (err) {
      console.error('❌ Photo upload error:', err);
      showToast('Foto-Upload fehlgeschlagen', 'err');
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (url: string) => {
    setFormPhotos(prev => prev.filter(p => p !== url));
  };

  // ─── SAVE REPORT ───

  const saveReport = async () => {
    if (!modal || !user) return;
    setSaving(true);

    const token = localStorage.getItem('token');
    const actualHours = computeActualHours();
    const payload = {
      taskId: modal.taskId,
      date: modal.date,
      plannedHours: parseFloat(formPlannedHours) || 8,
      actualHours,
      status: formStatus,
      workDescription: formDescription || null,
      notes: formNotes || null,
      photos: formPhotos,
    };

    try {
      let resp;
      if (modal.existingReport) {
        resp = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/reports/${modal.existingReport.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      } else {
        resp = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/reports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      }

      if (resp.ok) {
        const result = await resp.json();
        // Update local reports state
        if (modal.existingReport) {
          setReports(prev => prev.map(r => r.id === modal.existingReport!.id ? result.data : r));
          showToast(t.updated, 'ok');
        } else {
          setReports(prev => [...prev, result.data]);
          showToast(t.saved, 'ok');
        }
        setModal(null);
      } else {
        const err = await resp.json();
        showToast(`${t.error}: ${err.message || ''}`, 'err');
      }
    } catch (err) {
      console.error('❌ Error saving report:', err);
      showToast(t.error, 'err');
    }
    setSaving(false);
  };

  // ─── RENDER HELPERS ───

  const getJobColor = (code: string) => {
    const job = JOB_COLORS[code as keyof typeof JOB_COLORS];
    return {
      bg: isDark ? job?.bgD : job?.bgL,
      text: isDark ? job?.textD : job?.textL,
      label: job?.label || code,
    };
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '#4A6741';
      case 'PARTIAL': return '#B8860B';
      case 'NOT_DONE': return '#8B4513';
      case 'ADDED': return '#5B6E82';
      default: return th.textDim;
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed', top: 24, right: 24, zIndex: 1000,
            background: toast.type === 'err' ? th.toastErrBg : th.toastBg,
            color: toast.type === 'err' ? th.toastErrText : th.toastText,
            padding: '12px 20px', borderRadius: 2, fontSize: 12,
            fontFamily: "'Outfit',sans-serif", fontWeight: 500,
            border: `1px solid ${toast.type === 'err' ? th.toastErrBorder : th.toastBorder}`,
            backdropFilter: 'blur(20px)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            animation: 'fadeSlide 0.35s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 28, fontWeight: 300, color: th.gold, letterSpacing: 1 }}>
          {t.greeting}, {user?.first_name || 'User'}
        </div>
        <div style={{ fontSize: 11, color: th.textDim, fontFamily: "'Outfit',sans-serif", fontWeight: 400, letterSpacing: 0.5, marginTop: 4 }}>
          {t.yourWeek}
        </div>
      </div>

      {/* Week nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setWeekOff(w => w - 1)} style={{ width: 36, height: 36, borderRadius: 2, border: `1px solid ${th.goldFaint}`, background: 'transparent', color: th.gold, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = th.switchActive; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>‹</button>

          <div style={{ textAlign: 'center', minWidth: 140 }}>
            <div style={{ fontSize: 36, fontWeight: 300, color: th.gold, lineHeight: 1, letterSpacing: 1 }}>KW {kw}</div>
            <div style={{ fontSize: 11, color: th.textDim, marginTop: 4, fontFamily: "'Outfit',sans-serif", fontWeight: 400, letterSpacing: 0.5 }}>
              {fmtDate(dates[0])} — {fmtDate(dates[5])}
            </div>
          </div>

          <button onClick={() => setWeekOff(w => w + 1)} style={{ width: 36, height: 36, borderRadius: 2, border: `1px solid ${th.goldFaint}`, background: 'transparent', color: th.gold, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = th.switchActive; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>›</button>

          <button onClick={() => setWeekOff(0)} style={{ padding: '8px 14px', borderRadius: 2, border: 'none', background: th.switchActive, color: th.gold, cursor: 'pointer', fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'Outfit',sans-serif" }}>
            {t.today}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 300, color: th.gold, lineHeight: 1 }}>{totalTasks}</div>
            <div style={{ fontSize: 8, color: th.textGhost, marginTop: 3, fontFamily: "'Outfit',sans-serif", fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>{t.tasks}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 300, color: '#7D4E57', lineHeight: 1 }}>{totalAbs}</div>
            <div style={{ fontSize: 8, color: th.textGhost, marginTop: 3, fontFamily: "'Outfit',sans-serif", fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>{t.absences}</div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: th.textDim, fontFamily: "'Outfit',sans-serif", fontSize: 12 }}>Laden...</div>
      )}

      {/* Day cards */}
      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {dates.map((date, di) => {
            const daySlots = mySlots[di] || [];
            const dayAbs = myAbsences[di] || [];
            const hasContent = daySlots.length > 0 || dayAbs.length > 0;
            const isTodayDay = isToday(date);

            return (
              <div
                key={di}
                style={{
                  background: th.bgCard, borderRadius: 2,
                  border: `1px solid ${isTodayDay ? th.gold : th.border}`,
                  overflow: 'hidden',
                  boxShadow: isTodayDay ? (isDark ? '0 0 12px rgba(200,169,110,0.15)' : '0 0 12px rgba(150,120,60,0.1)') : 'none',
                }}
              >
                {/* Day header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: isTodayDay ? th.goldGhost : 'transparent', borderBottom: hasContent ? `1px solid ${th.borderFaint}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 2, background: isTodayDay ? th.gold : th.switchBg, color: isTodayDay ? (isDark ? '#0a0a0a' : '#fff') : th.textDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif" }}>
                      {date.getDate()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 400, color: isTodayDay ? th.gold : th.text, letterSpacing: 0.3 }}>{t.days[di]}</div>
                      <div style={{ fontSize: 9, color: th.textDim, fontFamily: "'Outfit',sans-serif", fontWeight: 400 }}>{fmtDate(date)}</div>
                    </div>
                  </div>
                  {isTodayDay && (
                    <div style={{ fontSize: 8, color: th.gold, fontFamily: "'Outfit',sans-serif", fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', background: th.switchActive, padding: '4px 10px', borderRadius: 2 }}>
                      {t.today}
                    </div>
                  )}
                </div>

                {/* Content */}
                {hasContent ? (
                  <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* Absences */}
                    {dayAbs.map((absCode, idx) => {
                      const abs = ABS[absCode as unknown as keyof typeof ABS];
                      return (
                        <div key={`abs-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: abs?.bg, color: isDark ? abs?.textD : abs?.textL, borderRadius: 2, fontSize: 12, fontWeight: 600, fontFamily: "'Outfit',sans-serif" }}>
                          <span style={{ fontSize: 16 }}>{abs?.icon}</span>
                          <span>{t.abs[absCode]}</span>
                        </div>
                      );
                    })}

                    {/* Tasks (clickable for time reporting) */}
                    {daySlots.map((code, idx) => {
                      const job = getJobColor(code);
                      const report = getReportForTaskDay(code, di);
                      const hasReport = !!report;

                      return (
                        <div
                          key={`task-${idx}`}
                          onClick={() => openReportModal(code, di)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', background: job.bg, color: job.text,
                            borderRadius: 2, cursor: 'pointer',
                            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                            position: 'relative',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                        >
                          <span style={{ width: 28, height: 28, borderRadius: 2, background: 'rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                            {code.toUpperCase()}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Outfit',sans-serif" }}>{job.label}</div>
                            <div style={{ fontSize: 9, opacity: 0.8, fontFamily: "'Outfit',sans-serif", fontWeight: 400, marginTop: 1 }}>
                              {hasReport
                                ? `${t.reported} · ${hoursToDisplay(report!.actual_hours || 0)} · ${t.status[report!.status] || report!.status}`
                                : t.clickToReport
                              }
                            </div>
                          </div>

                          {/* Report status indicator */}
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: hasReport ? statusColor(report!.status) : 'rgba(255,255,255,0.2)',
                            border: hasReport ? 'none' : '1px dashed rgba(255,255,255,0.4)',
                            flexShrink: 0,
                          }} title={hasReport ? t.reported : t.notReported} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '12px 16px', color: th.textDim, fontSize: 11, fontFamily: "'Outfit',sans-serif", fontWeight: 400, fontStyle: 'italic' }}>
                    {t.free}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── TIME REPORT MODAL ─── */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: th.modalBg, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, animation: 'fadeIn 0.2s ease' }}
          onClick={() => setModal(null)}
        >
          <div
            style={{
              background: th.modalCard, border: `1px solid ${th.border}`, borderRadius: 2, padding: 0, width: 420, maxHeight: '90vh', overflow: 'auto',
              boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.5)' : '0 16px 48px rgba(0,0,0,0.1)',
              animation: 'scaleIn 0.25s cubic-bezier(0.16,1,0.3,1)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${th.borderFaint}` }}>
              <div style={{ fontSize: 8, color: th.goldDim, fontFamily: "'Outfit',sans-serif", fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
                {t.reportTime}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 2,
                  background: isDark ? JOB_COLORS[modal.taskCode as keyof typeof JOB_COLORS]?.bgD : JOB_COLORS[modal.taskCode as keyof typeof JOB_COLORS]?.bgL,
                  color: isDark ? JOB_COLORS[modal.taskCode as keyof typeof JOB_COLORS]?.textD : JOB_COLORS[modal.taskCode as keyof typeof JOB_COLORS]?.textL,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700,
                }}>
                  {modal.taskCode.toUpperCase()}
                </span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 400, color: th.gold }}>{modal.taskLabel}</div>
                  <div style={{ fontSize: 10, color: th.textDim, fontFamily: "'Outfit',sans-serif" }}>
                    {t.days[modal.dayIndex]}, {fmtDate(dates[modal.dayIndex])}
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Time inputs */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 9, color: th.goldDim, fontFamily: "'Outfit',sans-serif", fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    {t.startTime}
                  </label>
                  <input type="time" value={formStartTime} onChange={e => setFormStartTime(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 2, border: `1px solid ${th.border}`, background: th.btnBg, color: th.text, fontSize: 14, fontFamily: "'Outfit',sans-serif", outline: 'none' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 9, color: th.goldDim, fontFamily: "'Outfit',sans-serif", fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    {t.endTime}
                  </label>
                  <input type="time" value={formEndTime} onChange={e => setFormEndTime(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 2, border: `1px solid ${th.border}`, background: th.btnBg, color: th.text, fontSize: 14, fontFamily: "'Outfit',sans-serif", outline: 'none' }} />
                </div>
              </div>

              {/* Hours summary */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, padding: '10px 12px', background: th.goldGhost, borderRadius: 2, textAlign: 'center' }}>
                  <div style={{ fontSize: 8, color: th.goldDim, fontFamily: "'Outfit',sans-serif", fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{t.actualHours}</div>
                  <div style={{ fontSize: 20, fontWeight: 300, color: th.gold }}>{hoursToDisplay(computeActualHours())}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 9, color: th.goldDim, fontFamily: "'Outfit',sans-serif", fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    {t.plannedHours}
                  </label>
                  <input type="number" min="0" max="24" step="0.5" value={formPlannedHours} onChange={e => setFormPlannedHours(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 2, border: `1px solid ${th.border}`, background: th.btnBg, color: th.text, fontSize: 14, fontFamily: "'Outfit',sans-serif", outline: 'none' }} />
                </div>
              </div>

              {/* Status */}
              <div>
                <label style={{ fontSize: 9, color: th.goldDim, fontFamily: "'Outfit',sans-serif", fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Status
                </label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['COMPLETED', 'PARTIAL', 'NOT_DONE', 'ADDED'].map(s => (
                    <button key={s} onClick={() => setFormStatus(s)}
                      style={{
                        padding: '6px 12px', borderRadius: 2, border: 'none', cursor: 'pointer',
                        background: formStatus === s ? statusColor(s) : th.btnBg,
                        color: formStatus === s ? '#fff' : th.textMuted,
                        fontSize: 10, fontWeight: 600, fontFamily: "'Outfit',sans-serif",
                        transition: 'all 0.15s ease',
                      }}>
                      {t.status[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: 9, color: th.goldDim, fontFamily: "'Outfit',sans-serif", fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  {t.description}
                </label>
                <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={3} placeholder="Was wurde gemacht..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 2, border: `1px solid ${th.border}`, background: th.btnBg, color: th.text, fontSize: 12, fontFamily: "'Outfit',sans-serif", outline: 'none', resize: 'vertical' }} />
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 9, color: th.goldDim, fontFamily: "'Outfit',sans-serif", fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  {t.notes}
                </label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} placeholder="Zusätzliche Arbeiten, Materialien, Besonderes..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 2, border: `1px solid ${th.border}`, background: th.btnBg, color: th.text, fontSize: 12, fontFamily: "'Outfit',sans-serif", outline: 'none', resize: 'vertical' }} />
              </div>

              {/* Photos */}
              <div>
                <label style={{ fontSize: 9, color: th.goldDim, fontFamily: "'Outfit',sans-serif", fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  {t.photos}
                </label>

                {/* Photo grid */}
                {formPhotos.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
                    {formPhotos.map((url, idx) => (
                      <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: 2, overflow: 'hidden', border: `1px solid ${th.borderFaint}` }}>
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button onClick={() => removePhoto(url)}
                          style={{
                            position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%',
                            background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer',
                            fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>×</button>
                      </div>
                    ))}
                  </div>
                )}

                <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoUpload} style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 2, border: `1px dashed ${th.border}`,
                    background: 'transparent', color: th.textDim, cursor: uploading ? 'wait' : 'pointer',
                    fontSize: 11, fontFamily: "'Outfit',sans-serif", fontWeight: 500,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLButtonElement).style.borderColor = th.gold; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = th.border; }}
                >
                  {uploading ? t.uploadingPhoto : `+ ${t.addPhoto}`}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${th.borderFaint}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)}
                style={{
                  padding: '10px 20px', borderRadius: 2, border: `1px solid ${th.borderFaint}`,
                  background: 'transparent', color: th.textDim, cursor: 'pointer',
                  fontSize: 10, fontFamily: "'Outfit',sans-serif", fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
                }}>
                {t.cancel}
              </button>
              <button onClick={saveReport} disabled={saving}
                style={{
                  padding: '10px 24px', borderRadius: 2, border: 'none',
                  background: th.gold, color: isDark ? '#0a0a0a' : '#fff',
                  cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
                  fontSize: 10, fontFamily: "'Outfit',sans-serif", fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
                  transition: 'opacity 0.15s ease',
                }}>
                {saving ? '...' : t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlide { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
