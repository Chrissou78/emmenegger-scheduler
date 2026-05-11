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
  sales_id?: string;
  team_leader_id?: string;
}

interface UserBasic {
  id: string;
  first_name: string;
  last_name: string;
  role?: string;
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
  vat_rate: number;
  total: number;
}

interface Quotation {
  id: string;
  number: string;
  customer_id: string;
  customer?: Customer;
  contact?: { id: string; first_name: string; last_name: string } | null;
  title: string;
  description?: string;
  status: string;
  date: string;
  valid_until: string;
  lines: QuotationLine[];
  subtotal: number;
  vat_amount: number;
  discount_amount: number;
  total: number;
  notes?: string;
  currency?: string;
  payment_terms?: number;
  created_at: string;
  created_by?: string;
}

/* ── Status labels per language (avoids missing i18n keys) ── */
const STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'INVOICED'] as const;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#95a5a6', SENT: '#3498db', ACCEPTED: '#4ecdc4',
  REJECTED: '#e74c3c', EXPIRED: '#f39c12', INVOICED: '#8b5cf6',
};

const STATUS_LABELS: Record<string, Record<string, string>> = {
  DRAFT:    { de: 'Entwurf',    en: 'Draft',    fr: 'Brouillon',  it: 'Bozza',     es: 'Borrador',  pt: 'Rascunho',  nl: 'Concept'      },
  SENT:     { de: 'Gesendet',   en: 'Sent',     fr: 'Envoyé',     it: 'Inviato',   es: 'Enviado',   pt: 'Enviado',   nl: 'Verstuurd'    },
  ACCEPTED: { de: 'Angenommen', en: 'Accepted', fr: 'Accepté',    it: 'Accettato', es: 'Aceptado',  pt: 'Aceito',    nl: 'Geaccepteerd' },
  REJECTED: { de: 'Abgelehnt',  en: 'Rejected', fr: 'Refusé',     it: 'Rifiutato', es: 'Rechazado', pt: 'Recusado',  nl: 'Afgewezen'    },
  EXPIRED:  { de: 'Abgelaufen', en: 'Expired',  fr: 'Expiré',     it: 'Scaduto',   es: 'Expirado',  pt: 'Expirado',  nl: 'Verlopen'     },
  INVOICED: { de: 'Verrechnet', en: 'Invoiced', fr: 'Facturé',    it: 'Fatturato', es: 'Facturado', pt: 'Faturado',  nl: 'Gefactureerd' },
};

const UNIT_OPTIONS = ['Std', 'Stk', 'm²', 'm³', 'Pauschale', 'Tage', 'lfm', 'kg'];

const UNIT_LABELS: Record<string, Record<string, string>> = {
  Std:       { de: 'Stunden',   en: 'Hours',     fr: 'Heures',   it: 'Ore',       es: 'Horas',       pt: 'Horas',     nl: 'Uren'    },
  Stk:       { de: 'Stück',     en: 'Pieces',    fr: 'Pièces',   it: 'Pezzi',     es: 'Piezas',      pt: 'Peças',     nl: 'Stuks'   },
  'm²':      { de: 'm²',        en: 'm²',        fr: 'm²',       it: 'm²',        es: 'm²',          pt: 'm²',        nl: 'm²'      },
  'm³':      { de: 'm³',        en: 'm³',        fr: 'm³',       it: 'm³',        es: 'm³',          pt: 'm³',        nl: 'm³'      },
  Pauschale: { de: 'Pauschale', en: 'Flat Rate',  fr: 'Forfait',  it: 'Forfait',   es: 'Tarifa fija', pt: 'Taxa fixa', nl: 'Forfait' },
  Tage:      { de: 'Tage',      en: 'Days',      fr: 'Jours',    it: 'Giorni',    es: 'Días',        pt: 'Dias',      nl: 'Dagen'   },
  lfm:       { de: 'lfm',       en: 'lm',        fr: 'ml',       it: 'ml',        es: 'ml',          pt: 'ml',        nl: 'lm'      },
  kg:        { de: 'kg',        en: 'kg',        fr: 'kg',       it: 'kg',        es: 'kg',          pt: 'kg',        nl: 'kg'      },
};

/* ────────────────── TaskSearchDropdown ────────────────── */
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
        tk && tk.name && tk.name.toLowerCase().includes(q) ||
        tk && tk.short_code && tk.short_code.toLowerCase().includes(q) ||
        (tk?.description || '').toLowerCase().includes(q)
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
          {t.freeText || 'Free text'}
        </button>
        <button type="button" onClick={() => { setMode('task'); setDropdownOpen(true); }} style={toggleBtn(mode === 'task')}>
          {t.fromTask || 'From task'}
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
              <span>🔗 {t.fromTask || 'From task'}</span>
              <button type="button" onClick={onClearTask} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}>
                {t.clearTask || 'Clear'}
              </button>
            </div>
          )}
          <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder={t.description || 'Description'} />
        </>
      )}

      {mode === 'task' && (
        <>
          <input
            value={taskSearch}
            onChange={(e) => { setTaskSearch(e.target.value); setDropdownOpen(true); }}
            onFocus={() => setDropdownOpen(true)}
            placeholder={t.searchTask || 'Search task...'}
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
                {t.orTypeManually || 'Or type manually'} →{' '}
                <button type="button" onClick={() => { setMode('free'); setDropdownOpen(false); }}
                  style={{ background: 'none', border: 'none', color: th.gold || '#4ecdc4', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: 0 }}>
                  {t.freeText || 'Free text'}
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
    task_name: undefined, quantity: 1, unit: 'Std', unit_price: 0,
    discount: 0, vat_rate: 8.1, total: 0,
  };
}

function calcLineTotal(line: QuotationLine): number {
  const sub = (line.quantity || 0) * (line.unit_price || 0);
  return Math.round((sub - sub * ((line.discount || 0) / 100)) * 100) / 100;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function in30Days(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

/**
 * Maps backend quotation (quote_number, quote_date, total_gross, items)
 * to frontend model (number, date, total, lines).
 */
function normalizeQuotation(raw: any): Quotation {
  if (!raw) return raw;

  const lines: QuotationLine[] = (raw.items || raw.lines || [])
    .filter(Boolean)
    .map((it: any, i: number) => ({
      id: it.id || makeLineId(),
      position: it.sort_order || it.position || i + 1,
      description: it.description || '',
      task_id: it.task_id || undefined,
      task_name: it.task_name || undefined,
      quantity: parseFloat(it.quantity) || 0,
      unit: it.unit || 'Std',
      unit_price: parseFloat(it.unit_price) || 0,
      discount: parseFloat(it.discount_percent ?? it.discount) || 0,
      vat_rate: parseFloat(it.vat_rate) || 8.1,
      total: parseFloat(it.total) || 0,
    }));

  return {
    id: raw.id || '',
    number: raw.quote_number || raw.number || '',
    customer_id: raw.customer_id || '',
    customer: raw.customer || undefined,
    contact: raw.contact || undefined,
    title: raw.title || '',
    description: raw.description || '',
    status: raw.status || 'DRAFT',
    date: raw.quote_date || raw.date || '',
    valid_until: raw.valid_until || '',
    lines,
    subtotal: parseFloat(raw.subtotal) || 0,
    vat_amount: parseFloat(raw.vat_amount) || 0,
    discount_amount: parseFloat(raw.discount_amount) || 0,
    total: parseFloat(raw.total_gross ?? raw.total) || 0,
    notes: raw.notes || '',
    currency: raw.currency || 'CHF',
    payment_terms: raw.payment_terms,
    created_at: raw.created_at || '',
    created_by: raw.created_by,
  };
}

/* ────────────────── component ────────────────── */
export function QuotationsPage() {
  const { th, isDark, lang } = useTheme();
  const { token, user } = useAuthStore();
  const { permissionMap } = useRolesStore();
  const t: any = getTranslations(lang as LangCode);
  const langCode = (lang || 'de') as string;

  /* ── i18n helpers that never crash ── */
  const statusLabel = (s: string) => STATUS_LABELS[s]?.[langCode] || STATUS_LABELS[s]?.de || s;
  const unitLabel = (u: string) => UNIT_LABELS[u]?.[langCode] || UNIT_LABELS[u]?.de || u;

  /* ── Permission handling ── */
  const perms = useMemo(() => {
    const role: Role = (user?.role as Role) || 'EMPLOYEE';
    return resolvePermissions(role, user?.custom_permissions, permissionMap);
  }, [user, permissionMap]);

  const canView = perms.has('quotations.view' as Permission);
  const canEdit = perms.has('quotations.edit' as Permission);
  const canDelete = perms.has('quotations.delete' as Permission);

  /* ── Auth headers — read fresh each call ── */
  const getHeaders = (): HeadersInit => {
    const freshToken = token || localStorage.getItem('token');
    return {
      Authorization: `Bearer ${freshToken}`,
      'Content-Type': 'application/json',
    };
  };

  /* ── state ── */
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allUsers, setAllUsers] = useState<UserBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [selected, setSelected] = useState<Quotation | null>(null);
  const [editing, setEditing] = useState(false);

  /* form state */
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formDate, setFormDate] = useState(todayStr());
  const [formValidUntil, setFormValidUntil] = useState(in30Days());
  const [formStatus, setFormStatus] = useState('DRAFT');
  const [formLines, setFormLines] = useState<QuotationLine[]>([emptyLine(1)]);
  const [formNotes, setFormNotes] = useState('');
  const [formDiscountAmount, setFormDiscountAmount] = useState(0);
  const [formPaymentTerms, setFormPaymentTerms] = useState(30);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const panelRef = useRef<HTMLDivElement>(null);
  const hasFetched = useRef(false);

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
  const formVatAmount = useMemo(
    () => formLines.reduce((sum, l) => {
      const lineTotal = calcLineTotal(l);
      return sum + Math.round(lineTotal * ((l.vat_rate || 8.1) / 100) * 100) / 100;
    }, 0),
    [formLines],
  );
  const formTotal = Math.round((formSubtotal + formVatAmount - formDiscountAmount) * 100) / 100;

  /* ── style helpers ── */
  const dimText = isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.4)';
  const inputBg = isDark ? '#1a1a3e' : '#faf7f2';
  const panelBg = isDark ? '#1e1e3a' : '#fff';
  const gold = th.gold || '#c8a961';

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: `1px solid ${th.border}`, background: inputBg,
    color: th.text, fontSize: 14, outline: 'none', boxSizing: 'border-box',
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
  const sCard: React.CSSProperties = {
    padding: 16, borderRadius: 10, marginBottom: 12,
    background: isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)',
    border: `1px solid ${th.border}`,
  };

  /* ── data fetching ── */
  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/quotations`, { headers: getHeaders() });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const raw = json.data ?? json ?? [];
      setQuotations((Array.isArray(raw) ? raw : []).filter(Boolean).map(normalizeQuotation));
    } catch {
      showToast(t.error || 'Error', 'err');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/customers?pageSize=9999`, { headers: getHeaders() });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const raw = json.data ?? json ?? [];
      setCustomers(Array.isArray(raw) ? raw.filter(Boolean) : []);
    } catch { /* silent */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/tasks`, { headers: getHeaders() });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const raw = json.data ?? json ?? [];
      setTasks(Array.isArray(raw) ? raw.filter(Boolean) : []);
    } catch { /* silent */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/users?limit=500`, { headers: getHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      const raw = json.data ?? json.items ?? json ?? [];
      setAllUsers(Array.isArray(raw) ? raw.filter(Boolean) : []);
    } catch { /* silent */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const currentToken = token || localStorage.getItem('token');
    if (!currentToken || hasFetched.current) return;
    hasFetched.current = true;
    fetchQuotations();
    fetchCustomers();
    fetchTasks();
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /* ── Sales & TL user lists — null-safe ── */
  const salesUsers = useMemo(() =>
    allUsers.filter(u => u && (u.role || '').toUpperCase() === 'SALES'),
    [allUsers],
  );
  const teamLeaders = useMemo(() =>
    allUsers.filter(u => u && ['MANAGER', 'LOCAL_MANAGER'].includes((u.role || '').toUpperCase())),
    [allUsers],
  );

  /* ── populate form from quotation ── */
  function populateForm(q: Quotation) {
    setFormTitle(q.title || '');
    setFormDesc(q.description || '');
    setFormCustomerId(q.customer_id || '');
    setFormDate(q.date || todayStr());
    setFormValidUntil(q.valid_until || in30Days());
    setFormStatus(q.status || 'DRAFT');
    setFormLines(
      q.lines && q.lines.length > 0
        ? q.lines.map((l, i) => ({ ...l, id: l.id || makeLineId(), position: i + 1, total: calcLineTotal(l) }))
        : [emptyLine(1)],
    );
    setFormNotes(q.notes || '');
    setFormDiscountAmount(q.discount_amount || 0);
    setFormPaymentTerms(q.payment_terms ?? 30);
  }

  function resetForm() {
    setFormTitle('');
    setFormDesc('');
    setFormCustomerId('');
    setFormDate(todayStr());
    setFormValidUntil(in30Days());
    setFormStatus('DRAFT');
    setFormLines([emptyLine(1)]);
    setFormNotes('');
    setFormDiscountAmount(0);
    setFormPaymentTerms(30);
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
        description: formDesc || undefined,
        customer_id: formCustomerId || undefined,
        valid_until: formValidUntil || undefined,
        status: formStatus,
        payment_terms: formPaymentTerms,
        discount_amount: formDiscountAmount,
        notes: formNotes || undefined,
        items: formLines.map((l) => ({
          description: l.description,
          task_id: l.task_id || undefined,
          quantity: l.quantity,
          unit: l.unit,
          unit_price: l.unit_price,
          discount_percent: l.discount,
          vat_rate: l.vat_rate,
        })),
      };
      const method = selected ? 'PUT' : 'POST';
      const url = selected
        ? `${API}/api/v1/quotations/${selected.id}`
        : `${API}/api/v1/quotations`;
      const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      showToast(t.saved || 'Saved');
      closeDetail();
      fetchQuotations();
    } catch {
      showToast(t.error || 'Error', 'err');
    }
  }

  async function deleteQuotation() {
    if (!selected || !canDelete) return;
    try {
      const res = await fetch(`${API}/api/v1/quotations/${selected.id}`, { method: 'DELETE', headers: getHeaders() });
      if (!res.ok) throw new Error();
      showToast(t.deleted || 'Deleted');
      closeDetail();
      fetchQuotations();
    } catch {
      showToast(t.error || 'Error', 'err');
    }
  }

  async function convertToInvoice() {
    if (!selected) return;
    try {
      const res = await fetch(`${API}/api/v1/quotations/${selected.id}/convert-to-invoice`, {
        method: 'POST', headers: getHeaders(),
      });
      if (!res.ok) throw new Error();
      showToast(t.saved || 'Converted');
      closeDetail();
      fetchQuotations();
    } catch {
      showToast(t.error || 'Error', 'err');
    }
  }

  /* ── filtered list — fully null-safe ── */
  const filtered = useMemo(() => {
    const q = (search || '').toLowerCase();
    return quotations.filter((qt) => {
      if (!qt) return false;
      const ms = !q
        || (qt.title || '').toLowerCase().includes(q)
        || (qt.number || '').toLowerCase().includes(q)
        || (qt.customer?.name || '').toLowerCase().includes(q);
      const mst = !filterStatus || qt.status === filterStatus;
      return ms && mst;
    });
  }, [quotations, search, filterStatus]);

  /* ── lookup helpers — null-safe ── */
  const customerName = (id: string) => {
    if (!id) return '–';
    return customers.find((c) => c?.id === id)?.name || '–';
  };

  const customerSalesName = (id: string): string => {
    if (!id) return '–';
    const c = customers.find(cu => cu?.id === id);
    if (!c?.sales_id) return '–';
    const u = allUsers.find(usr => usr?.id === c.sales_id);
    return u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || '–' : '–';
  };

  const customerTLName = (id: string): string => {
    if (!id) return '–';
    const c = customers.find(cu => cu?.id === id);
    if (!c?.team_leader_id) return '–';
    const u = allUsers.find(usr => usr?.id === c.team_leader_id);
    return u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || '–' : '–';
  };

  function formatChf(val: number): string {
    return (val || 0).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* ── Access guard ── */
  if (!canView) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: th.text }}>
        <h2>{t.accessDenied || 'Access Denied'}</h2>
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
        <h1 style={{ margin: 0, fontSize: 26, color: gold, letterSpacing: 2, fontWeight: 300 }}>
          {t.navQuotations || 'Quotations'}
        </h1>
        {!panelOpen && canEdit && (
          <button onClick={() => { resetForm(); setSelected(null); setEditing(true); }} style={btnPrimary}>
            + {t.add || 'Add'}
          </button>
        )}
      </div>

      {/* ═══════════════ LIST VIEW ═══════════════ */}
      {!panelOpen && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <input placeholder={t.search || 'Search...'} value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, maxWidth: 260 }} />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...selectStyle, maxWidth: 180 }}>
              <option value="">{t.allStatuses || 'All statuses'}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          </div>

          {loading && <div style={{ textAlign: 'center', padding: 40, color: dimText }}>{t.loading || 'Loading...'}</div>}

          {!loading && filtered.length === 0 && (
            <p style={{ color: dimText, textAlign: 'center', padding: 40 }}>{t.noQuotations || 'No quotations found'}</p>
          )}

          {!loading && filtered.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>{t.number || '#'}</th>
                    <th style={thStyle}>{t.offerTitle || 'Title'}</th>
                    <th style={thStyle}>{t.customer || 'Customer'}</th>
                    <th style={thStyle}>{t.salesRep || 'Sales'}</th>
                    <th style={thStyle}>{t.teamLeader || 'TL'}</th>
                    <th style={thStyle}>{t.date || 'Date'}</th>
                    <th style={thStyle}>{t.status || 'Status'}</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>{t.total || 'Total'}</th>
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
                      <td style={{ ...tdStyleBase, color: dimText, fontSize: 13 }}>{customerSalesName(q.customer_id)}</td>
                      <td style={{ ...tdStyleBase, color: dimText, fontSize: 13 }}>{customerTLName(q.customer_id)}</td>
                      <td style={{ ...tdStyleBase, color: dimText }}>{q.date || '–'}</td>
                      <td style={tdStyleBase}>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                          fontSize: 12, fontWeight: 600,
                          background: `${STATUS_COLORS[q.status] || '#95a5a6'}22`,
                          color: STATUS_COLORS[q.status] || '#95a5a6',
                        }}>{statusLabel(q.status)}</span>
                      </td>
                      <td style={{ ...tdStyleBase, color: th.text, fontWeight: 600, textAlign: 'right' }}>
                        CHF {formatChf(q.total)}
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
          <button onClick={closeDetail} style={btnBack}>← {t.back || 'Back'}</button>

          <div style={{ padding: 24, borderRadius: 14, background: panelBg, border: `1px solid ${th.border}` }}>

            {/* Panel header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h2 style={{ margin: 0, color: gold }}>
                  {editing
                    ? (formTitle || (selected ? selected.title : (t.add || 'New Quotation')))
                    : (selected?.title || '')}
                </h2>
                {selected && !editing && selected.number && (
                  <span style={{ fontSize: 14, color: dimText, fontWeight: 400, fontFamily: 'monospace' }}>
                    {selected.number}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selected && !editing && canEdit && (
                  <>
                    <button onClick={() => { populateForm(selected); setEditing(true); }} style={btnPrimary}>{t.edit || 'Edit'}</button>
                    {selected.status === 'ACCEPTED' && (
                      <button onClick={convertToInvoice} style={{ ...btnPrimary, background: '#8b5cf6' }}>
                        → {t.navInvoices || 'Invoice'}
                      </button>
                    )}
                    {canDelete && (
                      <>
                        {confirmDelete ? (
                          <>
                            <span style={{ color: th.text, alignSelf: 'center', fontSize: 13 }}>{t.confirmDelete || 'Confirm?'}</span>
                            <button onClick={deleteQuotation} style={btnDanger}>{t.yes || 'Yes'}</button>
                            <button onClick={() => setConfirmDelete(false)} style={btnSecondary}>{t.no || 'No'}</button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmDelete(true)} style={btnDanger}>{t.delete || 'Delete'}</button>
                        )}
                      </>
                    )}
                  </>
                )}
                {editing && canEdit && (
                  <>
                    <button onClick={saveQuotation} style={btnPrimary}>{t.save || 'Save'}</button>
                    <button onClick={() => { if (selected) { populateForm(selected); setEditing(false); } else closeDetail(); }} style={btnSecondary}>{t.cancel || 'Cancel'}</button>
                  </>
                )}
              </div>
            </div>

            {/* ── View mode ── */}
            {selected && !editing && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                  <div style={sCard}>
                    <label style={labelStyle}>{t.customer || 'Customer'}</label>
                    <p style={{ margin: '4px 0 0', color: th.text, fontSize: 14, fontWeight: 600 }}>{selected.customer?.name || customerName(selected.customer_id)}</p>
                  </div>
                  <div style={sCard}>
                    <label style={labelStyle}>{t.salesRep || 'Sales Rep'}</label>
                    <p style={{ margin: '4px 0 0', color: th.text, fontSize: 14 }}>{customerSalesName(selected.customer_id)}</p>
                  </div>
                  <div style={sCard}>
                    <label style={labelStyle}>{t.teamLeader || 'Team Leader'}</label>
                    <p style={{ margin: '4px 0 0', color: th.text, fontSize: 14 }}>{customerTLName(selected.customer_id)}</p>
                  </div>
                  <div style={sCard}>
                    <label style={labelStyle}>{t.date || 'Date'}</label>
                    <p style={{ margin: '4px 0 0', color: th.text, fontSize: 14 }}>{selected.date || '–'}</p>
                  </div>
                  <div style={sCard}>
                    <label style={labelStyle}>{t.validUntil || 'Valid until'}</label>
                    <p style={{ margin: '4px 0 0', color: th.text, fontSize: 14 }}>{selected.valid_until || '–'}</p>
                  </div>
                  <div style={sCard}>
                    <label style={labelStyle}>{t.status || 'Status'}</label>
                    <span style={{
                      display: 'inline-block', padding: '4px 12px', borderRadius: 20,
                      fontSize: 12, fontWeight: 600, marginTop: 4,
                      background: `${STATUS_COLORS[selected.status] || '#95a5a6'}22`,
                      color: STATUS_COLORS[selected.status] || '#95a5a6',
                    }}>{statusLabel(selected.status)}</span>
                  </div>
                </div>

                {/* Lines table */}
                <h3 style={{ fontSize: 16, fontWeight: 600, color: th.text, marginBottom: 12 }}>{t.lines || 'Line Items'}</h3>
                <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, fontSize: 11, width: 40 }}>#</th>
                        <th style={{ ...thStyle, fontSize: 11 }}>{t.description || 'Description'}</th>
                        <th style={{ ...thStyle, fontSize: 11, textAlign: 'right' }}>{t.quantity || 'Qty'}</th>
                        <th style={{ ...thStyle, fontSize: 11 }}>{t.unit || 'Unit'}</th>
                        <th style={{ ...thStyle, fontSize: 11, textAlign: 'right' }}>{t.unitPrice || 'Unit Price'}</th>
                        <th style={{ ...thStyle, fontSize: 11, textAlign: 'right' }}>{t.discount || 'Disc %'}</th>
                        <th style={{ ...thStyle, fontSize: 11, textAlign: 'right' }}>{t.vatRate || 'VAT %'}</th>
                        <th style={{ ...thStyle, fontSize: 11, textAlign: 'right' }}>{t.lineTotal || 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.lines || []).map((l, i) => (
                        <tr key={l.id || i}>
                          <td style={{ ...tdStyleBase, color: dimText }}>{i + 1}</td>
                          <td style={{ ...tdStyleBase, color: th.text }}>
                            {l.description || '–'}
                            {l.task_id && (
                              <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 4, background: isDark ? 'rgba(78,205,196,.1)' : 'rgba(78,205,196,.08)', color: '#4ecdc4', fontWeight: 600 }}>
                                🔗 {l.task_name || ''}
                              </span>
                            )}
                          </td>
                          <td style={{ ...tdStyleBase, color: th.text, textAlign: 'right' }}>{l.quantity}</td>
                          <td style={{ ...tdStyleBase, color: dimText }}>{unitLabel(l.unit)}</td>
                          <td style={{ ...tdStyleBase, color: th.text, textAlign: 'right' }}>{formatChf(l.unit_price)}</td>
                          <td style={{ ...tdStyleBase, color: dimText, textAlign: 'right' }}>{l.discount > 0 ? `${l.discount}%` : '–'}</td>
                          <td style={{ ...tdStyleBase, color: dimText, textAlign: 'right' }}>{l.vat_rate}%</td>
                          <td style={{ ...tdStyleBase, color: th.text, fontWeight: 600, textAlign: 'right' }}>{formatChf(calcLineTotal(l))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ minWidth: 280 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                      <span style={{ color: dimText }}>{t.subtotal || 'Subtotal'}</span>
                      <span style={{ color: th.text }}>CHF {formatChf(selected.subtotal)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                      <span style={{ color: dimText }}>{t.vat || 'VAT'}</span>
                      <span style={{ color: th.text }}>CHF {formatChf(selected.vat_amount)}</span>
                    </div>
                    {(selected.discount_amount || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                        <span style={{ color: '#e74c3c' }}>{t.discount || 'Discount'}</span>
                        <span style={{ color: '#e74c3c' }}>– CHF {formatChf(selected.discount_amount)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 18, fontWeight: 700, borderTop: `2px solid ${th.border}`, marginTop: 4 }}>
                      <span style={{ color: th.text }}>{t.grandTotal || 'Total'}</span>
                      <span style={{ color: gold }}>CHF {formatChf(selected.total)}</span>
                    </div>
                  </div>
                </div>

                {selected.notes && (
                  <div style={{ marginTop: 20 }}>
                    <label style={labelStyle}>{t.notes || 'Notes'}</label>
                    <p style={{ color: th.text, fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selected.notes}</p>
                  </div>
                )}
              </>
            )}

            {/* ── Edit / Create mode ── */}
            {editing && canEdit && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>{t.offerTitle || 'Title'}</label>
                    <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} style={inputStyle} placeholder="Offerte ..." />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>{t.description || 'Description'}</label>
                    <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t.customer || 'Customer'}</label>
                    <select value={formCustomerId} onChange={(e) => setFormCustomerId(e.target.value)} style={selectStyle}>
                      <option value="">– {t.selectCustomer || 'Select customer'} –</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {formCustomerId && (
                      <div style={{ marginTop: 6, fontSize: 12, color: dimText }}>
                        {t.salesRep || 'Sales'}: <strong style={{ color: th.text }}>{customerSalesName(formCustomerId)}</strong>
                        {' · '}
                        {t.teamLeader || 'TL'}: <strong style={{ color: th.text }}>{customerTLName(formCustomerId)}</strong>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>{t.status || 'Status'}</label>
                    <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} style={selectStyle}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{statusLabel(s)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>{t.date || 'Date'}</label>
                    <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t.validUntil || 'Valid until'}</label>
                    <input type="date" value={formValidUntil} onChange={(e) => setFormValidUntil(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t.paymentTerms || 'Payment Terms (days)'}</label>
                    <input type="number" min="0" value={formPaymentTerms} onChange={(e) => setFormPaymentTerms(parseInt(e.target.value) || 0)} style={inputStyle} />
                  </div>
                </div>

                {/* Line items */}
                <h3 style={{ fontSize: 16, fontWeight: 600, color: th.text, marginBottom: 12 }}>{t.lines || 'Line Items'}</h3>

                {formLines.map((line, idx) => (
                  <div key={line.id} style={sCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: th.text }}>
                        #{idx + 1}
                        {line.task_name && (
                          <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 4, background: isDark ? 'rgba(78,205,196,.1)' : 'rgba(78,205,196,.08)', color: '#4ecdc4', fontWeight: 600 }}>
                            🔗 {line.task_name}
                          </span>
                        )}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: gold }}>
                          CHF {formatChf(calcLineTotal(line))}
                        </span>
                        {formLines.length > 1 && (
                          <button type="button" onClick={() => removeLine(line.id)}
                            style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 18, fontWeight: 600, lineHeight: 1 }}>
                            ×
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={labelStyle}>{t.description || 'Description'}</label>
                      <TaskSearchDropdown
                        tasks={tasks} value={line.description} taskId={line.task_id}
                        onSelectTask={(task) => handleSelectTask(line.id, task)}
                        onClearTask={() => handleClearTask(line.id)}
                        onChange={(val) => updateLine(line.id, { description: val })}
                        t={t} inputStyle={inputStyle} isDark={isDark} th={th}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
                      <div>
                        <label style={labelStyle}>{t.quantity || 'Qty'}</label>
                        <input type="number" min="0" step="0.5" value={line.quantity}
                          onChange={(e) => updateLine(line.id, { quantity: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>{t.unit || 'Unit'}</label>
                        <select value={line.unit} onChange={(e) => updateLine(line.id, { unit: e.target.value })} style={selectStyle}>
                          {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{unitLabel(u)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>{t.unitPrice || 'Price'}</label>
                        <input type="number" min="0" step="0.05" value={line.unit_price}
                          onChange={(e) => updateLine(line.id, { unit_price: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>{t.discount || 'Disc %'}</label>
                        <input type="number" min="0" max="100" step="0.5" value={line.discount}
                          onChange={(e) => updateLine(line.id, { discount: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>{t.vatRate || 'VAT %'}</label>
                        <input type="number" min="0" max="100" step="0.1" value={line.vat_rate}
                          onChange={(e) => updateLine(line.id, { vat_rate: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                      </div>
                    </div>
                  </div>
                ))}

                <button type="button" onClick={addLine} style={{ ...btnSecondary, fontSize: 13, padding: '6px 16px', marginBottom: 20 }}>
                  + {t.addLine || 'Add Line'}
                </button>

                {/* Totals */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
                  <div style={{ minWidth: 300 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                      <span style={{ color: dimText }}>{t.subtotal || 'Subtotal'}</span>
                      <span style={{ color: th.text }}>CHF {formatChf(formSubtotal)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                      <span style={{ color: dimText }}>{t.vat || 'VAT'}</span>
                      <span style={{ color: th.text }}>CHF {formatChf(formVatAmount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, alignItems: 'center' }}>
                      <span style={{ color: '#e74c3c' }}>{t.discount || 'Discount'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#e74c3c' }}>–</span>
                        <input type="number" min="0" step="0.05" value={formDiscountAmount}
                          onChange={(e) => setFormDiscountAmount(parseFloat(e.target.value) || 0)}
                          style={{ ...inputStyle, width: 100, textAlign: 'right', padding: '4px 8px', fontSize: 13 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 18, fontWeight: 700, borderTop: `2px solid ${th.border}`, marginTop: 4 }}>
                      <span style={{ color: th.text }}>{t.grandTotal || 'Total'}</span>
                      <span style={{ color: gold }}>CHF {formatChf(formTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>{t.notes || 'Notes'}</label>
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
