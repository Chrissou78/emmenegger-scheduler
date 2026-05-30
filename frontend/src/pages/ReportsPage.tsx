// frontend/src/pages/ReportsPage.tsx
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTheme } from '../contexts/themeContext';
import { themes, ABS } from '../i18n/translations';
import { format } from 'date-fns';
import { useAuthStore } from '../contexts/authStore';
import { supabase } from '../lib/supabaseClient';
import { resolvePermissions, type Role, type Permission } from '../../../shared/constants/roles';
import { getTranslations, type LangCode } from '../i18n';

const API = import.meta.env.VITE_API_URL || '';

/* ─── Types ─── */

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
  color: string;
  schedule_type: string;
  status?: string;
  customer_id?: string;
  customer?: { id: string; name: string; city?: string } | null;
}

interface Customer {
  id: string;
  name: string;
  company_name?: string;
  city?: string;
}

interface Machine {
  id: string;
  name: string;
  category: string;
  inventory_nr?: string;
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
  job: Job;
  taskName: string;
  taskColor: string;
  customerName: string | null;
  dayIndex: number;
  date: string;
  existingReport: TimeReport | null;
}

/* ─── Helpers ─── */

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
  return h + (m || 0) / 60;
}

function hoursToDisplay(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

/* ─── Color palette (for tasks without explicit color) ─── */
const PALETTE = [
  '#B8860B','#4A6741','#5B6E82','#7D4E57','#8E6F3E','#4A4063','#704241','#3B4F64',
  '#6B8E23','#8B4513','#556B2F','#483D8B','#2F4F4F','#8B0000','#006400','#4682B4',
];
function hashColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

/* ─── Component ─── */

export function ReportsPage() {
  const { isDark, lang } = useTheme();
  const th = isDark ? themes.dark : themes.light;
  const t = getTranslations(lang as LangCode);
  const { user, token } = useAuthStore();

  /* ── Permissions ── */
  const perms = useMemo(() => {
    const role: Role = (user?.role as Role) || 'EMPLOYEE';
    return resolvePermissions(role, user?.custom_permissions);
  }, [user]);
  const canView = perms.has('reports.own' as Permission);

  /* ── Auth headers ── */
  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  const authHeadersSimple = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  /* ── State ── */
  const [weekOff, setWeekOff] = useState(0);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [myAbsences, setMyAbsences] = useState<Record<number, AbsenceRecord[]>>({});
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
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dates = getWeekDates(weekOff);
  const kw = getKW(dates[0]);
  const year = dates[0].getFullYear();

  const showToast = useCallback((msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }, []);

  /* ── Derived ── */
  const matchingWeeks = useMemo(
    () => weeks.filter(w => w.week_number === kw && w.year === year),
    [weeks, kw, year]
  );
  const weekIds = useMemo(() => new Set(matchingWeeks.map(w => w.id)), [matchingWeeks]);

  const customerById = useMemo(() => {
    const m: Record<string, Customer> = {};
    customers.forEach(c => { m[c.id] = c; });
    return m;
  }, [customers]);

  /* ── Task color helper ── */
  const getTaskColor = useCallback((task?: Task | null, taskId?: string) => {
    if (task?.color && task.color !== '#8B7355') return task.color;
    return hashColor(taskId || task?.id || '');
  }, []);

  /* ── Resolve customer name from a job ── */
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
    if (job.task?.customer_id) {
      const c = customerById[job.task.customer_id];
      if (c?.name) return c.name;
    }
    return null;
  }, [customerById]);

  /* ── Build my day → jobs map ── */
  const myDayJobs = useMemo(() => {
    const m: Record<number, Job[]> = {};
    if (!user) return m;
    jobs.forEach(j => {
      if (j.user_id !== user.id) return;
      if (!weekIds.has(j.week_id)) return;
      if (!m[j.day_of_week]) m[j.day_of_week] = [];
      m[j.day_of_week].push(j);
    });
    // Sort by time_slot
    Object.values(m).forEach(arr => arr.sort((a, b) => a.time_slot - b.time_slot));
    return m;
  }, [jobs, user, weekIds]);

  /* ── Stats ── */
  const totalJobs = useMemo(
    () => Object.values(myDayJobs).reduce((s, arr) => s + arr.length, 0),
    [myDayJobs]
  );
  const totalAbs = useMemo(
    () => Object.values(myAbsences).reduce((s, arr) => s + arr.length, 0),
    [myAbsences]
  );
  const totalReported = useMemo(
    () => reports.filter(r => r.user_id === user?.id).length,
    [reports, user]
  );

  /* ── Data fetching ── */

  useEffect(() => {
    if (!token) return;
    const fetchWeeks = async () => {
      try {
        const resp = await fetch(`${API}/api/v1/weeks`, { headers: authHeadersSimple });
        const data = await resp.json();
        setWeeks(Array.isArray(data.data) ? data.data : []);
      } catch (err) {
        console.error('Error fetching weeks:', err);
      }
    };
    const fetchCustomers = async () => {
      try {
        const resp = await fetch(`${API}/api/v1/customers?limit=200`, { headers: authHeadersSimple });
        const data = await resp.json();
        setCustomers(Array.isArray(data) ? data : data.data || []);
      } catch {}
    };
    fetchWeeks();
    fetchCustomers();
  }, [token, authHeadersSimple]);

  useEffect(() => {
    if (!user || !token || weeks.length === 0) return;

    const fetchMyData = async () => {
      setLoading(true);

      // ── Fetch jobs from all matching weeks (GARTEN + UNTERHALT) ──
      const allJobs: Job[] = [];
      for (const w of matchingWeeks) {
        try {
          const resp = await fetch(`${API}/api/v1/jobs?weekId=${w.id}`, { headers: authHeadersSimple });
          if (!resp.ok) continue;
          const data = await resp.json();
          if (Array.isArray(data.data)) allJobs.push(...data.data);
        } catch (err) {
          console.error('Error fetching jobs:', err);
        }
      }
      setJobs(allJobs);

      // ── Fetch absences for the week ──
      const absences: Record<number, AbsenceRecord[]> = {};
      const startDate = format(dates[0], 'yyyy-MM-dd');
      const endDate = format(dates[5], 'yyyy-MM-dd');
      try {
        const resp = await fetch(
          `${API}/api/v1/absences?startDate=${startDate}&endDate=${endDate}`,
          { headers: authHeadersSimple }
        );
        const data = await resp.json();
        const absList: AbsenceRecord[] = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
        absList.forEach(abs => {
          if (abs.user_id !== user.id) return;
          const absDate = new Date(abs.date + 'T00:00:00');
          const dayIndex = dates.findIndex(
            d => d.getFullYear() === absDate.getFullYear() &&
                d.getMonth() === absDate.getMonth() &&
                d.getDate() === absDate.getDate()
          );
          if (dayIndex === -1) return;
          if (!absences[dayIndex]) absences[dayIndex] = [];
          absences[dayIndex].push(abs);
        });
      } catch (err) {
        console.error('Error fetching absences:', err);
      }
      setMyAbsences(absences);

      // ── Fetch time reports for the week ──
      try {
        const resp = await fetch(
          `${API}/api/v1/reports?startDate=${startDate}&endDate=${endDate}`,
          { headers: authHeadersSimple }
        );
        const data = await resp.json();
        setReports(Array.isArray(data.data) ? data.data : []);
      } catch (err) {
        console.error('Error fetching reports:', err);
      }

      setLoading(false);
    };

    fetchMyData();
  }, [weekOff, weeks, user, token, authHeadersSimple]);

  useEffect(() => {
    if (toast) {
      const tm = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(tm);
    }
  }, [toast]);

  /* ── Report helpers ── */

  const getReportForJob = useCallback((job: Job, dayIndex: number): TimeReport | null => {
    const dateStr = format(dates[dayIndex], 'yyyy-MM-dd');
    return reports.find(r =>
      r.task_id === job.task_id &&
      r.date === dateStr &&
      r.user_id === (user?.id || '')
    ) || null;
  }, [dates, reports, user]);

  const openReportModal = useCallback((job: Job, dayIndex: number) => {
    const dateStr = format(dates[dayIndex], 'yyyy-MM-dd');
    const existing = reports.find(r =>
      r.task_id === job.task_id &&
      r.date === dateStr &&
      r.user_id === (user?.id || '')
    ) || null;

    const task = job.task;
    const color = getTaskColor(task, job.task_id);
    const customerName = resolveCustomerName(job);

    setModal({
      job,
      taskName: task?.name || task?.code || '?',
      taskColor: color,
      customerName,
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
    setFormErrors([]);
  }, [dates, reports, user, getTaskColor, resolveCustomerName]);

  const computeActualHours = (): number => {
    const start = timeToHours(formStartTime);
    const end = timeToHours(formEndTime);
    return Math.max(0, Math.round((end - start) * 100) / 100);
  };

  /* ── Validation ── */
  const validateForm = (): string[] => {
    const errors: string[] = [];
    const start = timeToHours(formStartTime);
    const end = timeToHours(formEndTime);
    const planned = parseFloat(formPlannedHours);

    if (end <= start) {
      errors.push(t.validationEndAfterStart ?? 'End time must be after start time');
    }
    if (end - start > 16) {
      errors.push(t.validationMaxHours ?? 'Work duration cannot exceed 16 hours');
    }
    if (isNaN(planned) || planned < 0) {
      errors.push(t.validationPlannedPositive ?? 'Planned hours must be a positive number');
    }
    if (planned > 24) {
      errors.push(t.validationPlannedMax ?? 'Planned hours cannot exceed 24');
    }
    if (!formStatus) {
      errors.push(t.validationStatusRequired ?? 'Status is required');
    }

    return errors;
  };

  /* ── Photo upload ── */

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
      console.error('Photo upload error:', err);
      showToast(t.uploadFailed ?? 'Upload failed', 'err');
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = useCallback((url: string) => {
    setFormPhotos(prev => prev.filter(p => p !== url));
  }, []);

  /* ── Save report ── */

  const saveReport = async () => {
    if (!modal || !user || !canView) return;

    const errors = validateForm();
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors([]);
    setSaving(true);

    const actualHours = computeActualHours();
    const payload = {
      taskId: modal.job.task_id,
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
        resp = await fetch(`${API}/api/v1/reports/${modal.existingReport.id}`, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify(payload),
        });
      } else {
        resp = await fetch(`${API}/api/v1/reports`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload),
        });
      }

      if (resp.ok) {
        const result = await resp.json();
        if (modal.existingReport) {
          setReports(prev => prev.map(r => r.id === modal.existingReport!.id ? result.data : r));
          showToast(t.updated ?? 'Updated', 'ok');
        } else {
          setReports(prev => [...prev, result.data]);
          showToast(t.saved ?? 'Saved', 'ok');
        }
        setModal(null);
      } else {
        const err = await resp.json();
        showToast(`${t.error ?? 'Error'}: ${err.message || err.error || ''}`, 'err');
      }
    } catch (err) {
      console.error('Error saving report:', err);
      showToast(t.error ?? 'Error', 'err');
    }
    setSaving(false);
  };

  /* ── Status helpers ── */

  const statusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '#4A6741';
      case 'PARTIAL': return '#B8860B';
      case 'NOT_DONE': return '#8B4513';
      case 'ADDED': return '#5B6E82';
      case 'PLANNED': return '#483D8B';
      default: return th.textDim;
    }
  };

  const statusLabel = (status: string): string => {
    const statusMap = (t as any).status;
    if (statusMap && typeof statusMap === 'object' && statusMap[status]) return statusMap[status];
    return status;
  };

  /* ── Access guard ── */
  if (!canView) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 60, textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 300, color: th.gold, letterSpacing: 1 }}>
          {t.accessDenied ?? 'Access Denied'}
        </h2>
      </div>
    );
  }

  /* ═══════════════════════════════════════ RENDER ═══════════════════════════════════════ */

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 1000,
          background: toast.type === 'err' ? th.toastErrBg : th.toastBg,
          color: toast.type === 'err' ? th.toastErrText : th.toastText,
          padding: '12px 20px', borderRadius: 2, fontSize: 12,
          fontFamily: "'Outfit',sans-serif", fontWeight: 500,
          border: `1px solid ${toast.type === 'err' ? th.toastErrBorder : th.toastBorder}`,
          backdropFilter: 'blur(20px)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          animation: 'fadeSlide 0.35s cubic-bezier(0.16,1,0.3,1)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 28, fontWeight: 300, color: th.gold, letterSpacing: 1 }}>
          {t.greeting ?? 'Hello'}, {user?.first_name || 'User'}
        </div>
        <div style={{ fontSize: 11, color: th.textDim, fontFamily: "'Outfit',sans-serif", fontWeight: 400, letterSpacing: 0.5, marginTop: 4 }}>
          {t.yourWeek ?? 'Your week at a glance'}
        </div>
      </div>

      {/* Week nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setWeekOff(w => w - 1)} style={{
            width: 36, height: 36, borderRadius: 2, border: `1px solid ${th.goldFaint}`,
            background: 'transparent', color: th.gold, cursor: 'pointer', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = th.switchActive; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>‹</button>

          <div style={{ textAlign: 'center', minWidth: 140 }}>
            <div style={{ fontSize: 36, fontWeight: 300, color: th.gold, lineHeight: 1, letterSpacing: 1 }}>
              {t.kw ?? 'KW'} {kw}
            </div>
            <div style={{ fontSize: 11, color: th.textDim, marginTop: 4, fontFamily: "'Outfit',sans-serif", fontWeight: 400, letterSpacing: 0.5 }}>
              {fmtDate(dates[0])} — {fmtDate(dates[5])} {year}
            </div>
          </div>

          <button onClick={() => setWeekOff(w => w + 1)} style={{
            width: 36, height: 36, borderRadius: 2, border: `1px solid ${th.goldFaint}`,
            background: 'transparent', color: th.gold, cursor: 'pointer', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = th.switchActive; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>›</button>

          <button onClick={() => setWeekOff(0)} style={{
            padding: '8px 14px', borderRadius: 2, border: 'none', background: th.switchActive,
            color: th.gold, cursor: 'pointer', fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
            textTransform: 'uppercase', fontFamily: "'Outfit',sans-serif",
          }}>
            {t.today ?? 'Today'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 300, color: th.gold, lineHeight: 1 }}>{totalJobs}</div>
            <div style={{ fontSize: 8, color: th.textGhost, marginTop: 3, fontFamily: "'Outfit',sans-serif", fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
              {t.jobs ?? 'Jobs'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 300, color: '#42a5f5', lineHeight: 1 }}>{totalReported}</div>
            <div style={{ fontSize: 8, color: th.textGhost, marginTop: 3, fontFamily: "'Outfit',sans-serif", fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
              {t.reported ?? 'Reported'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 300, color: '#7D4E57', lineHeight: 1 }}>{totalAbs}</div>
            <div style={{ fontSize: 8, color: th.textGhost, marginTop: 3, fontFamily: "'Outfit',sans-serif", fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
              {t.absences ?? 'Absences'}
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: th.textDim, fontFamily: "'Outfit',sans-serif", fontSize: 12 }}>
          {t.loading ?? 'Loading...'}
        </div>
      )}

      {/* Day cards */}
      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {dates.map((date, di) => {
            const dayJobs = myDayJobs[di] || [];
            const dayAbs = myAbsences[di] || [];
            const hasContent = dayJobs.length > 0 || dayAbs.length > 0;
            const isTodayDay = isToday(date);

            // Count how many jobs have reports
            const dayReportedCount = dayJobs.filter(j => getReportForJob(j, di)).length;

            return (
              <div key={di} style={{
                background: th.bgCard, borderRadius: 2,
                border: `1px solid ${isTodayDay ? th.gold : th.border}`,
                overflow: 'hidden',
                boxShadow: isTodayDay
                  ? (isDark ? '0 0 12px rgba(0,229,160,0.15)' : '0 0 12px rgba(5,150,105,0.1)')
                  : 'none',
              }}>
                {/* Day header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px',
                  background: isTodayDay ? th.goldGhost : 'transparent',
                  borderBottom: hasContent ? `1px solid ${th.borderFaint}` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 2,
                      background: isTodayDay ? th.gold : th.switchBg,
                      color: isTodayDay ? (isDark ? '#0a0a0a' : '#fff') : th.textDim,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif",
                    }}>
                      {date.getDate()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 400, color: isTodayDay ? th.gold : th.text, letterSpacing: 0.3 }}>
                        {(t.days as string[])?.[di] ?? ['Mo','Di','Mi','Do','Fr','Sa'][di]}
                      </div>
                      <div style={{ fontSize: 9, color: th.textDim, fontFamily: "'Outfit',sans-serif", fontWeight: 400 }}>
                        {fmtDate(date)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {dayJobs.length > 0 && (
                      <span style={{
                        fontSize: 9, fontWeight: 600, color: th.textDim,
                        fontFamily: "'Outfit',sans-serif",
                      }}>
                        {dayReportedCount}/{dayJobs.length} {t.reported ?? 'reported'}
                      </span>
                    )}
                    {isTodayDay && (
                      <div style={{
                        fontSize: 8, color: th.gold, fontFamily: "'Outfit',sans-serif",
                        fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase',
                        background: th.switchActive, padding: '4px 10px', borderRadius: 2,
                      }}>
                        {t.today ?? 'Today'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                {hasContent ? (
                  <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>

                    {/* Absences */}
                    {dayAbs.map((abs, idx) => {
                      const code = String(abs.absence_code);
                      const absInfo = ABS[code as unknown as keyof typeof ABS];
                      return (
                        <div key={`abs-${abs.id || idx}`} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', background: absInfo?.bg || '#666',
                          color: isDark ? (absInfo as any)?.textD || '#fff' : (absInfo as any)?.textL || '#fff',
                          borderRadius: 2, fontSize: 12, fontWeight: 600, fontFamily: "'Outfit',sans-serif",
                        }}>
                          <span style={{ fontSize: 16 }}>{absInfo?.icon || '●'}</span>
                          <span>{(t.abs as any)?.[code] ?? `Absence ${code}`}</span>
                        </div>
                      );
                    })}

                    {/* Jobs (clickable for time reporting) */}
                    {dayJobs.map((job, idx) => {
                      const task = job.task;
                      const color = getTaskColor(task, job.task_id);
                      const customerName = resolveCustomerName(job);
                      const machines = job.machines || [];
                      const report = getReportForJob(job, di);
                      const hasReport = !!report;

                      return (
                        <div
                          key={job.id}
                          onClick={() => openReportModal(job, di)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 14px',
                            background: isDark ? `${color}28` : `${color}18`,
                            borderLeft: `4px solid ${color}`,
                            borderRadius: 2, cursor: 'pointer',
                            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                            position: 'relative',
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.transform = 'translateX(3px)';
                            (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
                            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                          }}
                        >
                          {/* Color dot */}
                          <div style={{
                            width: 32, height: 32, borderRadius: 4, flexShrink: 0,
                            background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: '#fff',
                          }}>
                            {(task?.code || '?').slice(0, 3).toUpperCase()}
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{
                              fontSize: 13, fontWeight: 600, color: isDark ? '#ddd' : '#333',
                              fontFamily: "'Outfit',sans-serif",
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {task?.name || task?.code || '?'}
                            </div>

                            {/* Customer */}
                            {customerName && (
                              <div style={{
                                fontSize: 10, fontWeight: 500,
                                color: isDark ? 'rgba(0,229,160,.6)' : 'rgba(5,150,105,.7)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                marginTop: 1,
                              }}>&#x1F3E2; {customerName}</div>
                            )}

                            {/* Machines */}
                            {machines.length > 0 && (
                              <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                                {machines.slice(0, 3).map(m => (
                                  <span key={m.id} style={{
                                    fontSize: 8, fontWeight: 600, padding: '1px 4px', borderRadius: 2,
                                    background: isDark ? 'rgba(66,165,245,.15)' : 'rgba(66,165,245,.1)',
                                    color: '#42a5f5',
                                  }}>&#x1F69C; {m.machine?.name?.slice(0, 10) || '?'}</span>
                                ))}
                                {machines.length > 3 && (
                                  <span style={{ fontSize: 8, color: '#42a5f5' }}>+{machines.length - 3}</span>
                                )}
                              </div>
                            )}

                            {/* Report status line */}
                            <div style={{
                              fontSize: 9, opacity: 0.7, fontFamily: "'Outfit',sans-serif",
                              fontWeight: 400, marginTop: 2, color: isDark ? '#aaa' : '#666',
                            }}>
                              {hasReport
                                ? `${t.reported ?? 'Reported'} · ${hoursToDisplay(report!.actual_hours || 0)} · ${statusLabel(report!.status)}`
                                : (t.clickToReport ?? 'Click to report time')
                              }
                            </div>
                          </div>

                          {/* Report status indicator */}
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: hasReport ? statusColor(report!.status) : 'transparent',
                            border: hasReport ? 'none' : `1px dashed ${th.textDim}`,
                            flexShrink: 0,
                          }} title={hasReport ? (t.reported ?? 'Reported') : (t.notReported ?? 'Not reported')} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{
                    padding: '12px 16px', color: th.textDim, fontSize: 11,
                    fontFamily: "'Outfit',sans-serif", fontWeight: 400, fontStyle: 'italic',
                  }}>
                    {t.free ?? 'Free'}
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
          style={{
            position: 'fixed', inset: 0, background: th.modalBg,
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 500, animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setModal(null)}
        >
          <div
            style={{
              background: th.modalCard, border: `1px solid ${th.border}`,
              borderRadius: 2, padding: 0, width: 440, maxHeight: '90vh', overflow: 'auto',
              boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.5)' : '0 16px 48px rgba(0,0,0,0.1)',
              animation: 'scaleIn 0.25s cubic-bezier(0.16,1,0.3,1)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${th.borderFaint}` }}>
              <div style={{
                fontSize: 8, color: th.goldDim, fontFamily: "'Outfit',sans-serif",
                fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6,
              }}>
                {t.reportTime ?? 'Report Time'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 4, flexShrink: 0,
                  background: modal.taskColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff',
                }}>
                  {(modal.job.task?.code || '?').slice(0, 3).toUpperCase()}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 16, fontWeight: 400, color: th.gold }}>
                    {modal.taskName}
                  </div>
                  <div style={{ fontSize: 10, color: th.textDim, fontFamily: "'Outfit',sans-serif" }}>
                    {(t.days as string[])?.[modal.dayIndex] ?? ''}, {fmtDate(dates[modal.dayIndex])}
                    {modal.customerName ? ` · ${modal.customerName}` : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Validation errors */}
            {formErrors.length > 0 && (
              <div style={{
                margin: '12px 24px 0', padding: '10px 14px', borderRadius: 2,
                background: isDark ? 'rgba(248,113,113,.1)' : 'rgba(220,38,38,.06)',
                border: `1px solid ${isDark ? 'rgba(248,113,113,.2)' : 'rgba(220,38,38,.15)'}`,
              }}>
                {formErrors.map((err, i) => (
                  <div key={i} style={{
                    fontSize: 11, color: isDark ? '#f87171' : '#dc2626',
                    fontFamily: "'Outfit',sans-serif", fontWeight: 500,
                    lineHeight: 1.6,
                  }}>⚠ {err}</div>
                ))}
              </div>
            )}

            {/* Form */}
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Time inputs */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{
                    fontSize: 9, color: th.goldDim, fontFamily: "'Outfit',sans-serif",
                    fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6,
                  }}>
                    {t.startTime ?? 'Start Time'}
                  </label>
                  <input type="time" value={formStartTime}
                    onChange={e => { setFormStartTime(e.target.value); setFormErrors([]); }}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 2,
                      border: `1px solid ${th.border}`, background: th.btnBg,
                      color: th.text, fontSize: 14, fontFamily: "'Outfit',sans-serif", outline: 'none',
                      boxSizing: 'border-box',
                    }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{
                    fontSize: 9, color: th.goldDim, fontFamily: "'Outfit',sans-serif",
                    fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6,
                  }}>
                    {t.endTime ?? 'End Time'}
                  </label>
                  <input type="time" value={formEndTime}
                    onChange={e => { setFormEndTime(e.target.value); setFormErrors([]); }}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 2,
                      border: `1px solid ${timeToHours(formEndTime) <= timeToHours(formStartTime) ? (isDark ? '#f87171' : '#dc2626') : th.border}`,
                      background: th.btnBg, color: th.text, fontSize: 14,
                      fontFamily: "'Outfit',sans-serif", outline: 'none',
                      boxSizing: 'border-box',
                    }} />
                </div>
              </div>

              {/* Hours summary */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{
                  flex: 1, padding: '10px 12px', background: th.goldGhost,
                  borderRadius: 2, textAlign: 'center',
                }}>
                  <div style={{
                    fontSize: 8, color: th.goldDim, fontFamily: "'Outfit',sans-serif",
                    fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4,
                  }}>{t.actualHours ?? 'Actual Hours'}</div>
                  <div style={{
                    fontSize: 20, fontWeight: 300,
                    color: computeActualHours() > 0 ? th.gold : (isDark ? '#f87171' : '#dc2626'),
                  }}>
                    {computeActualHours() > 0 ? hoursToDisplay(computeActualHours()) : '—'}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{
                    fontSize: 9, color: th.goldDim, fontFamily: "'Outfit',sans-serif",
                    fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6,
                  }}>
                    {t.plannedHours ?? 'Planned Hours'}
                  </label>
                  <input type="number" min="0" max="24" step="0.5" value={formPlannedHours}
                    onChange={e => { setFormPlannedHours(e.target.value); setFormErrors([]); }}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 2,
                      border: `1px solid ${th.border}`, background: th.btnBg,
                      color: th.text, fontSize: 14, fontFamily: "'Outfit',sans-serif", outline: 'none',
                      boxSizing: 'border-box',
                    }} />
                </div>
              </div>

              {/* Status */}
              <div>
                <label style={{
                  fontSize: 9, color: th.goldDim, fontFamily: "'Outfit',sans-serif",
                  fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6,
                }}>
                  Status
                </label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['COMPLETED', 'PARTIAL', 'NOT_DONE', 'ADDED'].map(s => (
                    <button key={s} onClick={() => { setFormStatus(s); setFormErrors([]); }}
                      style={{
                        padding: '6px 12px', borderRadius: 2, border: 'none', cursor: 'pointer',
                        background: formStatus === s ? statusColor(s) : th.btnBg,
                        color: formStatus === s ? '#fff' : th.textMuted,
                        fontSize: 10, fontWeight: 600, fontFamily: "'Outfit',sans-serif",
                        transition: 'all 0.15s ease',
                      }}>
                      {statusLabel(s)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{
                  fontSize: 9, color: th.goldDim, fontFamily: "'Outfit',sans-serif",
                  fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6,
                }}>
                  {t.description ?? 'Description'}
                </label>
                <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)}
                  rows={3} placeholder={t.descriptionPlaceholder ?? 'What was done...'}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 2,
                    border: `1px solid ${th.border}`, background: th.btnBg,
                    color: th.text, fontSize: 12, fontFamily: "'Outfit',sans-serif", outline: 'none',
                    resize: 'vertical', boxSizing: 'border-box',
                  }} />
              </div>

              {/* Notes */}
              <div>
                <label style={{
                  fontSize: 9, color: th.goldDim, fontFamily: "'Outfit',sans-serif",
                  fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6,
                }}>
                  {t.notes ?? 'Notes'}
                </label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)}
                  rows={2} placeholder={t.notesPlaceholder ?? 'Additional notes...'}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 2,
                    border: `1px solid ${th.border}`, background: th.btnBg,
                    color: th.text, fontSize: 12, fontFamily: "'Outfit',sans-serif", outline: 'none',
                    resize: 'vertical', boxSizing: 'border-box',
                  }} />
              </div>

              {/* Photos */}
              <div>
                <label style={{
                  fontSize: 9, color: th.goldDim, fontFamily: "'Outfit',sans-serif",
                  fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6,
                }}>
                  {t.photos ?? 'Photos'}
                </label>

                {formPhotos.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
                    {formPhotos.map((url, idx) => (
                      <div key={idx} style={{
                        position: 'relative', aspectRatio: '1', borderRadius: 2,
                        overflow: 'hidden', border: `1px solid ${th.borderFaint}`,
                      }}>
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button onClick={() => removePhoto(url)} title={t.removePhoto ?? 'Remove'}
                          style={{
                            position: 'absolute', top: 4, right: 4, width: 20, height: 20,
                            borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff',
                            border: 'none', cursor: 'pointer', fontSize: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>×</button>
                      </div>
                    ))}
                  </div>
                )}

                <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoUpload} style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 2,
                    border: `1px dashed ${th.border}`, background: 'transparent',
                    color: th.textDim, cursor: uploading ? 'wait' : 'pointer',
                    fontSize: 11, fontFamily: "'Outfit',sans-serif", fontWeight: 500,
                    transition: 'all 0.15s ease', boxSizing: 'border-box',
                  }}
                  onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLButtonElement).style.borderColor = th.gold; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = th.border; }}
                >
                  {uploading ? (t.uploadingPhoto ?? 'Uploading...') : `+ ${t.addPhoto ?? 'Add photo'}`}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px', borderTop: `1px solid ${th.borderFaint}`,
              display: 'flex', gap: 8, justifyContent: 'flex-end',
            }}>
              <button onClick={() => setModal(null)}
                style={{
                  padding: '10px 20px', borderRadius: 2, border: `1px solid ${th.borderFaint}`,
                  background: 'transparent', color: th.textDim, cursor: 'pointer',
                  fontSize: 10, fontFamily: "'Outfit',sans-serif", fontWeight: 600,
                  letterSpacing: 1, textTransform: 'uppercase',
                }}>
                {t.cancel ?? 'Cancel'}
              </button>
              <button onClick={saveReport} disabled={saving}
                style={{
                  padding: '10px 24px', borderRadius: 2, border: 'none',
                  background: th.gold, color: isDark ? '#0a0a0a' : '#fff',
                  cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
                  fontSize: 10, fontFamily: "'Outfit',sans-serif", fontWeight: 600,
                  letterSpacing: 1, textTransform: 'uppercase',
                  transition: 'opacity 0.15s ease',
                }}>
                {saving ? '...' : (modal.existingReport ? (t.update ?? 'Update') : (t.save ?? 'Save'))}
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
