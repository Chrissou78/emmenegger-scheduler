import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from '../contexts/themeContext';
import { useAuthStore } from '../contexts/authStore';
import { useRolesStore } from '../store/rolesStore';
import { resolvePermissions, type Role, type Permission } from '../../../shared/constants/roles';
import { getTranslations, type LangCode } from '../i18n';

const API = import.meta.env.VITE_API_URL || '';

/* ────────────────── interfaces ────────────────── */
interface Customer {
  id: string;
  name: string;
  street?: string;
  postal_code?: string;
  city?: string;
  email?: string;
  phone?: string;
}

interface Task {
  id: string;
  name: string;
  short_code: string;
  description?: string;
  estimated_hours?: number;
  color_bg?: string;
  schedule_type?: string;
}

interface QuotationLine {
  id: string;
  position: number;
  description: string;
  task_id?: string;
  task_name?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount: number;
  total: number;
}

interface Quotation {
  id: string;
  number: string;
  customer_id: string;
  customer?: Customer;
  title: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  date: string;
  valid_until: string;
  lines: QuotationLine[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  notes?: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#95a5a6', SENT: '#3498db', ACCEPTED: '#4ecdc4',
  REJECTED: '#e74c3c', EXPIRED: '#f39c12',
};

const UNIT_OPTIONS = ['hours', 'pieces', 'm2', 'm3', 'flatRate', 'days'];

/* ────────────────── TaskSearchDropdown component ────────────────── */
interface TaskSearchProps {
  tasks: Task[];
  value: string;
  taskId?: string;
  onSelectTask: (task: Task) => void;
  onClearTask: () => void;
  onChange: (val: string) => void;
  t: Record<string, string>;
  inputStyle: React.CSSProperties;
  isDark: boolean;
  th: any;
}

function TaskSearchDropdown({
  tasks, value, taskId, onSelectTask, onClearTask, onChange, t, inputStyle, isDark, th,
}: TaskSearchProps) {
  const [mode, setMode] = useState<'free' | 'task'>(taskId ? 'task' : 'free');
  const [taskSearch, setTaskSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredTasks = useMemo(() => {
    if (!taskSearch) return tasks.slice(0, 20);
    const q = taskSearch.toLowerCase();
    return tasks.filter(
      (tk) =>
        tk.name.toLowerCase().includes(q) ||
        tk.short_code.toLowerCase().includes(q) ||
        (tk.description || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }, [tasks, taskSearch]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const dimText = isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.4)';

  const toggleBtn = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', transition: 'all .15s',
    background: active ? (th.gold || '#4ecdc4') : (isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)'),
    color: active ? '#fff' : dimText,
  });

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <button type="button" onClick={() => { setMode('free'); setDropdownOpen(false); }} style={toggleBtn(mode === 'free')}>
          {t.freeText}
        </button>
        <button type="button" onClick={() => { setMode('task'); setDropdownOpen(true); }} style={toggleBtn(mode === 'task')}>
          {t.fromTask}
        </button>
      </div>

      {mode === 'free' && (
        <>
          {taskId && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
              padding: '4px 10px', borderRadius: 6, fontSize: 12,
              background: isDark ? 'rgba(78,205,196,.1)' : 'rgba(78,205,196,.08)',
              color: '#4ecdc4', fontWeight: 600,
            }}>
              <span>🔗 {t.fromTask}</span>
              <button type="button" onClick={onClearTask} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}>
                {t.clearTask}
              </button>
            </div>
          )}
          <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder={t.description} />
        </>
      )}

      {mode === 'task' && (
        <>
          <input
            value={taskSearch}
            onChange={(e) => { setTaskSearch(e.target.value); setDropdownOpen(true); }}
            onFocus={() => setDropdownOpen(true)}
            placeholder={t.searchTask}
            style={inputStyle}
          />
          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              zIndex: 100, maxHeight: 240, overflowY: 'auto',
              background: isDark ? '#1e1e3a' : '#fff',
              border: `1px solid ${th.border}`, borderRadius: 8, marginTop: 4,
              boxShadow: '0 8px 30px rgba(0,0,0,.25)',
            }}>
              {filteredTasks.length === 0 && (
                <div style={{ padding: '12px 14px', color: dimText, fontSize: 13 }}>—</div>
              )}
              {filteredTasks.map((tk) => (
                <div
                  key={tk.id}
                  onClick={() => { onSelectTask(tk); setTaskSearch(''); setDropdownOpen(false); setMode('free'); }}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', transition: 'background .1s',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)'}`,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 6,
                    background: tk.color_bg || '#C8A96E', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 11, flexShrink: 0,
                  }}>
                    {tk.short_code}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: th.text }}>{tk.name}</div>
                    {tk.description && (
                      <div style={{ fontSize: 11, color: dimText, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tk.description}
                      </div>
                    )}
                  </div>
                  {tk.estimated_hours != null && (
                    <span style={{ fontSize: 11, color: dimText, flexShrink: 0 }}>{tk.estimated_hours}h</span>
                  )}
                </div>
              ))}
              <div style={{ padding: '8px 14px', fontSize: 11, color: dimText, borderTop: `1px solid ${th.border}`, textAlign: 'center' }}>
                {t.orTypeManually} →{' '}
                <button type="button" onClick={() => { setMode('free'); setDropdownOpen(false); }}
                  style={{ background: 'none', border: 'none', color: th.gold || '#4ecdc4', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: 0 }}>
                  {t.freeText}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ────────────────── helpers ────────────────── */
function makeLineId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function emptyLine(position: number): QuotationLine {
  return {
    id: makeLineId(), position, description: '', task_id: undefined,
    task_name: undefined, quantity: 1, unit: 'hours', unit_price: 0,
    discount: 0, total: 0,
  };
}

function calcLineTotal(line: QuotationLine): number {
  const sub = line.quantity * line.unit_price;
  return Math.round((sub - sub * (line.discount / 100)) * 100) / 100;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function in30Days(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

/* ────────────────── component ────────────────── */
export function QuotationsPage() {
  const { th, isDark, lang } = useTheme();
  const { token, user } = useAuthStore();
  const { permissionMap } = useRolesStore();
  const t = getTranslations(lang as LangCode);

  /* ── Permission handling ── */
  const perms = useMemo(() => {
    const role: Role = (user?.role as Role) || 'EMPLOYEE';
    return resolvePermissions(role, user?.custom_permissions, permissionMap);
  }, [user, permissionMap]);

  const canView = perms.has('quotations.view' as Permission);
  const canEdit = perms.has('quotations.edit' as Permission);
  const canDelete = perms.has('quotations.delete' as Permission);

  /* ── Auth headers (memoized) ── */
  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  /* ── state ── */
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [selected, setSelected] = useState<Quotation | null>(null);
  const [editing, setEditing] = useState(false);

  /* form state */
  const [formTitle, setFormTitle] = useState('');
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formDate, setFormDate] = useState(todayStr());
  const [formValidUntil, setFormValidUntil] = useState(in30Days());
  const [formStatus, setFormStatus] = useState<Quotation['status']>('DRAFT');
  const [formLines, setFormLines] = useState<QuotationLine[]>([emptyLine(1)]);
  const [formVatRate, setFormVatRate] = useState(8.1);
  const [formNotes, setFormNotes] = useState('');

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const panelRef = useRef<HTMLDivElement>(null);

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  function closeDetail() {
    setSelected(null);
    setEditing(false);
    setConfirmDelete(false);
  }

  const panelOpen = selected !== null || editing;

  /* ── derived calculations ── */
  const formSubtotal = useMemo(
    () => formLines.reduce((sum, l) => sum + calcLineTotal(l), 0),
    [formLines],
  );
  const formVatAmount = Math.round(formSubtotal * (formVatRate / 100) * 100) / 100;
  const formTotal = Math.round((formSubtotal + formVatAmount) * 100) / 100;

  /* ── style helpers ── */
  const dimText = isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.4)';
  const inputBg = isDark ? '#1a1a3e' : '#faf7f2';
  const panelBg = isDark ? '#1e1e3a' : '#fff';
  const gold = th.gold || '#c8a961';

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: `1px solid ${th.border}`, background: inputBg,
    color: th.text, fontSize: 14, outline: 'none',
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'auto' as const };
  const btnPrimary: React.CSSProperties = {
    padding: '8px 18px', borderRadius: 8, border: 'none',
    background: gold, color: '#fff',
    fontWeight: 600, cursor: 'pointer', fontSize: 14,
  };
  const btnDanger: React.CSSProperties = { ...btnPrimary, background: '#e74c3c' };
  const btnSecondary: React.CSSProperties = {
    padding: '8px 18px', borderRadius: 8,
    border: `1px solid ${th.border}`,
    background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
    color: th.text, fontWeight: 600, cursor: 'pointer', fontSize: 14,
  };
  const btnBack: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 8, border: 'none',
    background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)',
    color: th.text, fontWeight: 600, cursor: 'pointer', fontSize: 13,
    marginBottom: 16,
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: dimText, fontWeight: 600, marginBottom: 4, display: 'block' };
  const thStyle: React.CSSProperties = {
    textAlign: 'left' as const, padding: '10px 12px',
    borderBottom: `2px solid ${th.border}`, color: dimText,
    fontWeight: 600, fontSize: 12, textTransform: 'uppercase' as const,
  };
  const tdStyleBase: React.CSSProperties = {
    padding: '10px 12px', borderBottom: `1px solid ${th.border}`,
  };

  /* ── data fetching ── */
  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/quotations`, { headers: authHeaders });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setQuotations(json.data ?? json ?? []);
    } catch {
      showToast(t.error, 'err');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, t.error]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/customers?pageSize=9999`, { headers: authHeaders });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setCustomers(json.data ?? json ?? []);
    } catch { /* silent */ }
  }, [authHeaders]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/tasks`, { headers: authHeaders });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setTasks(json.data ?? json ?? []);
    } catch { /* silent */ }
  }, [authHeaders]);

  useEffect(() => { fetchQuotations(); fetchCustomers(); fetchTasks(); }, [fetchQuotations, fetchCustomers, fetchTasks]);

  /* ── populate form from quotation ── */
  function populateForm(q: Quotation) {
    setFormTitle(q.title || '');
    setFormCustomerId(q.customer_id || '');
    setFormDate(q.date || todayStr());
    setFormValidUntil(q.valid_until || in30Days());
    setFormStatus(q.status || 'DRAFT');
    setFormLines(
      q.lines && q.lines.length > 0
        ? q.lines.map((l, i) => ({ ...l, id: l.id || makeLineId(), position: i + 1, total: calcLineTotal(l) }))
        : [emptyLine(1)],
    );
    setFormVatRate(q.vat_rate ?? 8.1);
    setFormNotes(q.notes || '');
  }

  function resetForm() {
    setFormTitle('');
    setFormCustomerId('');
    setFormDate(todayStr());
    setFormValidUntil(in30Days());
    setFormStatus('DRAFT');
    setFormLines([emptyLine(1)]);
    setFormVatRate(8.1);
    setFormNotes('');
  }

  /* ── line item handlers ── */
  function updateLine(id: string, updates: Partial<QuotationLine>) {
    setFormLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, ...updates };
        updated.total = calcLineTotal(updated);
        return updated;
      }),
    );
  }

  function addLine() {
    setFormLines((prev) => [...prev, emptyLine(prev.length + 1)]);
  }

  function removeLine(id: string) {
    setFormLines((prev) => {
      const f = prev.filter((l) => l.id !== id);
      return f.length === 0 ? [emptyLine(1)] : f.map((l, i) => ({ ...l, position: i + 1 }));
    });
  }

  function handleSelectTask(lineId: string, task: Task) {
    updateLine(lineId, {
      task_id: task.id,
      task_name: task.name,
      description: task.description || task.name,
    });
  }

  function handleClearTask(lineId: string) {
    updateLine(lineId, { task_id: undefined, task_name: undefined });
  }

  /* ── CRUD ── */
  async function saveQuotation() {
    if (!canEdit) return;
    try {
      const body = {
        title: formTitle,
        customer_id: formCustomerId || undefined,
        date: formDate,
        valid_until: formValidUntil,
        status: formStatus,
        lines: formLines.map((l) => ({
          description: l.description,
          task_id: l.task_id || undefined,
          quantity: l.quantity,
          unit: l.unit,
          unit_price: l.unit_price,
          discount: l.discount,
        })),
        vat_rate: formVatRate,
        notes: formNotes || undefined,
      };
      const method = selected ? 'PUT' : 'POST';
      const url = selected
        ? `${API}/api/v1/quotations/${selected.id}`
        : `${API}/api/v1/quotations`;
      const res = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      showToast(t.saved);
      closeDetail();
      fetchQuotations();
    } catch {
      showToast(t.error, 'err');
    }
  }

  async function deleteQuotation() {
    if (!selected || !canDelete) return;
    try {
      const res = await fetch(`${API}/api/v1/quotations/${selected.id}`, { method: 'DELETE', headers: authHeaders });
      if (!res.ok) throw new Error();
      showToast(t.deleted);
      closeDetail();
      fetchQuotations();
    } catch {
      showToast(t.error, 'err');
    }
  }

  /* ── filtered list ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return quotations.filter((qt) => {
      const ms = !q || (qt.title || '').toLowerCase().includes(q) || (qt.number || '').toLowerCase().includes(q) || (qt.customer?.name || '').toLowerCase().includes(q);
      const mst = !filterStatus || qt.status === filterStatus;
      return ms && mst;
    });
  }, [quotations, search, filterStatus]);

  const customerName = (id: string) => customers.find((c) => c.id === id)?.name || '–';

  function formatChf(val: number): string {
    return val.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* ── Access guard ── */
  if (!canView) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: th.text }}>
        <h2>{t.accessDenied}</h2>
      </div>
    );
  }

  /* ────────────────── render ────────────────── */
  return (
    <div style={{ padding: '24px 16px', maxWidth: 1400, margin: '0 auto', color: th.text }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 24px', borderRadius: 10,
          background: toast.type === 'err' ? '#e74c3c' : '#4ecdc4',
          color: '#fff', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,.25)',
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 26, color: gold, letterSpacing: 2, fontWeight: 300 }}>{t.title}</h1>
        {!panelOpen && canEdit && (
          <button onClick={() => { resetForm(); setSelected(null); setEditing(true); }} style={btnPrimary}>
            {t.add}
          </button>
        )}
      </div>

      {/* ═══════════════ LIST VIEW ═══════════════ */}
      {!panelOpen && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <input placeholder={t.search} value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, maxWidth: 260 }} />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...selectStyle, maxWidth: 180 }}>
              <option value="">{t.allStatuses}</option>
              {(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const).map((s) => (
                <option key={s} value={s}>{t[s]}</option>
              ))}
            </select>
          </div>

          {loading && <div style={{ textAlign: 'center', padding: 40, color: dimText }}>{t.loading}</div>}

          {!loading && filtered.length === 0 && (
            <p style={{ color: dimText, textAlign: 'center', padding: 40 }}>{t.noQuotations}</p>
          )}

          {!loading && filtered.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr>
                    {[t.number, t.offerTitle, t.customer, t.date, t.status, t.total].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((q) => (
                    <tr
                      key={q.id}
                      onClick={() => { setSelected(q); populateForm(q); setEditing(false); setConfirmDelete(false); setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}
                      style={{ cursor: 'pointer', transition: 'background .15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ ...tdStyleBase, color: gold, fontWeight: 700, fontFamily: 'monospace' }}>{q.number || '–'}</td>
                      <td style={{ ...tdStyleBase, color: th.text }}>{q.title || '–'}</td>
                      <td style={{ ...tdStyleBase, color: dimText }}>{q.customer?.name || customerName(q.customer_id)}</td>
                      <td style={{ ...tdStyleBase, color: dimText }}>{q.date || '–'}</td>
                      <td style={tdStyleBase}>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                          fontSize: 12, fontWeight: 600,
                          background: `${STATUS_COLORS[q.status] || '#95a5a6'}22`,
                          color: STATUS_COLORS[q.status] || '#95a5a6',
                        }}>{t[q.status] || q.status}</span>
                      </td>
                      <td style={{ ...tdStyleBase, color: th.text, fontWeight: 600, textAlign: 'right' }}>
                        {t.chf} {formatChf(q.total || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ═══════════════ DETAIL / EDIT PANEL ═══════════════ */}
      {panelOpen && (
        <div ref={panelRef}>
          <button onClick={closeDetail} style={btnBack}>{t.back}</button>

          <div style={{ padding: 24, borderRadius: 14, background: panelBg, border: `1px solid ${th.border}` }}>

            {/* Panel header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ margin: 0, color: gold }}>
                {editing
                  ? (formTitle || (selected ? selected.title : t.add))
                  : (selected?.title || '')}
                {selected && !editing && selected.number && (
                  <span style={{ fontSize: 14, color: dimText, fontWeight: 400, marginLeft: 12 }}>
                    {selected.number}
                  </span>
                )}
              </h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selected && !editing && canEdit && (
                  <>
                    <button onClick={() => { populateForm(selected); setEditing(true); }} style={btnPrimary}>{t.edit}</button>
                    {canDelete && (
                      <>
                        {confirmDelete ? (
                          <>
                            <span style={{ color: th.text, alignSelf: 'center', fontSize: 13 }}>{t.confirmDelete}</span>
                            <button onClick={deleteQuotation} style={btnDanger}>{t.yes}</button>
                            <button onClick={() => setConfirmDelete(false)} style={btnSecondary}>{t.no}</button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmDelete(true)} style={btnDanger}>{t.delete}</button>
                        )}
                      </>
                    )}
                  </>
                )}
                {editing && canEdit && (
                  <>
                    <button onClick={saveQuotation} style={btnPrimary}>{t.save}</button>
                    <button onClick={() => { if (selected) { populateForm(selected); setEditing(false); } else closeDetail(); }} style={btnSecondary}>{t.cancel}</button>
                  </>
                )}
              </div>
            </div>

            {/* ── View mode ── */}
            {selected && !editing && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={labelStyle}>{t.customer}</label>
                    <p style={{ margin: '4px 0 0', color: th.text, fontSize: 14 }}>{selected.customer?.name || customerName(selected.customer_id)}</p>
                  </div>
                  <div>
                    <label style={labelStyle}>{t.date}</label>
                    <p style={{ margin: '4px 0 0', color: th.text, fontSize: 14 }}>{selected.date}</p>
                  </div>
                  <div>
                    <label style={labelStyle}>{t.validUntil}</label>
                    <p style={{ margin: '4px 0 0', color: th.text, fontSize: 14 }}>{selected.valid_until}</p>
                  </div>
                  <div>
                    <label style={labelStyle}>{t.status}</label>
                    <span style={{
                      display: 'inline-block', padding: '4px 12px', borderRadius: 20,
                      fontSize: 12, fontWeight: 600, marginTop: 4,
                      background: `${STATUS_COLORS[selected.status] || '#95a5a6'}22`,
                      color: STATUS_COLORS[selected.status] || '#95a5a6',
                    }}>{t[selected.status] || selected.status}</span>
                  </div>
                </div>

                <h3 style={{ fontSize: 16, fontWeight: 600, color: th.text, marginBottom: 12 }}>{t.lines}</h3>
                <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {['#', t.description, t.quantity, t.unit, t.unitPrice, t.discount, t.lineTotal].map((h) => (
                          <th key={h} style={{ ...thStyle, fontSize: 11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.lines || []).map((l, i) => (
                        <tr key={l.id || i}>
                          <td style={{ ...tdStyleBase, color: dimText, width: 40 }}>{i + 1}</td>
                          <td style={{ ...tdStyleBase, color: th.text }}>
                            {l.description}
                            {l.task_id && (
                              <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 4, background: isDark ? 'rgba(78,205,196,.1)' : 'rgba(78,205,196,.08)', color: '#4ecdc4', fontWeight: 600 }}>
                                🔗 {l.task_name || ''}
                              </span>
                            )}
                          </td>
                          <td style={{ ...tdStyleBase, color: th.text, textAlign: 'right' }}>{l.quantity}</td>
                          <td style={{ ...tdStyleBase, color: dimText }}>{t[l.unit] || l.unit}</td>
                          <td style={{ ...tdStyleBase, color: th.text, textAlign: 'right' }}>{formatChf(l.unit_price)}</td>
                          <td style={{ ...tdStyleBase, color: dimText, textAlign: 'right' }}>{l.discount > 0 ? `${l.discount}%` : '–'}</td>
                          <td style={{ ...tdStyleBase, color: th.text, fontWeight: 600, textAlign: 'right' }}>{formatChf(calcLineTotal(l))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ minWidth: 240 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                      <span style={{ color: dimText }}>{t.subtotal}</span>
                      <span style={{ color: th.text }}>{t.chf} {formatChf(selected.subtotal || 0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                      <span style={{ color: dimText }}>{t.vat} ({selected.vat_rate ?? 8.1}%)</span>
                      <span style={{ color: th.text }}>{t.chf} {formatChf(selected.vat_amount || 0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 18, fontWeight: 700, borderTop: `2px solid ${th.border}`, marginTop: 4 }}>
                      <span style={{ color: th.text }}>{t.grandTotal}</span>
                      <span style={{ color: gold }}>{t.chf} {formatChf(selected.total || 0)}</span>
                    </div>
                  </div>
                </div>

                {selected.notes && (
                  <div style={{ marginTop: 20 }}>
                    <label style={labelStyle}>{t.notes}</label>
                    <p style={{ color: th.text, fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selected.notes}</p>
                  </div>
                )}
              </>
            )}

            {/* ── Edit / Create mode ── */}
            {editing && canEdit && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>{t.offerTitle}</label>
                    <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t.customer}</label>
                    <select value={formCustomerId} onChange={(e) => setFormCustomerId(e.target.value)} style={selectStyle}>
                      <option value="">–</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>{t.status}</label>
                    <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as Quotation['status'])} style={selectStyle}>
                      {(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const).map((s) => (
                        <option key={s} value={s}>{t[s]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>{t.date}</label>
                    <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t.validUntil}</label>
                    <input type="date" value={formValidUntil} onChange={(e) => setFormValidUntil(e.target.value)} style={inputStyle} />
                  </div>
                </div>

                <h3 style={{ fontSize: 16, fontWeight: 600, color: th.text, marginBottom: 12 }}>{t.lines}</h3>

                {formLines.map((line, idx) => (
                  <div key={line.id} style={{
                    padding: 16, borderRadius: 10, marginBottom: 12,
                    background: isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)',
                    border: `1px solid ${th.border}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: th.text }}>
                        #{idx + 1}
                        {line.task_name && (
                          <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 4, background: isDark ? 'rgba(78,205,196,.1)' : 'rgba(78,205,196,.08)', color: '#4ecdc4', fontWeight: 600 }}>
                            🔗 {line.task_name}
                          </span>
                        )}
                      </span>
                      {formLines.length > 1 && (
                        <button type="button" onClick={() => removeLine(line.id)}
                          style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          {t.removeLine}
                        </button>
                      )}
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={labelStyle}>{t.description}</label>
                      <TaskSearchDropdown
                        tasks={tasks} value={line.description} taskId={line.task_id}
                        onSelectTask={(task) => handleSelectTask(line.id, task)}
                        onClearTask={() => handleClearTask(line.id)}
                        onChange={(val) => updateLine(line.id, { description: val })}
                        t={t} inputStyle={inputStyle} isDark={isDark} th={th}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                      <div>
                        <label style={labelStyle}>{t.quantity}</label>
                        <input type="number" min="0" step="0.5" value={line.quantity}
                          onChange={(e) => updateLine(line.id, { quantity: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>{t.unit}</label>
                        <select value={line.unit} onChange={(e) => updateLine(line.id, { unit: e.target.value })} style={selectStyle}>
                          {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{t[u] || u}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>{t.unitPrice}</label>
                        <input type="number" min="0" step="0.05" value={line.unit_price}
                          onChange={(e) => updateLine(line.id, { unit_price: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>{t.discount}</label>
                        <input type="number" min="0" max="100" step="0.5" value={line.discount}
                          onChange={(e) => updateLine(line.id, { discount: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                      </div>
                      <div style={{ textAlign: 'right', paddingBottom: 2 }}>
                        <label style={labelStyle}>{t.lineTotal}</label>
                        <div style={{ fontSize: 16, fontWeight: 700, color: th.text, padding: '10px 0' }}>
                          {formatChf(calcLineTotal(line))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button type="button" onClick={addLine} style={{ ...btnSecondary, fontSize: 13, padding: '6px 16px', marginBottom: 20 }}>
                  {t.addLine}
                </button>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
                  <div style={{ minWidth: 280 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                      <span style={{ color: dimText }}>{t.subtotal}</span>
                      <span style={{ color: th.text }}>{t.chf} {formatChf(formSubtotal)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, alignItems: 'center', gap: 10 }}>
                      <span style={{ color: dimText }}>{t.vat}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="number" min="0" max="100" step="0.1" value={formVatRate}
                          onChange={(e) => setFormVatRate(parseFloat(e.target.value) || 0)}
                          style={{ ...inputStyle, width: 70, textAlign: 'right', padding: '4px 8px', fontSize: 13 }} />
                        <span style={{ color: dimText, fontSize: 13 }}>%</span>
                        <span style={{ color: th.text, minWidth: 80, textAlign: 'right' }}>{t.chf} {formatChf(formVatAmount)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 18, fontWeight: 700, borderTop: `2px solid ${th.border}`, marginTop: 4 }}>
                      <span style={{ color: th.text }}>{t.grandTotal}</span>
                      <span style={{ color: gold }}>{t.chf} {formatChf(formTotal)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>{t.notes}</label>
                  <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
