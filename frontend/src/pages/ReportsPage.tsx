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

/* ═══════════════════════════════════ TYPES ═══════════════════════════════════ */

interface Week {
  id: string; week_number: number; year: number; schedule_type: string; status: string;
}
interface Task {
  id: string; code: string; name: string; color: string; schedule_type: string;
  status?: string; customer_id?: string;
  customer?: { id: string; name: string; city?: string } | null;
}
interface Customer {
  id: string; name: string; company_name?: string; city?: string;
  street?: string; postal_code?: string; email?: string;
  contact_name?: string; contact_phone?: string;
}
interface Machine { id: string; name: string; category: string; inventory_nr?: string; }
interface JobMachine { id: string; machine_id: string; machine?: Machine; }
interface Job {
  id: string; week_id: string; user_id: string; day_of_week: number; time_slot: number;
  task_id: string; customer_id?: string | null; notes?: string | null;
  task?: Task; machines?: JobMachine[];
}
interface AbsenceRecord { id: string; user_id: string; date: string; absence_code: number; }
interface TimeReport {
  id: string; user_id: string; task_id: string; date: string;
  planned_hours: number | null; actual_hours: number | null; status: string;
  work_description: string | null; notes: string | null; photos: string[];
  submitted_at: string | null;
}

/* ── Quotation line ── */
interface QuoteLine {
  id: string; description: string; quantity: number; unit: string;
  unit_price: number; discount_percent: number; vat_rate: number;
  task_id?: string;
}

/* ── Modal types ── */
type ModalType = 'report' | 'add-job' | 'quotation' | null;
interface ReportModalData {
  job: Job; taskName: string; taskColor: string; customerName: string | null;
  dayIndex: number; date: string; existingReport: TimeReport | null;
}
interface AddJobModalData { dayIndex: number; date: string; }
interface QuotationModalData {
  job: Job; taskName: string; customerName: string | null; customer: Customer | null;
  dayIndex: number; date: string;
}

/* ═══════════════════════════════════ HELPERS ═══════════════════════════════════ */

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
function isToday(d: Date) {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
function timeToHours(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h + (m || 0) / 60;
}
function hoursToDisplay(h: number): string {
  const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}
function makeId(): string { return Math.random().toString(36).slice(2, 10); }
function formatChf(v: number): string {
  return (v || 0).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const PALETTE = [
  '#B8860B','#4A6741','#5B6E82','#7D4E57','#8E6F3E','#4A4063','#704241','#3B4F64',
  '#6B8E23','#8B4513','#556B2F','#483D8B','#2F4F4F','#8B0000','#006400','#4682B4',
];
function hashColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

const UNIT_OPTIONS = ['Std', 'Stk', 'm²', 'm³', 'Pauschale', 'Tage', 'lfm', 'kg'];

/* ═══════════════════════════════════ SIGNATURE PAD ═══════════════════════════════════ */

function SignaturePad({
  onSave, onClear, isDark, th,
}: {
  onSave: (dataUrl: string) => void; onClear: () => void;
  isDark: boolean; th: Record<string, any>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !lastPos.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = isDark ? '#d0d4e0' : '#1a1d2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => {
    isDrawing.current = false;
    lastPos.current = null;
    if (canvasRef.current) {
      onSave(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clear = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    onClear();
  };

  return (
    <div>
      <div style={{
        border: `1px solid ${th.border}`, borderRadius: 4, overflow: 'hidden',
        background: isDark ? '#0f1117' : '#fff', position: 'relative',
      }}>
        <canvas
          ref={canvasRef}
          width={380}
          height={160}
          style={{ display: 'block', width: '100%', height: 160, cursor: 'crosshair', touchAction: 'none' }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
        />
        <div style={{
          position: 'absolute', bottom: 30, left: 20, right: 20,
          borderBottom: `1px dashed ${isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)'}`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: 8, left: 20, fontSize: 8, color: th.textGhost,
          fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', pointerEvents: 'none',
        }}>Signature</div>
      </div>
      <button onClick={clear} style={{
        marginTop: 6, padding: '4px 10px', borderRadius: 3, border: `1px solid ${th.border}`,
        background: 'transparent', color: th.textDim, cursor: 'pointer', fontSize: 10, fontWeight: 600,
      }}>
        ✕ Clear
      </button>
    </div>
  );
}

/* ═══════════════════════════════════ COMPONENT ═══════════════════════════════════ */

export function ReportsPage() {
  const { isDark, lang } = useTheme();
  const th = isDark ? themes.dark : themes.light;
  const t = getTranslations(lang as LangCode);
  const { user, token } = useAuthStore();

  const perms = useMemo(() => {
    const role: Role = (user?.role as Role) || 'EMPLOYEE';
    return resolvePermissions(role, user?.custom_permissions);
  }, [user]);
  const canView = perms.has('reports.own' as Permission);

  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json', Authorization: `Bearer ${token}`,
  }), [token]);
  const authHeadersSimple = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  /* ── State ── */
  const [weekOff, setWeekOff] = useState(0);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [myAbsences, setMyAbsences] = useState<Record<number, AbsenceRecord[]>>({});
  const [reports, setReports] = useState<TimeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  /* ── Modal state ── */
  const [modalType, setModalType] = useState<ModalType>(null);
  const [reportData, setReportData] = useState<ReportModalData | null>(null);
  const [addJobData, setAddJobData] = useState<AddJobModalData | null>(null);
  const [quoteData, setQuoteData] = useState<QuotationModalData | null>(null);

  /* ── Report form ── */
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

  /* ── Add-job form ── */
  const [jobTaskSearch, setJobTaskSearch] = useState('');
  const [jobSelectedTask, setJobSelectedTask] = useState<Task | null>(null);
  const [jobMachineIds, setJobMachineIds] = useState<string[]>([]);
  const [jobNotes, setJobNotes] = useState('');
  const [jobSaving, setJobSaving] = useState(false);

  /* ── Quotation form ── */
  const [quoteTitle, setQuoteTitle] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [quoteSignature, setQuoteSignature] = useState<string | null>(null);
  const [quoteSaving, setQuoteSaving] = useState(false);

  const dates = getWeekDates(weekOff);
  const kw = getKW(dates[0]);
  const year = dates[0].getFullYear();

  const showToast = useCallback((msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 2800);
  }, []);

  /* ── Derived ── */
  const matchingWeeks = useMemo(() => weeks.filter(w => w.week_number === kw && w.year === year), [weeks, kw, year]);
  const weekIds = useMemo(() => new Set(matchingWeeks.map(w => w.id)), [matchingWeeks]);

  const customerById = useMemo(() => {
    const m: Record<string, Customer> = {};
    customers.forEach(c => { m[c.id] = c; }); return m;
  }, [customers]);

  const taskById = useMemo(() => {
    const m: Record<string, Task> = {};
    tasks.forEach(tk => { m[tk.id] = tk; }); return m;
  }, [tasks]);

  const getTaskColor = useCallback((task?: Task | null, taskId?: string) => {
    if (task?.color && task.color !== '#8B7355') return task.color;
    return hashColor(taskId || task?.id || '');
  }, []);

  const resolveCustomerName = useCallback((job: Job): string | null => {
    const rawCust = job.task?.customer;
    const co = (rawCust && !Array.isArray(rawCust)) ? rawCust : (Array.isArray(rawCust) && rawCust.length > 0) ? (rawCust as any)[0] : null;
    if (co?.name) return co.name;
    if (job.customer_id) { const c = customerById[job.customer_id]; if (c?.name) return c.name; }
    if (job.task?.customer_id) { const c = customerById[job.task.customer_id]; if (c?.name) return c.name; }
    return null;
  }, [customerById]);

  const resolveCustomer = useCallback((job: Job): Customer | null => {
    if (job.customer_id && customerById[job.customer_id]) return customerById[job.customer_id];
    if (job.task?.customer_id && customerById[job.task.customer_id]) return customerById[job.task.customer_id];
    return null;
  }, [customerById]);

  const myDayJobs = useMemo(() => {
    const m: Record<number, Job[]> = {};
    if (!user) return m;
    jobs.forEach(j => {
      if (j.user_id !== user.id || !weekIds.has(j.week_id)) return;
      if (!m[j.day_of_week]) m[j.day_of_week] = [];
      m[j.day_of_week].push(j);
    });
    Object.values(m).forEach(arr => arr.sort((a, b) => a.time_slot - b.time_slot));
    return m;
  }, [jobs, user, weekIds]);

  const totalJobs = useMemo(() => Object.values(myDayJobs).reduce((s, arr) => s + arr.length, 0), [myDayJobs]);
  const totalAbs = useMemo(() => Object.values(myAbsences).reduce((s, arr) => s + arr.length, 0), [myAbsences]);
  const totalReported = useMemo(() => reports.filter(r => r.user_id === user?.id).length, [reports, user]);

  /* ── Data fetching ── */
  useEffect(() => {
    if (!token) return;
    (async () => {
      try { const r = await fetch(`${API}/api/v1/weeks`, { headers: authHeadersSimple }); const d = await r.json(); setWeeks(Array.isArray(d.data) ? d.data : []); } catch {}
      try { const r = await fetch(`${API}/api/v1/customers?limit=200`, { headers: authHeadersSimple }); const d = await r.json(); setCustomers(Array.isArray(d) ? d : d.data || []); } catch {}
      try { const r = await fetch(`${API}/api/v1/tasks`, { headers: authHeadersSimple }); const d = await r.json(); setTasks(d.data || []); } catch {}
      try { const r = await fetch(`${API}/api/v1/machines`, { headers: authHeadersSimple }); const d = await r.json(); setMachines(Array.isArray(d) ? d : d.data || []); } catch {}
    })();
  }, [token, authHeadersSimple]);

  useEffect(() => {
    if (!user || !token || weeks.length === 0) return;
    (async () => {
      setLoading(true);
      const allJobs: Job[] = [];
      for (const w of matchingWeeks) {
        try { const r = await fetch(`${API}/api/v1/jobs?weekId=${w.id}`, { headers: authHeadersSimple }); if (!r.ok) continue; const d = await r.json(); if (Array.isArray(d.data)) allJobs.push(...d.data); } catch {}
      }
      setJobs(allJobs);

      const absences: Record<number, AbsenceRecord[]> = {};
      const startDate = format(dates[0], 'yyyy-MM-dd');
      const endDate = format(dates[5], 'yyyy-MM-dd');
      try {
        const r = await fetch(`${API}/api/v1/absences?startDate=${startDate}&endDate=${endDate}`, { headers: authHeadersSimple });
        const d = await r.json(); const list: AbsenceRecord[] = Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : [];
        list.forEach(abs => {
          if (abs.user_id !== user.id) return;
          const absDate = new Date(abs.date + 'T00:00:00');
          const di = dates.findIndex(dd => dd.getFullYear() === absDate.getFullYear() && dd.getMonth() === absDate.getMonth() && dd.getDate() === absDate.getDate());
          if (di === -1) return;
          if (!absences[di]) absences[di] = [];
          absences[di].push(abs);
        });
      } catch {}
      setMyAbsences(absences);

      try {
        const r = await fetch(`${API}/api/v1/reports?startDate=${startDate}&endDate=${endDate}`, { headers: authHeadersSimple });
        const d = await r.json(); setReports(Array.isArray(d.data) ? d.data : []);
      } catch {}
      setLoading(false);
    })();
  }, [weekOff, weeks, user, token, authHeadersSimple]);

  useEffect(() => { if (toast) { const tm = setTimeout(() => setToast(null), 3000); return () => clearTimeout(tm); } }, [toast]);

  const refreshJobs = useCallback(async () => {
    const allJobs: Job[] = [];
    for (const w of matchingWeeks) {
      try { const r = await fetch(`${API}/api/v1/jobs?weekId=${w.id}`, { headers: authHeadersSimple }); if (!r.ok) continue; const d = await r.json(); if (Array.isArray(d.data)) allJobs.push(...d.data); } catch {}
    }
    setJobs(allJobs);
  }, [matchingWeeks, authHeadersSimple]);

  /* ═══════ REPORT LOGIC ═══════ */

  const getReportForJob = useCallback((job: Job, dayIndex: number): TimeReport | null => {
    const dateStr = format(dates[dayIndex], 'yyyy-MM-dd');
    return reports.find(r => r.task_id === job.task_id && r.date === dateStr && r.user_id === (user?.id || '')) || null;
  }, [dates, reports, user]);

  const openReportModal = useCallback((job: Job, dayIndex: number) => {
    const dateStr = format(dates[dayIndex], 'yyyy-MM-dd');
    const existing = reports.find(r => r.task_id === job.task_id && r.date === dateStr && r.user_id === (user?.id || '')) || null;
    setReportData({
      job, taskName: job.task?.name || job.task?.code || '?',
      taskColor: getTaskColor(job.task, job.task_id),
      customerName: resolveCustomerName(job), dayIndex, date: dateStr, existingReport: existing,
    });
    if (existing) {
      const actualH = existing.actual_hours || 0;
      const endH = 7 + actualH; const endHrs = Math.floor(endH); const endMins = Math.round((endH - endHrs) * 60);
      setFormStartTime('07:00');
      setFormEndTime(`${String(endHrs).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`);
      setFormPlannedHours(String(existing.planned_hours || 8));
      setFormDescription(existing.work_description || ''); setFormNotes(existing.notes || '');
      setFormPhotos(existing.photos || []); setFormStatus(existing.status || 'COMPLETED');
    } else {
      setFormStartTime('07:00'); setFormEndTime('16:00'); setFormPlannedHours('8');
      setFormDescription(''); setFormNotes(''); setFormPhotos([]); setFormStatus('COMPLETED');
    }
    setFormErrors([]);
    setModalType('report');
  }, [dates, reports, user, getTaskColor, resolveCustomerName]);

  const computeActualHours = (): number => {
    const start = timeToHours(formStartTime); const end = timeToHours(formEndTime);
    return Math.max(0, Math.round((end - start) * 100) / 100);
  };

  const validateReportForm = (): string[] => {
    const errors: string[] = [];
    const start = timeToHours(formStartTime); const end = timeToHours(formEndTime);
    const planned = parseFloat(formPlannedHours);
    if (end <= start) errors.push(t.validationEndAfterStart ?? 'End time must be after start time');
    if (end - start > 16) errors.push(t.validationMaxHours ?? 'Work duration cannot exceed 16 hours');
    if (isNaN(planned) || planned < 0) errors.push(t.validationPlannedPositive ?? 'Planned hours must be a positive number');
    if (planned > 24) errors.push(t.validationPlannedMax ?? 'Planned hours cannot exceed 24');
    return errors;
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('report-photos').upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('report-photos').getPublicUrl(fileName);
      setFormPhotos(prev => [...prev, urlData.publicUrl]);
    } catch { showToast(t.uploadFailed ?? 'Upload failed', 'err'); }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const saveReport = async () => {
    if (!reportData || !user) return;
    const errors = validateReportForm();
    if (errors.length > 0) { setFormErrors(errors); return; }
    setFormErrors([]); setSaving(true);
    const actualHours = computeActualHours();
    const payload = {
      taskId: reportData.job.task_id, date: reportData.date,
      plannedHours: parseFloat(formPlannedHours) || 8, actualHours, status: formStatus,
      workDescription: formDescription || null, notes: formNotes || null, photos: formPhotos,
    };
    try {
      const resp = reportData.existingReport
        ? await fetch(`${API}/api/v1/reports/${reportData.existingReport.id}`, { method: 'PUT', headers: authHeaders, body: JSON.stringify(payload) })
        : await fetch(`${API}/api/v1/reports`, { method: 'POST', headers: authHeaders, body: JSON.stringify(payload) });
      if (resp.ok) {
        const result = await resp.json();
        if (reportData.existingReport) { setReports(prev => prev.map(r => r.id === reportData.existingReport!.id ? result.data : r)); showToast(t.updated ?? 'Updated', 'ok'); }
        else { setReports(prev => [...prev, result.data]); showToast(t.saved ?? 'Saved', 'ok'); }
        setModalType(null);
      } else { const err = await resp.json(); showToast(`${t.error ?? 'Error'}: ${err.message || err.error || ''}`, 'err'); }
    } catch { showToast(t.error ?? 'Error', 'err'); }
    setSaving(false);
  };

  /* ═══════ ADD JOB LOGIC ═══════ */

  const openAddJobModal = useCallback((dayIndex: number) => {
    setAddJobData({ dayIndex, date: format(dates[dayIndex], 'yyyy-MM-dd') });
    setJobTaskSearch(''); setJobSelectedTask(null); setJobMachineIds([]); setJobNotes('');
    setModalType('add-job');
  }, [dates]);

  const filteredTasks = useMemo(() => {
    if (!jobTaskSearch.trim()) return tasks.filter(tk => tk.status !== 'CANCELLED').slice(0, 30);
    const s = jobTaskSearch.toLowerCase();
    return tasks.filter(tk => tk.status !== 'CANCELLED' && (
      tk.name.toLowerCase().includes(s) || tk.code.toLowerCase().includes(s) ||
      (tk.customer?.name || '').toLowerCase().includes(s)
    )).slice(0, 30);
  }, [tasks, jobTaskSearch]);

  const activeMachines = useMemo(() => machines.filter(m => (m as any).is_active !== false), [machines]);

  const saveJob = async () => {
    if (!addJobData || !jobSelectedTask || !user) return;
    setJobSaving(true);
    const week = matchingWeeks.find(w => w.schedule_type === jobSelectedTask.schedule_type) || matchingWeeks[0];
    if (!week) { showToast(t.weekNotFound ?? 'Week not found', 'err'); setJobSaving(false); return; }
    const existingDayJobs = myDayJobs[addJobData.dayIndex] || [];
    if (existingDayJobs.length >= 2) { showToast(t.maxJobsReached ?? 'Maximum 2 jobs per cell', 'err'); setJobSaving(false); return; }
    try {
      const resp = await fetch(`${API}/api/v1/jobs`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({
          weekId: week.id, userId: user.id, dayOfWeek: addJobData.dayIndex,
          timeSlot: existingDayJobs.length + 1, taskId: jobSelectedTask.id,
          customerId: jobSelectedTask.customer_id || null,
          machineIds: jobMachineIds.length > 0 ? jobMachineIds : undefined,
          notes: jobNotes || null,
        }),
      });
      if (resp.ok) {
        showToast(t.jobAdded ?? 'Job added', 'ok');
        setModalType(null);
        await refreshJobs();
      } else {
        const err = await resp.json();
        showToast(`${t.error ?? 'Error'}: ${err.error || ''}`, 'err');
      }
    } catch { showToast(t.networkError ?? 'Network error', 'err'); }
    setJobSaving(false);
  };

  /* ═══════ QUOTATION LOGIC ═══════ */

  const openQuotationModal = useCallback((job: Job, dayIndex: number) => {
    const customer = resolveCustomer(job);
    setQuoteData({
      job, taskName: job.task?.name || job.task?.code || '?',
      customerName: resolveCustomerName(job), customer,
      dayIndex, date: format(dates[dayIndex], 'yyyy-MM-dd'),
    });
    setQuoteTitle(`${job.task?.name || ''} — ${resolveCustomerName(job) || ''}`);
    setQuoteNotes('');
    setQuoteLines([{
      id: makeId(), description: job.task?.name || '',
      quantity: 1, unit: 'Std', unit_price: 0, discount_percent: 0, vat_rate: 8.1,
      task_id: job.task_id,
    }]);
    setQuoteSignature(null);
    setModalType('quotation');
  }, [dates, resolveCustomer, resolveCustomerName]);

  const updateQuoteLine = (id: string, updates: Partial<QuoteLine>) => {
    setQuoteLines(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };
  const addQuoteLine = () => {
    setQuoteLines(prev => [...prev, { id: makeId(), description: '', quantity: 1, unit: 'Std', unit_price: 0, discount_percent: 0, vat_rate: 8.1 }]);
  };
  const removeQuoteLine = (id: string) => {
    setQuoteLines(prev => { const f = prev.filter(l => l.id !== id); return f.length === 0 ? [{ id: makeId(), description: '', quantity: 1, unit: 'Std', unit_price: 0, discount_percent: 0, vat_rate: 8.1 }] : f; });
  };

  const quoteSubtotal = useMemo(() => quoteLines.reduce((s, l) => {
    const line = (l.quantity || 0) * (l.unit_price || 0) * (1 - (l.discount_percent || 0) / 100);
    return s + Math.round(line * 100) / 100;
  }, 0), [quoteLines]);

  const quoteVat = useMemo(() => quoteLines.reduce((s, l) => {
    const line = (l.quantity || 0) * (l.unit_price || 0) * (1 - (l.discount_percent || 0) / 100);
    return s + Math.round(line * (l.vat_rate || 8.1) / 100 * 100) / 100;
  }, 0), [quoteLines]);

  const quoteTotal = Math.round((quoteSubtotal + quoteVat) * 100) / 100;

  const saveQuotation = async () => {
    if (!quoteData) return;
    if (!quoteData.customer) { showToast(t.noCustomer ?? 'No customer linked to this job', 'err'); return; }
    if (quoteLines.every(l => !l.description.trim())) { showToast(t.addLineItem ?? 'Add at least one line item', 'err'); return; }
    setQuoteSaving(true);
    try {
      const resp = await fetch(`${API}/api/v1/quotations/field`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({
          customer_id: quoteData.customer.id,
          title: quoteTitle || quoteData.taskName,
          description: `Field quotation — ${quoteData.date}`,
          notes: quoteNotes || null,
          job_id: quoteData.job.id,
          signature_data: quoteSignature || null,
          items: quoteLines.filter(l => l.description.trim()).map(l => ({
            description: l.description, quantity: l.quantity, unit: l.unit,
            unit_price: l.unit_price, discount_percent: l.discount_percent,
            vat_rate: l.vat_rate, task_id: l.task_id || null,
          })),
        }),
      });
      if (resp.ok) {
        showToast(quoteSignature ? (t.quotationAccepted ?? 'Quotation created & accepted') : (t.quotationCreated ?? 'Quotation created as draft'), 'ok');
        setModalType(null);
      } else {
        const err = await resp.json();
        showToast(`${t.error ?? 'Error'}: ${err.error || ''}`, 'err');
      }
    } catch { showToast(t.networkError ?? 'Network error', 'err'); }
    setQuoteSaving(false);
  };

  /* ── Status helpers ── */
  const statusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '#4A6741'; case 'PARTIAL': return '#B8860B';
      case 'NOT_DONE': return '#8B4513'; case 'ADDED': return '#5B6E82'; case 'PLANNED': return '#483D8B';
      default: return th.textDim;
    }
  };
  const statusLabel = (s: string): string => (t as any).status?.[s] ?? s;

  /* ── Style constants ── */
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 2, border: `1px solid ${th.border}`,
    background: th.btnBg, color: th.text, fontSize: 14, fontFamily: "'Outfit',sans-serif",
    outline: 'none', boxSizing: 'border-box',
  };

  /* ═══ ACCESS GUARD ═══ */
  if (!canView) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 60, textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 300, color: th.gold, letterSpacing: 1 }}>{t.accessDenied ?? 'Access Denied'}</h2>
      </div>
    );
  }

  /* ═══════════════════════════════════ RENDER ═══════════════════════════════════ */
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 1000,
          background: toast.type === 'err' ? th.toastErrBg : th.toastBg,
          color: toast.type === 'err' ? th.toastErrText : th.toastText,
          padding: '12px 20px', borderRadius: 2, fontSize: 12, fontFamily: "'Outfit',sans-serif", fontWeight: 500,
          border: `1px solid ${toast.type === 'err' ? th.toastErrBorder : th.toastBorder}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)', animation: 'fadeSlide 0.35s cubic-bezier(0.16,1,0.3,1)',
        }}>{toast.msg}</div>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setWeekOff(w => w - 1)} style={{
            width: 36, height: 36, borderRadius: 2, border: `1px solid ${th.goldFaint}`,
            background: 'transparent', color: th.gold, cursor: 'pointer', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>‹</button>
          <div style={{ textAlign: 'center', minWidth: 140 }}>
            <div style={{ fontSize: 36, fontWeight: 300, color: th.gold, lineHeight: 1, letterSpacing: 1 }}>{t.kw ?? 'KW'} {kw}</div>
            <div style={{ fontSize: 11, color: th.textDim, marginTop: 4, fontFamily: "'Outfit',sans-serif", fontWeight: 400, letterSpacing: 0.5 }}>
              {fmtDate(dates[0])} — {fmtDate(dates[5])} {year}
            </div>
          </div>
          <button onClick={() => setWeekOff(w => w + 1)} style={{
            width: 36, height: 36, borderRadius: 2, border: `1px solid ${th.goldFaint}`,
            background: 'transparent', color: th.gold, cursor: 'pointer', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>›</button>
          <button onClick={() => setWeekOff(0)} style={{
            padding: '8px 14px', borderRadius: 2, border: 'none', background: th.switchActive,
            color: th.gold, cursor: 'pointer', fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase',
          }}>{t.today ?? 'Today'}</button>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {[
            { v: totalJobs, l: t.jobs ?? 'Jobs', c: th.gold },
            { v: totalReported, l: t.reported ?? 'Reported', c: '#42a5f5' },
            { v: totalAbs, l: t.absences ?? 'Absences', c: '#7D4E57' },
          ].map(s => (
            <div key={s.l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 300, color: s.c, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 8, color: th.textGhost, marginTop: 3, fontFamily: "'Outfit',sans-serif", fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: th.textDim, fontSize: 12 }}>{t.loading ?? 'Loading...'}</div>}

      {/* ═══ DAY CARDS ═══ */}
      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {dates.map((date, di) => {
            const dayJobs = myDayJobs[di] || [];
            const dayAbs = myAbsences[di] || [];
            const hasContent = dayJobs.length > 0 || dayAbs.length > 0;
            const isTodayDay = isToday(date);
            const dayReportedCount = dayJobs.filter(j => getReportForJob(j, di)).length;
            const canAddJob = dayJobs.length < 2;

            return (
              <div key={di} style={{
                background: th.bgCard, borderRadius: 2,
                border: `1px solid ${isTodayDay ? th.gold : th.border}`, overflow: 'hidden',
                boxShadow: isTodayDay ? (isDark ? '0 0 12px rgba(0,229,160,0.15)' : '0 0 12px rgba(5,150,105,0.1)') : 'none',
              }}>
                {/* Day header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px',
                  background: isTodayDay ? th.goldGhost : 'transparent',
                  borderBottom: hasContent ? `1px solid ${th.borderFaint}` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 2,
                      background: isTodayDay ? th.gold : th.switchBg,
                      color: isTodayDay ? (isDark ? '#0a0a0a' : '#fff') : th.textDim,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 600,
                    }}>{date.getDate()}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 400, color: isTodayDay ? th.gold : th.text }}>{(t.days as string[])?.[di] ?? ''}</div>
                      <div style={{ fontSize: 9, color: th.textDim, fontFamily: "'Outfit',sans-serif" }}>{fmtDate(date)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {dayJobs.length > 0 && (
                      <span style={{ fontSize: 9, fontWeight: 600, color: th.textDim }}>{dayReportedCount}/{dayJobs.length}</span>
                    )}
                    {canAddJob && (
                      <button onClick={() => openAddJobModal(di)} style={{
                        padding: '4px 10px', borderRadius: 3, border: `1px solid ${th.border}`,
                        background: 'transparent', color: th.gold, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                        transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 4,
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = th.switchActive; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        + {t.addJob ?? 'Add Job'}
                      </button>
                    )}
                    {isTodayDay && (
                      <div style={{
                        fontSize: 8, color: th.gold, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase',
                        background: th.switchActive, padding: '4px 10px', borderRadius: 2,
                      }}>{t.today ?? 'Today'}</div>
                    )}
                  </div>
                </div>

                {hasContent ? (
                  <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* Absences */}
                    {dayAbs.map((abs, idx) => {
                      const code = String(abs.absence_code);
                      const absInfo = ABS[code as unknown as keyof typeof ABS];
                      return (
                        <div key={`abs-${abs.id || idx}`} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                          background: absInfo?.bg || '#666',
                          color: isDark ? (absInfo as any)?.textD || '#fff' : (absInfo as any)?.textL || '#fff',
                          borderRadius: 2, fontSize: 12, fontWeight: 600,
                        }}>
                          <span style={{ fontSize: 16 }}>{absInfo?.icon || '●'}</span>
                          <span>{(t.abs as any)?.[code] ?? `Absence ${code}`}</span>
                        </div>
                      );
                    })}

                    {/* Jobs */}
                    {dayJobs.map(job => {
                      const task = job.task; const color = getTaskColor(task, job.task_id);
                      const customerName = resolveCustomerName(job);
                      const jm = job.machines || []; const report = getReportForJob(job, di);
                      const hasCustomer = !!resolveCustomer(job);

                      return (
                        <div key={job.id} style={{
                          background: isDark ? `${color}28` : `${color}18`,
                          borderLeft: `4px solid ${color}`, borderRadius: 2, overflow: 'hidden',
                        }}>
                          {/* Main job row — click for report */}
                          <div
                            onClick={() => openReportModal(job, di)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                              cursor: 'pointer', transition: 'transform .15s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(3px)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(0)'; }}
                          >
                            <div style={{
                              width: 32, height: 32, borderRadius: 4, flexShrink: 0, background: color,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700, color: '#fff',
                            }}>{(task?.code || '?').slice(0, 3).toUpperCase()}</div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <div style={{
                                fontSize: 13, fontWeight: 600, color: isDark ? '#ddd' : '#333',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>{task?.name || task?.code || '?'}</div>
                              {customerName && (
                                <div style={{
                                  fontSize: 10, fontWeight: 500, color: isDark ? 'rgba(0,229,160,.6)' : 'rgba(5,150,105,.7)',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1,
                                }}>&#x1F3E2; {customerName}</div>
                              )}
                              {jm.length > 0 && (
                                <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                                  {jm.slice(0, 3).map(m => (
                                    <span key={m.id} style={{
                                      fontSize: 8, fontWeight: 600, padding: '1px 4px', borderRadius: 2,
                                      background: isDark ? 'rgba(66,165,245,.15)' : 'rgba(66,165,245,.1)', color: '#42a5f5',
                                    }}>&#x1F69C; {m.machine?.name?.slice(0, 10) || '?'}</span>
                                  ))}
                                  {jm.length > 3 && <span style={{ fontSize: 8, color: '#42a5f5' }}>+{jm.length - 3}</span>}
                                </div>
                              )}
                              <div style={{
                                fontSize: 9, opacity: 0.7, fontWeight: 400, marginTop: 2, color: isDark ? '#aaa' : '#666',
                              }}>
                                {report
                                  ? `${t.reported ?? 'Reported'} · ${hoursToDisplay(report.actual_hours || 0)} · ${statusLabel(report.status)}`
                                  : (t.clickToReport ?? 'Click to report time')}
                              </div>
                            </div>
                            <div style={{
                              width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                              background: report ? statusColor(report.status) : 'transparent',
                              border: report ? 'none' : `1px dashed ${th.textDim}`,
                            }} />
                          </div>

                          {/* Quick action: Create Quotation */}
                          {hasCustomer && (
                            <div style={{
                              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)'}`,
                              padding: '4px 14px 6px',
                            }}>
                              <button
                                onClick={e => { e.stopPropagation(); openQuotationModal(job, di); }}
                                style={{
                                  padding: '3px 10px', borderRadius: 3, border: `1px solid ${isDark ? 'rgba(139,92,246,.3)' : 'rgba(124,58,237,.2)'}`,
                                  background: isDark ? 'rgba(139,92,246,.08)' : 'rgba(124,58,237,.05)',
                                  color: isDark ? '#a78bfa' : '#7c3aed', cursor: 'pointer',
                                  fontSize: 9, fontWeight: 700, letterSpacing: .5,
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  transition: 'all .15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(139,92,246,.15)' : 'rgba(124,58,237,.1)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(139,92,246,.08)' : 'rgba(124,58,237,.05)'; }}
                              >
                                &#x1F4DD; {t.createQuotation ?? 'Create Quotation'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{
                    padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ color: th.textDim, fontSize: 11, fontStyle: 'italic' }}>{t.free ?? 'Free'}</span>
                    {canAddJob && (
                      <button onClick={() => openAddJobModal(di)} style={{
                        padding: '4px 10px', borderRadius: 3, border: `1px dashed ${th.border}`,
                        background: 'transparent', color: th.textDim, cursor: 'pointer', fontSize: 10,
                        fontWeight: 600, transition: 'all .15s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.color = th.gold; e.currentTarget.style.borderColor = th.gold; }}
                        onMouseLeave={e => { e.currentTarget.style.color = th.textDim; e.currentTarget.style.borderColor = th.border; }}
                      >
                        + {t.addJob ?? 'Add Job'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════ REPORT MODAL ═══════════════════════ */}
      {modalType === 'report' && reportData && (
        <div style={{ position: 'fixed', inset: 0, background: th.modalBg, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, animation: 'fadeIn .2s ease' }}
          onClick={() => setModalType(null)}>
          <div style={{ background: th.modalCard, border: `1px solid ${th.border}`, borderRadius: 2, width: 440, maxHeight: '90vh', overflow: 'auto', boxShadow: isDark ? '0 16px 48px rgba(0,0,0,.5)' : '0 16px 48px rgba(0,0,0,.1)', animation: 'scaleIn .25s cubic-bezier(0.16,1,0.3,1)' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${th.borderFaint}` }}>
              <div style={{ fontSize: 8, color: th.goldDim, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>{t.reportTime ?? 'Report Time'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 4, background: reportData.taskColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                  {(reportData.job.task?.code || '?').slice(0, 3).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 400, color: th.gold }}>{reportData.taskName}</div>
                  <div style={{ fontSize: 10, color: th.textDim }}>
                    {(t.days as string[])?.[reportData.dayIndex] ?? ''}, {fmtDate(dates[reportData.dayIndex])}
                    {reportData.customerName ? ` · ${reportData.customerName}` : ''}
                  </div>
                </div>
              </div>
            </div>
            {/* Errors */}
            {formErrors.length > 0 && (
              <div style={{ margin: '12px 24px 0', padding: '10px 14px', borderRadius: 2, background: isDark ? 'rgba(248,113,113,.1)' : 'rgba(220,38,38,.06)', border: `1px solid ${isDark ? 'rgba(248,113,113,.2)' : 'rgba(220,38,38,.15)'}` }}>
                {formErrors.map((err, i) => <div key={i} style={{ fontSize: 11, color: isDark ? '#f87171' : '#dc2626', fontWeight: 500, lineHeight: 1.6 }}>⚠ {err}</div>)}
              </div>
            )}
            {/* Form */}
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 9, color: th.goldDim, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{t.startTime ?? 'Start'}</label>
                  <input type="time" value={formStartTime} onChange={e => { setFormStartTime(e.target.value); setFormErrors([]); }} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 9, color: th.goldDim, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{t.endTime ?? 'End'}</label>
                  <input type="time" value={formEndTime} onChange={e => { setFormEndTime(e.target.value); setFormErrors([]); }} style={{ ...inputStyle, borderColor: timeToHours(formEndTime) <= timeToHours(formStartTime) ? (isDark ? '#f87171' : '#dc2626') : th.border }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, padding: '10px 12px', background: th.goldGhost, borderRadius: 2, textAlign: 'center' }}>
                  <div style={{ fontSize: 8, color: th.goldDim, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{t.actualHours ?? 'Actual'}</div>
                  <div style={{ fontSize: 20, fontWeight: 300, color: computeActualHours() > 0 ? th.gold : (isDark ? '#f87171' : '#dc2626') }}>
                    {computeActualHours() > 0 ? hoursToDisplay(computeActualHours()) : '—'}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 9, color: th.goldDim, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{t.plannedHours ?? 'Planned'}</label>
                  <input type="number" min="0" max="24" step="0.5" value={formPlannedHours} onChange={e => { setFormPlannedHours(e.target.value); setFormErrors([]); }} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 9, color: th.goldDim, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Status</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['COMPLETED', 'PARTIAL', 'NOT_DONE', 'ADDED'].map(s => (
                    <button key={s} onClick={() => setFormStatus(s)} style={{
                      padding: '6px 12px', borderRadius: 2, border: 'none', cursor: 'pointer',
                      background: formStatus === s ? statusColor(s) : th.btnBg,
                      color: formStatus === s ? '#fff' : th.textMuted, fontSize: 10, fontWeight: 600, transition: 'all .15s',
                    }}>{statusLabel(s)}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 9, color: th.goldDim, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{t.description ?? 'Description'}</label>
                <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={3} placeholder={t.descriptionPlaceholder ?? 'What was done...'} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: th.goldDim, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{t.notes ?? 'Notes'}</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} placeholder={t.notesPlaceholder ?? ''} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: th.goldDim, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{t.photos ?? 'Photos'}</label>
                {formPhotos.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
                    {formPhotos.map((url, idx) => (
                      <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: 2, overflow: 'hidden', border: `1px solid ${th.borderFaint}` }}>
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button onClick={() => setFormPhotos(prev => prev.filter(p => p !== url))} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoUpload} style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{
                  width: '100%', padding: '10px', borderRadius: 2, border: `1px dashed ${th.border}`,
                  background: 'transparent', color: th.textDim, cursor: uploading ? 'wait' : 'pointer', fontSize: 11, fontWeight: 500, boxSizing: 'border-box',
                }}>
                  {uploading ? (t.uploadingPhoto ?? 'Uploading...') : `+ ${t.addPhoto ?? 'Add photo'}`}
                </button>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${th.borderFaint}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalType(null)} style={{ padding: '10px 20px', borderRadius: 2, border: `1px solid ${th.borderFaint}`, background: 'transparent', color: th.textDim, cursor: 'pointer', fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>{t.cancel ?? 'Cancel'}</button>
              <button onClick={saveReport} disabled={saving} style={{ padding: '10px 24px', borderRadius: 2, border: 'none', background: th.gold, color: isDark ? '#0a0a0a' : '#fff', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1, fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
                {saving ? '...' : (reportData.existingReport ? (t.update ?? 'Update') : (t.save ?? 'Save'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ ADD JOB MODAL ═══════════════════════ */}
      {modalType === 'add-job' && addJobData && (
        <div style={{ position: 'fixed', inset: 0, background: th.modalBg, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, animation: 'fadeIn .2s ease' }}
          onClick={() => setModalType(null)}>
          <div style={{ background: th.modalCard, border: `1px solid ${th.border}`, borderRadius: 2, width: 440, maxHeight: '90vh', overflow: 'auto', boxShadow: isDark ? '0 16px 48px rgba(0,0,0,.5)' : '0 16px 48px rgba(0,0,0,.1)', animation: 'scaleIn .25s cubic-bezier(0.16,1,0.3,1)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${th.borderFaint}` }}>
              <div style={{ fontSize: 8, color: th.goldDim, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>{t.addJob ?? 'Add Job'}</div>
              <div style={{ fontSize: 16, fontWeight: 400, color: th.gold }}>
                {(t.days as string[])?.[addJobData.dayIndex] ?? ''}, {fmtDate(dates[addJobData.dayIndex])}
              </div>
            </div>
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Task search */}
              <div>
                <label style={{ fontSize: 9, color: th.goldDim, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{t.selectTask ?? 'Select Task'} *</label>
                <input placeholder={t.searchTasks ?? 'Search tasks...'} value={jobTaskSearch} onChange={e => { setJobTaskSearch(e.target.value); setJobSelectedTask(null); }} style={inputStyle} />
                {/* Task list */}
                {!jobSelectedTask && (
                  <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 4, border: `1px solid ${th.border}`, borderRadius: 2 }}>
                    {filteredTasks.length === 0 ? (
                      <div style={{ padding: 12, textAlign: 'center', color: th.textDim, fontSize: 12 }}>{t.noMatch ?? 'No match'}</div>
                    ) : filteredTasks.map(task => {
                      const color = getTaskColor(task, task.id);
                      return (
                        <div key={task.id} onClick={() => { setJobSelectedTask(task); setJobTaskSearch(task.name); }}
                          style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${th.borderFaint}`, transition: 'background .1s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: th.text }}>{task.name}</div>
                            <div style={{ fontSize: 9, color: th.textDim }}>{task.code} · {task.schedule_type === 'UNTERHALT' ? 'UH' : 'GT'}{task.customer ? ` · ${task.customer.name}` : ''}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {jobSelectedTask && (
                  <div style={{ marginTop: 6, padding: '8px 12px', borderRadius: 2, background: isDark ? `${getTaskColor(jobSelectedTask, jobSelectedTask.id)}28` : `${getTaskColor(jobSelectedTask, jobSelectedTask.id)}18`, borderLeft: `3px solid ${getTaskColor(jobSelectedTask, jobSelectedTask.id)}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: th.text }}>{jobSelectedTask.name}</div>
                      <div style={{ fontSize: 9, color: th.textDim }}>{jobSelectedTask.code}{jobSelectedTask.customer ? ` · ${jobSelectedTask.customer.name}` : ''}</div>
                    </div>
                    <button onClick={() => { setJobSelectedTask(null); setJobTaskSearch(''); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>×</button>
                  </div>
                )}
              </div>
              {/* Machine selection */}
              <div>
                <label style={{ fontSize: 9, color: th.goldDim, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{t.machines ?? 'Machines'} ({t.optional ?? 'optional'})</label>
                <div style={{ maxHeight: 120, overflowY: 'auto', border: `1px solid ${th.border}`, borderRadius: 2 }}>
                  {activeMachines.slice(0, 30).map(m => {
                    const selected = jobMachineIds.includes(m.id);
                    return (
                      <div key={m.id} onClick={() => setJobMachineIds(prev => selected ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                        style={{ padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${th.borderFaint}`, background: selected ? (isDark ? 'rgba(66,165,245,.1)' : 'rgba(66,165,245,.06)') : 'transparent' }}>
                        <div style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${selected ? '#42a5f5' : th.border}`, background: selected ? '#42a5f5' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700, flexShrink: 0 }}>
                          {selected ? '✓' : ''}
                        </div>
                        <span style={{ fontSize: 11, color: th.text, fontWeight: 500 }}>{m.name}</span>
                        {m.inventory_nr && <span style={{ fontSize: 9, color: th.textDim }}>{m.inventory_nr}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Notes */}
              <div>
                <label style={{ fontSize: 9, color: th.goldDim, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{t.notes ?? 'Notes'}</label>
                <textarea value={jobNotes} onChange={e => setJobNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${th.borderFaint}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalType(null)} style={{ padding: '10px 20px', borderRadius: 2, border: `1px solid ${th.borderFaint}`, background: 'transparent', color: th.textDim, cursor: 'pointer', fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>{t.cancel ?? 'Cancel'}</button>
              <button onClick={saveJob} disabled={!jobSelectedTask || jobSaving} style={{ padding: '10px 24px', borderRadius: 2, border: 'none', background: !jobSelectedTask ? th.textGhost : th.gold, color: isDark ? '#0a0a0a' : '#fff', cursor: !jobSelectedTask || jobSaving ? 'default' : 'pointer', opacity: !jobSelectedTask ? 0.4 : jobSaving ? 0.7 : 1, fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
                {jobSaving ? '...' : (t.addJob ?? 'Add Job')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ QUOTATION MODAL ═══════════════════════ */}
      {modalType === 'quotation' && quoteData && (
        <div style={{ position: 'fixed', inset: 0, background: th.modalBg, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, animation: 'fadeIn .2s ease' }}
          onClick={() => setModalType(null)}>
          <div style={{ background: th.modalCard, border: `1px solid ${th.border}`, borderRadius: 2, width: 520, maxHeight: '92vh', overflow: 'auto', boxShadow: isDark ? '0 16px 48px rgba(0,0,0,.5)' : '0 16px 48px rgba(0,0,0,.1)', animation: 'scaleIn .25s cubic-bezier(0.16,1,0.3,1)' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${th.borderFaint}` }}>
              <div style={{ fontSize: 8, color: isDark ? '#a78bfa' : '#7c3aed', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>&#x1F4DD; {t.fieldQuotation ?? 'Field Quotation'}</div>
              <div style={{ fontSize: 16, fontWeight: 400, color: th.gold }}>{quoteData.taskName}</div>
              <div style={{ fontSize: 10, color: th.textDim, marginTop: 2 }}>
                {quoteData.customerName ? `${quoteData.customerName}` : ''} · {(t.days as string[])?.[quoteData.dayIndex] ?? ''}, {fmtDate(dates[quoteData.dayIndex])}
              </div>
              {quoteData.customer && (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 2, background: isDark ? 'rgba(139,92,246,.06)' : 'rgba(124,58,237,.04)', border: `1px solid ${isDark ? 'rgba(139,92,246,.15)' : 'rgba(124,58,237,.1)'}`, fontSize: 10, color: th.textDim }}>
                  <strong style={{ color: th.text }}>{quoteData.customer.name}</strong>
                  {quoteData.customer.street && <span> · {quoteData.customer.street}</span>}
                  {quoteData.customer.postal_code && <span>, {quoteData.customer.postal_code}</span>}
                  {quoteData.customer.city && <span> {quoteData.customer.city}</span>}
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Title */}
              <div>
                <label style={{ fontSize: 9, color: th.goldDim, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{t.title ?? 'Title'}</label>
                <input value={quoteTitle} onChange={e => setQuoteTitle(e.target.value)} style={inputStyle} />
              </div>

              {/* Line items */}
              <div>
                <label style={{ fontSize: 9, color: th.goldDim, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{t.lineItems ?? 'Line Items'}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {quoteLines.map((line, idx) => (
                    <div key={line.id} style={{
                      padding: '10px 12px', borderRadius: 2, border: `1px solid ${th.border}`,
                      background: isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.015)',
                    }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 9, color: th.textDim, fontWeight: 700, minWidth: 18 }}>#{idx + 1}</span>
                        <input placeholder={t.description ?? 'Description'} value={line.description}
                          onChange={e => updateQuoteLine(line.id, { description: e.target.value })}
                          style={{ ...inputStyle, fontSize: 12, padding: '6px 8px', flex: 1 }} />
                        {quoteLines.length > 1 && (
                          <button onClick={() => removeQuoteLine(line.id)} style={{
                            background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, fontWeight: 700, padding: '0 4px',
                          }}>×</button>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 8, color: th.textGhost, marginBottom: 2 }}>{t.qty ?? 'Qty'}</div>
                          <input type="number" min="0" step="0.5" value={line.quantity}
                            onChange={e => updateQuoteLine(line.id, { quantity: parseFloat(e.target.value) || 0 })}
                            style={{ ...inputStyle, fontSize: 11, padding: '5px 6px' }} />
                        </div>
                        <div style={{ width: 70 }}>
                          <div style={{ fontSize: 8, color: th.textGhost, marginBottom: 2 }}>{t.unit ?? 'Unit'}</div>
                          <select value={line.unit} onChange={e => updateQuoteLine(line.id, { unit: e.target.value })}
                            style={{ ...inputStyle, fontSize: 11, padding: '5px 6px', appearance: 'auto' }}>
                            {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 8, color: th.textGhost, marginBottom: 2 }}>{t.price ?? 'Price'} (CHF)</div>
                          <input type="number" min="0" step="0.05" value={line.unit_price}
                            onChange={e => updateQuoteLine(line.id, { unit_price: parseFloat(e.target.value) || 0 })}
                            style={{ ...inputStyle, fontSize: 11, padding: '5px 6px' }} />
                        </div>
                        <div style={{ width: 50 }}>
                          <div style={{ fontSize: 8, color: th.textGhost, marginBottom: 2 }}>%</div>
                          <input type="number" min="0" max="100" value={line.discount_percent}
                            onChange={e => updateQuoteLine(line.id, { discount_percent: parseFloat(e.target.value) || 0 })}
                            style={{ ...inputStyle, fontSize: 11, padding: '5px 6px' }} />
                        </div>
                        <div style={{ width: 80, textAlign: 'right' }}>
                          <div style={{ fontSize: 8, color: th.textGhost, marginBottom: 2 }}>Total</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: th.gold, paddingTop: 6 }}>
                            {formatChf(Math.round((line.quantity || 0) * (line.unit_price || 0) * (1 - (line.discount_percent || 0) / 100) * 100) / 100)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={addQuoteLine} style={{
                    padding: '6px 12px', borderRadius: 2, border: `1px dashed ${th.border}`,
                    background: 'transparent', color: th.textDim, cursor: 'pointer', fontSize: 10, fontWeight: 600,
                  }}>+ {t.addLine ?? 'Add line'}</button>
                </div>
              </div>

              {/* Totals */}
              <div style={{ padding: '12px', borderRadius: 2, background: th.goldGhost, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                  <span style={{ color: th.textDim }}>{t.subtotal ?? 'Subtotal'}:</span>
                  <span style={{ color: th.text, fontWeight: 600, minWidth: 80, textAlign: 'right' }}>CHF {formatChf(quoteSubtotal)}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                  <span style={{ color: th.textDim }}>{t.vat ?? 'VAT'} (8.1%):</span>
                  <span style={{ color: th.text, fontWeight: 600, minWidth: 80, textAlign: 'right' }}>CHF {formatChf(quoteVat)}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 14, borderTop: `1px solid ${th.border}`, paddingTop: 6, marginTop: 4 }}>
                  <span style={{ color: th.gold, fontWeight: 700 }}>{t.total ?? 'Total'}:</span>
                  <span style={{ color: th.gold, fontWeight: 700, minWidth: 80, textAlign: 'right' }}>CHF {formatChf(quoteTotal)}</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 9, color: th.goldDim, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{t.notes ?? 'Notes'}</label>
                <textarea value={quoteNotes} onChange={e => setQuoteNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              {/* Signature */}
              <div>
                <label style={{ fontSize: 9, color: isDark ? '#a78bfa' : '#7c3aed', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  &#x270D; {t.customerSignature ?? 'Customer Signature'} ({t.optional ?? 'optional'})
                </label>
                <div style={{ fontSize: 10, color: th.textDim, marginBottom: 8 }}>
                  {t.signatureHint ?? 'If the customer signs, the quotation is automatically accepted'}
                </div>
                <SignaturePad isDark={isDark} th={th}
                  onSave={(dataUrl) => setQuoteSignature(dataUrl)}
                  onClear={() => setQuoteSignature(null)}
                />
                {quoteSignature && (
                  <div style={{ marginTop: 6, fontSize: 10, color: isDark ? '#4ade80' : '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    ✓ {t.signatureCaptured ?? 'Signature captured — quotation will be marked as accepted'}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${th.borderFaint}`, display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 9, color: th.textDim }}>
                {quoteSignature ? `✓ ${t.willBeAccepted ?? 'Will be accepted'}` : `${t.willBeDraft ?? 'Will be saved as draft'}`}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setModalType(null)} style={{ padding: '10px 20px', borderRadius: 2, border: `1px solid ${th.borderFaint}`, background: 'transparent', color: th.textDim, cursor: 'pointer', fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>{t.cancel ?? 'Cancel'}</button>
                <button onClick={saveQuotation} disabled={quoteSaving} style={{
                  padding: '10px 24px', borderRadius: 2, border: 'none',
                  background: quoteSignature ? (isDark ? '#a78bfa' : '#7c3aed') : th.gold,
                  color: '#fff', cursor: quoteSaving ? 'wait' : 'pointer', opacity: quoteSaving ? 0.7 : 1,
                  fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
                }}>
                  {quoteSaving ? '...' : quoteSignature ? (t.acceptAndSave ?? 'Accept & Save') : (t.saveDraft ?? 'Save Draft')}
                </button>
              </div>
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
