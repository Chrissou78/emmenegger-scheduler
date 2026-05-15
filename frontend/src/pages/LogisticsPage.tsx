// src/pages/LogisticsPage.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from '../contexts/themeContext';
import { useAuthStore } from '../contexts/authStore';
import { CsvToolbar } from '../components/CsvToolbar';
import { resolvePermissions, type Role, type Permission } from '../../../shared/constants/roles';
import { useRolesStore } from '../store/rolesStore';
import { getTranslations, type LangCode } from '../i18n';

const API = import.meta.env.VITE_API_URL || '';

/* ─── normalizeRole ─── */
function normalizeRole(raw: string): Role {
  const upper = (raw || '').toUpperCase();
  switch (upper) {
    case 'GLOBAL_MANAGER': return 'ADMIN';
    case 'LOCAL_MANAGER':  return 'MANAGER';
    case 'ARBEITER':       return 'EMPLOYEE';
    default:               return (upper as Role) || 'EMPLOYEE';
  }
}

/* ─── interfaces ─── */
interface SparePart {
  id: string;
  part_number: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  stock_qty: number;
  min_qty: number;
  reorder_qty: number;
  location?: string;
  supplier?: string;
  supplier_ref?: string;
  unit_price: number;
  machine_id?: string;
  machine?: { id: string; name: string; inventory_nr?: string };
  qr_code?: string;
  image_url?: string;
  auto_reorder: boolean;
  is_active: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

interface Transaction {
  id: string;
  part_id: string;
  type: 'CONSUME' | 'PURCHASE' | 'ADJUST' | 'RETURN';
  qty: number;
  unit_price?: number;
  reference?: string;
  machine_id?: string;
  task_id?: string;
  user_id: string;
  notes?: string;
  created_at: string;
  part?: { id: string; part_number: string; name: string };
  machine?: { id: string; name: string };
  task?: { id: string; code: string; name: string };
  user?: { id: string; first_name: string; last_name: string };
}

interface Alert {
  id: string;
  part_id: string;
  alert_type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'AUTO_REORDER';
  message: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  created_at: string;
  part?: SparePart;
}

interface Stats {
  totalParts: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
  openAlerts: number;
  consumed30d: number;
  purchased30d: number;
  spentValue30d: number;
}

interface Machine { id: string; name: string; inventory_nr?: string }
interface Task    { id: string; code: string; name: string }

/* ─── constants ─── */
const PART_CATEGORIES = [
  'GENERAL', 'FILTER', 'HYDRAULIC', 'ELECTRICAL', 'ENGINE',
  'WEAR', 'BELT', 'BLADE', 'TIRE', 'LUBRICANT', 'SAFETY', 'OTHER',
];

const UNITS = ['pcs', 'liter', 'kg', 'meter', 'set', 'roll', 'box'];

const TX_TYPES = ['CONSUME', 'PURCHASE', 'ADJUST', 'RETURN'] as const;

const ALERT_COLORS: Record<string, string> = {
  LOW_STOCK: '#f39c12', OUT_OF_STOCK: '#e74c3c', AUTO_REORDER: '#3498db',
};

const ALERT_ICONS: Record<string, string> = {
  LOW_STOCK: '⚠️', OUT_OF_STOCK: '🔴', AUTO_REORDER: '🔄',
};

const TX_COLORS: Record<string, string> = {
  CONSUME: '#e74c3c', PURCHASE: '#27ae60', ADJUST: '#f39c12', RETURN: '#3498db',
};

const TX_ICONS: Record<string, string> = {
  CONSUME: '📤', PURCHASE: '📥', ADJUST: '🔧', RETURN: '↩️',
};

/* ─── helpers ─── */
function fmtCHF(v: number): string {
  return v.toLocaleString('de-CH', { style: 'currency', currency: 'CHF' });
}

function fmtNum(v: number): string {
  return v.toLocaleString('de-CH', { maximumFractionDigits: 2 });
}

function partToForm(p: SparePart | null): Partial<SparePart> {
  if (!p) return {
    part_number: '', name: '', description: '', category: 'GENERAL',
    unit: 'pcs', stock_qty: 0, min_qty: 0, reorder_qty: 0,
    location: '', supplier: '', supplier_ref: '', unit_price: 0,
    machine_id: '', qr_code: '', auto_reorder: false, notes: '',
  };
  return { ...p };
}

/* ─── CSV columns ─── */
function csvColumns(t: Record<string, any>) {
  return [
    { key: 'part_number', label: t.logPartNumber || 'Part Number' },
    { key: 'name',        label: t.name },
    { key: 'category',    label: t.category },
    { key: 'unit',        label: t.logUnit || 'Unit' },
    { key: 'stock_qty',   label: t.logStockQty || 'Stock' },
    { key: 'min_qty',     label: t.logMinQty || 'Min' },
    { key: 'reorder_qty', label: t.logReorderQty || 'Reorder' },
    { key: 'location',    label: t.logLocation || 'Location' },
    { key: 'supplier',    label: t.logSupplier || 'Supplier' },
    { key: 'supplier_ref',label: t.logSupplierRef || 'Supplier Ref' },
    { key: 'unit_price',  label: t.logUnitPrice || 'Unit Price' },
    { key: 'qr_code',     label: t.logQrCode || 'QR Code' },
    { key: 'auto_reorder',label: t.logAutoReorder || 'Auto-Reorder' },
    { key: 'notes',       label: t.notes || 'Notes' },
  ];
}

const CSV_EXAMPLE_ROWS = [
  {
    part_number: 'FLT-OIL-001', name: 'Oil Filter CAT 320', category: 'FILTER',
    unit: 'pcs', stock_qty: '12', min_qty: '3', reorder_qty: '10',
    location: 'Warehouse A / Shelf 3', supplier: 'Bossard AG',
    supplier_ref: 'BO-FLT-4412', unit_price: '45.50',
    qr_code: 'FLT-OIL-001', auto_reorder: 'true', notes: 'For CAT 320 GC',
  },
  {
    part_number: 'HYD-HOSE-002', name: 'Hydraulic Hose 3/4"', category: 'HYDRAULIC',
    unit: 'meter', stock_qty: '25', min_qty: '5', reorder_qty: '20',
    location: 'Warehouse B / Bin 7', supplier: 'Hydac AG',
    supplier_ref: 'HY-3420', unit_price: '18.00',
    qr_code: 'HYD-HOSE-002', auto_reorder: 'false', notes: '',
  },
];

/* ================================================================== */
/*  COMPONENT                                                          */
/* ================================================================== */
export function LogisticsPage() {
  const { th, isDark, lang } = useTheme();
  const { token, user } = useAuthStore();
  const t = getTranslations(lang as LangCode) as Record<string, any>;
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  /* ── permissions ── */
  const { permissionMap } = useRolesStore();
  const perms = useMemo(() => {
    const role = normalizeRole(user?.role || '');
    return resolvePermissions(role, user?.custom_permissions, permissionMap);
  }, [user, permissionMap]);

  const canView    = perms.has('logistics.view' as Permission);
  const canEdit    = perms.has('logistics.edit' as Permission);
  const canDelete  = perms.has('logistics.delete' as Permission);
  const canConsume = perms.has('logistics.consume' as Permission);

  /* ── page-level state ── */
  type PageView = 'list' | 'alerts' | 'transactions';
  const [view, setView] = useState<PageView>('list');
  const [stats, setStats] = useState<Stats | null>(null);

  /* ── parts state ── */
  const [parts, setParts] = useState<SparePart[]>([]);
  const [allParts, setAllParts] = useState<SparePart[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStock, setFilterStock] = useState<'' | 'low' | 'out'>('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  /* ── detail state ── */
  const [selected, setSelected] = useState<SparePart | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<SparePart>>({});
  const [tab, setTab] = useState<'general' | 'stock' | 'history'>('general');
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* ── transaction modal state ── */
  const [showTxModal, setShowTxModal] = useState(false);
  const [txForm, setTxForm] = useState<{
    part_id: string; type: string; qty: string; unit_price: string;
    reference: string; machine_id: string; task_id: string; notes: string;
  }>({ part_id: '', type: 'CONSUME', qty: '', unit_price: '', reference: '', machine_id: '', task_id: '', notes: '' });

  /* ── alerts state ── */
  const [alerts, setAlerts] = useState<Alert[]>([]);

  /* ── transactions state ── */
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  /* ── reference data ── */
  const [machines, setMachines] = useState<Machine[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  /* ── toast ── */
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const panelRef = useRef<HTMLDivElement>(null);

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  /* ── theme-aware styles ── */
  const dimText = isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.4)';
  const inputBg = isDark ? '#1a1a3e' : '#faf7f2';
  const panelBg = isDark ? '#1e1e3a' : '#fff';

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: `1px solid ${th.border}`, background: inputBg,
    color: th.text, fontSize: 14, outline: 'none',
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'auto' as const };
  const btnPrimary: React.CSSProperties = {
    padding: '8px 18px', borderRadius: 8, border: 'none',
    background: th.gold, color: '#000', fontWeight: 600,
    cursor: 'pointer', fontSize: 14, transition: 'opacity .15s',
  };
  const btnDanger: React.CSSProperties = { ...btnPrimary, background: '#e74c3c', color: '#fff' };
  const btnSecondary: React.CSSProperties = {
    padding: '8px 18px', borderRadius: 8, border: `1px solid ${th.border}`,
    background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
    color: th.text, fontWeight: 600, cursor: 'pointer', fontSize: 14,
  };
  const btnBack: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 8, border: 'none',
    background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)',
    color: th.text, fontWeight: 600, cursor: 'pointer', fontSize: 13, marginBottom: 16,
  };
  const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '10px 12px', borderBottom: `2px solid ${th.border}`,
    color: dimText, fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px',
  };
  const tdStyle: React.CSSProperties = {
    padding: '10px 12px', borderBottom: `1px solid ${th.border}`, color: dimText,
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: dimText, fontWeight: 600, marginBottom: 4 };
  const cardStyle: React.CSSProperties = {
    padding: '16px 20px', borderRadius: 12,
    background: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.02)',
    border: `1px solid ${th.border}`, textAlign: 'center', minWidth: 130,
  };
  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none',
    background: active ? (isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.04)') : 'transparent',
    color: active ? th.text : dimText, fontWeight: active ? 700 : 500, cursor: 'pointer',
    borderBottom: active ? `2px solid ${th.gold}` : '2px solid transparent', transition: 'all .15s',
  });
  const viewBtn = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: active ? th.gold : (isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)'),
    color: active ? '#000' : th.text, fontWeight: 600, cursor: 'pointer', fontSize: 13,
    transition: 'all .15s',
  });

  /* ── data fetching ── */
  const fetchParts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/logistics/parts?active=true`, { headers });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const raw: SparePart[] = json.data ?? json;
      setAllParts(raw);

      let list = raw;
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.part_number.toLowerCase().includes(q) ||
          (p.location || '').toLowerCase().includes(q) ||
          (p.supplier || '').toLowerCase().includes(q)
        );
      }
      if (filterCat) list = list.filter(p => p.category === filterCat);
      if (filterStock === 'low') list = list.filter(p => p.stock_qty > 0 && p.stock_qty <= p.min_qty);
      if (filterStock === 'out') list = list.filter(p => p.stock_qty <= 0);

      const start = (page - 1) * pageSize;
      setParts(list.slice(start, start + pageSize));
    } catch { showToast(t.error || 'Error', 'err'); }
    finally { setLoading(false); }
  }, [search, filterCat, filterStock, page, token]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/logistics/stats`, { headers });
      if (!res.ok) throw new Error();
      setStats(await res.json());
    } catch { /* silent */ }
  }, [token]);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/logistics/alerts?status=OPEN`, { headers });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setAlerts(json.data ?? json);
    } catch { setAlerts([]); }
  }, [token]);

  const fetchTransactions = useCallback(async (partId?: string) => {
    try {
      const url = partId
        ? `${API}/api/v1/logistics/transactions?part_id=${partId}&limit=100`
        : `${API}/api/v1/logistics/transactions?limit=200`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setTransactions(json.data ?? json);
    } catch { setTransactions([]); }
  }, [token]);

  const fetchRefData = useCallback(async () => {
    try {
      const [mRes, tRes] = await Promise.all([
        fetch(`${API}/api/v1/machines`, { headers }),
        fetch(`${API}/api/v1/tasks`, { headers }),
      ]);
      if (mRes.ok) { const j = await mRes.json(); setMachines(j.data ?? j); }
      if (tRes.ok) { const j = await tRes.json(); setTasks(j.data ?? j); }
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => { fetchParts(); fetchStats(); fetchAlerts(); fetchRefData(); }, [fetchParts, fetchStats, fetchAlerts, fetchRefData]);

  /* ── detail handlers ── */
  function openDetail(p: SparePart) {
    setSelected(p);
    setForm(partToForm(p));
    setEditing(false);
    setTab('general');
    setConfirmDelete(false);
    fetchTransactions(p.id);
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function closeDetail() {
    setSelected(null);
    setEditing(false);
    setConfirmDelete(false);
    setTransactions([]);
  }

  async function savePart() {
    try {
      const method = selected ? 'PUT' : 'POST';
      const url = selected
        ? `${API}/api/v1/logistics/parts/${selected.id}`
        : `${API}/api/v1/logistics/parts`;
      const body: any = { ...form };
      if (body.machine_id === '') body.machine_id = null;
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Save failed');
      }
      showToast(t.saved || 'Saved');
      closeDetail();
      fetchParts();
      fetchStats();
    } catch (e: any) { showToast(e.message || t.error, 'err'); }
  }

  async function deletePart() {
    if (!selected) return;
    try {
      const res = await fetch(`${API}/api/v1/logistics/parts/${selected.id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error();
      showToast(t.deleted || 'Deleted');
      closeDetail();
      fetchParts();
      fetchStats();
    } catch { showToast(t.error || 'Error', 'err'); }
  }

  /* ── transaction submit ── */
  async function submitTransaction() {
    try {
      const body = {
        part_id: txForm.part_id,
        type: txForm.type,
        qty: parseFloat(txForm.qty),
        unit_price: txForm.unit_price ? parseFloat(txForm.unit_price) : undefined,
        reference: txForm.reference || undefined,
        machine_id: txForm.machine_id || undefined,
        task_id: txForm.task_id || undefined,
        notes: txForm.notes || undefined,
      };
      if (!body.qty || body.qty <= 0) {
        showToast(t.logQtyRequired || 'Quantity is required', 'err');
        return;
      }
      const res = await fetch(`${API}/api/v1/logistics/transactions`, {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Transaction failed');
      }
      showToast(t.success || 'Success');
      setShowTxModal(false);
      fetchParts();
      fetchStats();
      fetchAlerts();
      if (selected) fetchTransactions(selected.id);
    } catch (e: any) { showToast(e.message || t.error, 'err'); }
  }

  /* ── alert action ── */
  async function updateAlert(id: string, status: 'ACKNOWLEDGED' | 'RESOLVED') {
    try {
      const res = await fetch(`${API}/api/v1/logistics/alerts/${id}`, {
        method: 'PUT', headers, body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      fetchAlerts();
      fetchStats();
      showToast(t.saved || 'Saved');
    } catch { showToast(t.error || 'Error', 'err'); }
  }

  /* ── CSV import handler ── */
  async function handleCsvImport(rows: Record<string, string>[]) {
    try {
      const res = await fetch(`${API}/api/v1/logistics/parts/import`, {
        method: 'POST', headers,
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      showToast(`${json.imported} ${t.imported || 'imported'}`);
      fetchParts();
      fetchStats();
    } catch { showToast(t.error || 'Error', 'err'); }
  }

  /* ── derived ── */
  const panelOpen = selected !== null || editing;
  const usedCategories = useMemo(() => {
    const cats = new Set(allParts.map(p => p.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [allParts]);

  const csvData = useMemo(() => allParts.map(p => ({
    part_number: p.part_number, name: p.name, category: p.category, unit: p.unit,
    stock_qty: String(p.stock_qty), min_qty: String(p.min_qty),
    reorder_qty: String(p.reorder_qty), location: p.location || '',
    supplier: p.supplier || '', supplier_ref: p.supplier_ref || '',
    unit_price: String(p.unit_price), qr_code: p.qr_code || '',
    auto_reorder: String(p.auto_reorder), notes: p.notes || '',
  })), [allParts]);

  const totalFiltered = useMemo(() => {
    let list = allParts;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) || p.part_number.toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q) || (p.supplier || '').toLowerCase().includes(q)
      );
    }
    if (filterCat) list = list.filter(p => p.category === filterCat);
    if (filterStock === 'low') list = list.filter(p => p.stock_qty > 0 && p.stock_qty <= p.min_qty);
    if (filterStock === 'out') list = list.filter(p => p.stock_qty <= 0);
    return list.length;
  }, [allParts, search, filterCat, filterStock]);

  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  if (!canView) return null;

  /* ── translation helpers ── */
  const L = {
    title:          t.logTitle          || 'Logistics & Spare Parts',
    spareParts:     t.logSpareParts     || 'Spare Parts',
    alerts:         t.logAlerts         || 'Alerts',
    transactions:   t.logTransactions   || 'Transactions',
    partNumber:     t.logPartNumber     || 'Part No.',
    unit:           t.logUnit           || 'Unit',
    stockQty:       t.logStockQty       || 'Stock',
    minQty:         t.logMinQty         || 'Min. Qty',
    reorderQty:     t.logReorderQty     || 'Reorder Qty',
    location:       t.logLocation       || 'Location',
    supplier:       t.logSupplier       || 'Supplier',
    supplierRef:    t.logSupplierRef    || 'Supplier Ref.',
    unitPrice:      t.logUnitPrice      || 'Unit Price',
    qrCode:         t.logQrCode         || 'QR Code',
    autoReorder:    t.logAutoReorder    || 'Auto-Reorder',
    totalValue:     t.logTotalValue     || 'Inventory Value',
    lowStock:       t.logLowStock       || 'Low Stock',
    outOfStock:     t.logOutOfStock     || 'Out of Stock',
    consumed30d:    t.logConsumed30d    || 'Consumed (30d)',
    purchased30d:   t.logPurchased30d   || 'Purchased (30d)',
    spent30d:       t.logSpent30d       || 'Spent (30d)',
    openAlerts:     t.logOpenAlerts     || 'Open Alerts',
    newPart:        t.logNewPart        || 'New Part',
    recordTx:       t.logRecordTx       || 'Record Movement',
    consume:        t.logConsume        || 'Consume',
    purchase:       t.logPurchase       || 'Purchase',
    adjust:         t.logAdjust         || 'Adjust',
    returnTx:       t.logReturn         || 'Return',
    qty:            t.logQty            || 'Quantity',
    reference:      t.logReference      || 'Reference',
    machine:        t.logMachine        || 'Machine',
    task:           t.logTask           || 'Task',
    allCategories:  t.logAllCategories  || 'All Categories',
    allStock:       t.logAllStock       || 'All Stock Levels',
    linkedMachine:  t.logLinkedMachine  || 'Linked Machine',
    acknowledge:    t.logAcknowledge    || 'Acknowledge',
    resolve:        t.logResolve        || 'Resolve',
    stockHistory:   t.logStockHistory   || 'Stock History',
    noParts:        t.logNoParts        || 'No spare parts found',
    noAlerts:       t.logNoAlerts       || 'No open alerts',
    noTransactions: t.logNoTransactions || 'No transactions',
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div style={{ padding: '24px 16px', maxWidth: 1400, margin: '0 auto', color: th.text }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 24px', borderRadius: 10,
          background: toast.type === 'err' ? '#e74c3c' : '#4ecdc4',
          color: '#fff', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,.25)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Transaction Modal ── */}
      {showTxModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowTxModal(false)}>
          <div style={{
            background: panelBg, borderRadius: 14, padding: 28,
            width: '100%', maxWidth: 480, border: `1px solid ${th.border}`,
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', color: th.text }}>{L.recordTx}</h3>

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={labelStyle}>{L.spareParts}</label>
                <select value={txForm.part_id} onChange={e => setTxForm({ ...txForm, part_id: e.target.value })} style={selectStyle}>
                  <option value="">–</option>
                  {allParts.map(p => (
                    <option key={p.id} value={p.id}>{p.part_number} — {p.name} ({fmtNum(p.stock_qty)} {p.unit})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t.type || 'Type'}</label>
                <select value={txForm.type} onChange={e => setTxForm({ ...txForm, type: e.target.value })} style={selectStyle}>
                  {TX_TYPES.map(tp => (
                    <option key={tp} value={tp}>{TX_ICONS[tp]} {(L as any)[tp === 'RETURN' ? 'returnTx' : tp.toLowerCase()] || tp}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>{L.qty}</label>
                  <input type="number" min="0" step="any" value={txForm.qty}
                    onChange={e => setTxForm({ ...txForm, qty: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>{L.unitPrice}</label>
                  <input type="number" min="0" step="0.01" value={txForm.unit_price}
                    onChange={e => setTxForm({ ...txForm, unit_price: e.target.value })} style={inputStyle}
                    placeholder="CHF" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>{L.machine}</label>
                <select value={txForm.machine_id} onChange={e => setTxForm({ ...txForm, machine_id: e.target.value })} style={selectStyle}>
                  <option value="">–</option>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{L.task}</label>
                <select value={txForm.task_id} onChange={e => setTxForm({ ...txForm, task_id: e.target.value })} style={selectStyle}>
                  <option value="">–</option>
                  {tasks.map(tk => <option key={tk.id} value={tk.id}>{tk.code} — {tk.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{L.reference}</label>
                <input value={txForm.reference}
                  onChange={e => setTxForm({ ...txForm, reference: e.target.value })} style={inputStyle}
                  placeholder="PO / Job # / Notes" />
              </div>
              <div>
                <label style={labelStyle}>{t.notes || 'Notes'}</label>
                <textarea value={txForm.notes} rows={2}
                  onChange={e => setTxForm({ ...txForm, notes: e.target.value })}
                  style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTxModal(false)} style={btnSecondary}>{t.cancel}</button>
              <button onClick={submitTransaction} style={btnPrimary}>{t.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, color: th.text }}>{L.title}</h1>
          {stats && (
            <p style={{ margin: '4px 0 0', color: dimText, fontSize: 14 }}>
              {t.total}: {stats.totalParts} · {L.lowStock}: {stats.lowStock} · {L.openAlerts}: {stats.openAlerts}
            </p>
          )}
        </div>
        {!panelOpen && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {view === 'list' && (
              <>
                <CsvToolbar
                  columns={csvColumns(t)}
                  data={csvData}
                  filename={`spare_parts_${new Date().toISOString().split('T')[0]}`}
                  exampleRows={CSV_EXAMPLE_ROWS}
                  validators={{ part_number: (v: string) => v ? null : 'Required', name: (v: string) => v ? null : 'Required' }}
                  canImport={canEdit}
                  onImport={handleCsvImport}
                />
                {canConsume && (
                  <button onClick={() => {
                    setTxForm({ part_id: '', type: 'CONSUME', qty: '', unit_price: '', reference: '', machine_id: '', task_id: '', notes: '' });
                    setShowTxModal(true);
                  }} style={{ ...btnPrimary, background: '#e74c3c', color: '#fff' }}>
                    {TX_ICONS.CONSUME} {L.recordTx}
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => {
                    setSelected(null);
                    setForm(partToForm(null));
                    setEditing(true);
                    setTab('general');
                  }} style={btnPrimary}>
                    {t.add}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Stats Cards ── */}
      {stats && !panelOpen && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          {[
            { label: t.total, value: String(stats.totalParts), icon: '📦' },
            { label: L.totalValue, value: fmtCHF(stats.totalValue), icon: '💰' },
            { label: L.lowStock, value: String(stats.lowStock), icon: '⚠️', warn: stats.lowStock > 0 },
            { label: L.outOfStock, value: String(stats.outOfStock), icon: '🔴', warn: stats.outOfStock > 0 },
            { label: L.consumed30d, value: fmtNum(stats.consumed30d), icon: '📤' },
            { label: L.purchased30d, value: fmtNum(stats.purchased30d), icon: '📥' },
            { label: L.spent30d, value: fmtCHF(stats.spentValue30d), icon: '🧾' },
            { label: L.openAlerts, value: String(stats.openAlerts), icon: '🔔', warn: stats.openAlerts > 0 },
          ].map(c => (
            <div key={c.label} style={{
              ...cardStyle,
              borderColor: c.warn ? '#e74c3c' : th.border,
            }}>
              <div style={{ fontSize: 22 }}>{c.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: c.warn ? '#e74c3c' : th.text }}>{c.value}</div>
              <div style={{ fontSize: 11, color: dimText, marginTop: 2 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── View Tabs ── */}
      {!panelOpen && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setView('list')} style={viewBtn(view === 'list')}>📦 {L.spareParts}</button>
          <button onClick={() => { setView('alerts'); fetchAlerts(); }} style={viewBtn(view === 'alerts')}>
            🔔 {L.alerts} {stats && stats.openAlerts > 0 && (
              <span style={{
                display: 'inline-block', padding: '1px 7px', borderRadius: 10,
                background: '#e74c3c', color: '#fff', fontSize: 11, fontWeight: 700, marginLeft: 6,
              }}>{stats.openAlerts}</span>
            )}
          </button>
          <button onClick={() => { setView('transactions'); fetchTransactions(); }} style={viewBtn(view === 'transactions')}>
            📋 {L.transactions}
          </button>
        </div>
      )}

      {/* ════════════════════ LIST VIEW ════════════════════ */}
      {view === 'list' && !panelOpen && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <input placeholder={t.search} value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ ...inputStyle, maxWidth: 260 }} />
            <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1); }} style={{ ...selectStyle, maxWidth: 200 }}>
              <option value="">{L.allCategories}</option>
              {usedCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterStock} onChange={e => { setFilterStock(e.target.value as any); setPage(1); }} style={{ ...selectStyle, maxWidth: 200 }}>
              <option value="">{L.allStock}</option>
              <option value="low">⚠️ {L.lowStock}</option>
              <option value="out">🔴 {L.outOfStock}</option>
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: dimText }}>⏳ {t.loading}</div>
          ) : parts.length === 0 ? (
            <p style={{ color: dimText, textAlign: 'center', padding: 40 }}>{L.noParts}</p>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr>
                      {[L.partNumber, t.name, t.category, L.stockQty, L.minQty, L.location, L.supplier, L.unitPrice, t.status].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map(p => {
                      const isLow = p.stock_qty > 0 && p.stock_qty <= p.min_qty;
                      const isOut = p.stock_qty <= 0;
                      const stockColor = isOut ? '#e74c3c' : isLow ? '#f39c12' : '#27ae60';

                      return (
                        <tr key={p.id} onClick={() => openDetail(p)}
                          style={{ cursor: 'pointer', transition: 'background .15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ ...tdStyle, color: th.text, fontWeight: 600, fontFamily: 'monospace' }}>
                            {p.part_number}
                          </td>
                          <td style={{ ...tdStyle, color: th.text, fontWeight: 600 }}>
                            {p.name}
                            {p.machine && (
                              <div style={{ fontSize: 11, color: dimText, fontWeight: 400 }}>
                                🚜 {p.machine.name}
                              </div>
                            )}
                          </td>
                          <td style={tdStyle}>{p.category}</td>
                          <td style={{ ...tdStyle, fontWeight: 700, color: stockColor }}>
                            {fmtNum(p.stock_qty)} {p.unit}
                          </td>
                          <td style={tdStyle}>{fmtNum(p.min_qty)}</td>
                          <td style={tdStyle}>{p.location || '–'}</td>
                          <td style={tdStyle}>{p.supplier || '–'}</td>
                          <td style={tdStyle}>{fmtCHF(p.unit_price)}</td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${th.border}` }}>
                            <span style={{
                              display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                              fontSize: 12, fontWeight: 600,
                              background: `${stockColor}22`, color: stockColor,
                            }}>
                              {isOut ? '🔴 ' + L.outOfStock : isLow ? '⚠️ ' + L.lowStock : '✅ OK'}
                            </span>
                            {p.auto_reorder && (
                              <span style={{
                                display: 'inline-block', marginLeft: 6, padding: '2px 8px',
                                borderRadius: 20, fontSize: 11, fontWeight: 600,
                                background: '#3498db22', color: '#3498db',
                              }}>🔄</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                    style={{ ...btnSecondary, opacity: page <= 1 ? 0.4 : 1 }}>
                    {t.previous}
                  </button>
                  <span style={{ color: dimText, fontSize: 14 }}>{page} / {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                    style={{ ...btnSecondary, opacity: page >= totalPages ? 0.4 : 1 }}>
                    {t.next}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ════════════════════ ALERTS VIEW ════════════════════ */}
      {view === 'alerts' && !panelOpen && (
        <div>
          {alerts.length === 0 ? (
            <p style={{ color: dimText, textAlign: 'center', padding: 40 }}>{L.noAlerts}</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {alerts.map(a => (
                <div key={a.id} style={{
                  padding: '16px 20px', borderRadius: 12,
                  background: panelBg, border: `1px solid ${ALERT_COLORS[a.alert_type] || th.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                  flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <span style={{ fontSize: 24 }}>{ALERT_ICONS[a.alert_type]}</span>
                    <div>
                      <div style={{ fontWeight: 700, color: th.text }}>{a.message}</div>
                      <div style={{ fontSize: 12, color: dimText, marginTop: 2 }}>
                        {a.part?.part_number} · {L.stockQty}: {fmtNum(a.part?.stock_qty ?? 0)} · {L.minQty}: {fmtNum(a.part?.min_qty ?? 0)}
                        {a.part?.supplier && ` · ${L.supplier}: ${a.part.supplier}`}
                      </div>
                      <div style={{ fontSize: 11, color: dimText }}>
                        {new Date(a.created_at).toLocaleString('de-CH')}
                      </div>
                    </div>
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => updateAlert(a.id, 'ACKNOWLEDGED')} style={btnSecondary}>
                        {L.acknowledge}
                      </button>
                      <button onClick={() => updateAlert(a.id, 'RESOLVED')} style={btnPrimary}>
                        {L.resolve}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ TRANSACTIONS VIEW ════════════════════ */}
      {view === 'transactions' && !panelOpen && (
        <div>
          {transactions.length === 0 ? (
            <p style={{ color: dimText, textAlign: 'center', padding: 40 }}>{L.noTransactions}</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr>
                    {[t.date || 'Date', t.type || 'Type', L.spareParts, L.qty, L.unitPrice, L.machine, L.task, L.reference, t.users || 'User'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id}>
                      <td style={tdStyle}>{new Date(tx.created_at).toLocaleString('de-CH')}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                          fontSize: 12, fontWeight: 600,
                          background: `${TX_COLORS[tx.type]}22`,
                          color: TX_COLORS[tx.type],
                        }}>
                          {TX_ICONS[tx.type]} {tx.type}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: th.text, fontWeight: 600 }}>
                        {tx.part?.part_number} — {tx.part?.name}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: tx.qty < 0 ? '#e74c3c' : '#27ae60' }}>
                        {tx.qty > 0 ? '+' : ''}{fmtNum(tx.qty)}
                      </td>
                      <td style={tdStyle}>{tx.unit_price != null ? fmtCHF(tx.unit_price) : '–'}</td>
                      <td style={tdStyle}>{tx.machine?.name || '–'}</td>
                      <td style={tdStyle}>{tx.task ? `${tx.task.code} ${tx.task.name}` : '–'}</td>
                      <td style={tdStyle}>{tx.reference || '–'}</td>
                      <td style={tdStyle}>{tx.user ? `${tx.user.first_name} ${tx.user.last_name}` : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ DETAIL / EDIT PANEL ════════════════════ */}
      {panelOpen && (
        <div ref={panelRef}>
          <button onClick={closeDetail} style={btnBack}>{t.back}</button>

          <div style={{
            padding: 24, borderRadius: 14,
            background: panelBg, border: `1px solid ${th.border}`,
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 16, flexWrap: 'wrap', gap: 8,
            }}>
              <h2 style={{ margin: 0, color: th.text }}>
                {editing ? (form.name || (selected ? selected.name : L.newPart)) : (selected?.name || '')}
              </h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selected && !editing && canConsume && (
                  <button onClick={() => {
                    setTxForm({ part_id: selected.id, type: 'CONSUME', qty: '', unit_price: '', reference: '', machine_id: '', task_id: '', notes: '' });
                    setShowTxModal(true);
                  }} style={{ ...btnPrimary, background: '#e74c3c', color: '#fff' }}>
                    📤 {L.consume}
                  </button>
                )}
                {selected && !editing && canEdit && (
                  <button onClick={() => {
                    setTxForm({ part_id: selected.id, type: 'PURCHASE', qty: '', unit_price: String(selected.unit_price || ''), reference: '', machine_id: '', task_id: '', notes: '' });
                    setShowTxModal(true);
                  }} style={{ ...btnPrimary, background: '#27ae60', color: '#fff' }}>
                    📥 {L.purchase}
                  </button>
                )}
                {selected && !editing && canEdit && (
                  <button onClick={() => { setForm(partToForm(selected)); setEditing(true); }} style={btnPrimary}>{t.edit}</button>
                )}
                {selected && !editing && canDelete && (
                  confirmDelete ? (
                    <>
                      <span style={{ color: th.text, alignSelf: 'center', fontSize: 13 }}>{t.confirmDelete}</span>
                      <button onClick={deletePart} style={btnDanger}>{t.yes}</button>
                      <button onClick={() => setConfirmDelete(false)} style={btnSecondary}>{t.no}</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDelete(true)} style={btnDanger}>{t.delete}</button>
                  )
                )}
                {editing && (
                  <>
                    <button onClick={savePart} style={btnPrimary}>{t.save}</button>
                    <button onClick={() => {
                      if (selected) { setForm(partToForm(selected)); setEditing(false); }
                      else closeDetail();
                    }} style={btnSecondary}>{t.cancel}</button>
                  </>
                )}
              </div>
            </div>

            {/* Stock badges (view mode) */}
            {selected && !editing && (() => {
              const isLow = selected.stock_qty > 0 && selected.stock_qty <= selected.min_qty;
              const isOut = selected.stock_qty <= 0;
              const stockColor = isOut ? '#e74c3c' : isLow ? '#f39c12' : '#27ae60';
              return (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                  <div style={{ ...cardStyle, borderColor: stockColor }}>
                    <div style={{ fontSize: 11, color: dimText }}>{L.stockQty}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: stockColor }}>
                      {fmtNum(selected.stock_qty)} <span style={{ fontSize: 14 }}>{selected.unit}</span>
                    </div>
                  </div>
                  <div style={cardStyle}>
                    <div style={{ fontSize: 11, color: dimText }}>{L.minQty}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: th.text }}>{fmtNum(selected.min_qty)}</div>
                  </div>
                  <div style={cardStyle}>
                    <div style={{ fontSize: 11, color: dimText }}>{L.reorderQty}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: th.text }}>{fmtNum(selected.reorder_qty)}</div>
                  </div>
                  <div style={cardStyle}>
                    <div style={{ fontSize: 11, color: dimText }}>{L.unitPrice}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: th.text }}>{fmtCHF(selected.unit_price)}</div>
                  </div>
                  <div style={cardStyle}>
                    <div style={{ fontSize: 11, color: dimText }}>{L.totalValue}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: th.text }}>
                      {fmtCHF(selected.stock_qty * selected.unit_price)}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${th.border}` }}>
              {(['general', 'stock', 'history'] as const).map(tb => (
                <button key={tb} onClick={() => setTab(tb)} style={tabBtnStyle(tab === tb)}>
                  {tb === 'general' ? t.general : tb === 'stock' ? L.stockQty : L.stockHistory}
                </button>
              ))}
            </div>

            {/* ── General Tab ── */}
            {tab === 'general' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {([
                  ['part_number', L.partNumber, 'text'],
                  ['name', t.name, 'text'],
                  ['description', t.description, 'text'],
                  ['category', t.category, 'select-category'],
                  ['unit', L.unit, 'select-unit'],
                  ['location', L.location, 'text'],
                  ['supplier', L.supplier, 'text'],
                  ['supplier_ref', L.supplierRef, 'text'],
                  ['unit_price', L.unitPrice, 'number'],
                  ['qr_code', L.qrCode, 'text'],
                  ['machine_id', L.linkedMachine, 'select-machine'],
                  ['auto_reorder', L.autoReorder, 'checkbox'],
                ] as [string, string, string][]).map(([key, label, inputType]) => (
                  <div key={key} style={inputType === 'checkbox' ? { display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 } : {}}>
                    {inputType !== 'checkbox' && <label style={labelStyle}>{label}</label>}
                    {editing ? (
                      inputType === 'select-category' ? (
                        <select value={(form as any)[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} style={selectStyle}>
                          {PART_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : inputType === 'select-unit' ? (
                        <select value={(form as any)[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} style={selectStyle}>
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      ) : inputType === 'select-machine' ? (
                        <select value={(form as any)[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} style={selectStyle}>
                          <option value="">–</option>
                          {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      ) : inputType === 'checkbox' ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: th.text, fontWeight: 600 }}>
                          <input type="checkbox" checked={!!(form as any)[key]}
                            onChange={e => setForm({ ...form, [key]: e.target.checked })} />
                          {label}
                        </label>
                      ) : inputType === 'number' ? (
                        <input type="number" step="0.01" value={(form as any)[key] ?? ''}
                          onChange={e => setForm({ ...form, [key]: e.target.value ? parseFloat(e.target.value) : 0 })}
                          style={inputStyle} />
                      ) : (
                        <input value={(form as any)[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} style={inputStyle} />
                      )
                    ) : inputType === 'checkbox' ? (
                      <span style={{ color: th.text, fontWeight: 600 }}>
                        {(selected as any)?.[key] ? '✅ ' : '❌ '}{label}
                      </span>
                    ) : (
                      <p style={{ margin: '4px 0 0', color: th.text, fontSize: 14 }}>
                        {key === 'machine_id'
                          ? (selected?.machine ? `🚜 ${selected.machine.name}` : '–')
                          : (selected as any)?.[key] || '–'}
                      </p>
                    )}
                  </div>
                ))}

                {/* Notes (full width) */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>{t.notes || 'Notes'}</label>
                  {editing ? (
                    <textarea value={form.notes || ''} rows={3}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      style={{ ...inputStyle, resize: 'vertical' }} />
                  ) : (
                    <p style={{ margin: '4px 0 0', color: th.text, fontSize: 14, whiteSpace: 'pre-wrap' }}>
                      {selected?.notes || '–'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Stock Tab ── */}
            {tab === 'stock' && (
              <div>
                {editing ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={labelStyle}>{L.stockQty}</label>
                      <input type="number" step="any" value={form.stock_qty ?? ''}
                        onChange={e => setForm({ ...form, stock_qty: parseFloat(e.target.value) || 0 })}
                        style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>{L.minQty}</label>
                      <input type="number" step="any" value={form.min_qty ?? ''}
                        onChange={e => setForm({ ...form, min_qty: parseFloat(e.target.value) || 0 })}
                        style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>{L.reorderQty}</label>
                      <input type="number" step="any" value={form.reorder_qty ?? ''}
                        onChange={e => setForm({ ...form, reorder_qty: parseFloat(e.target.value) || 0 })}
                        style={inputStyle} />
                    </div>
                  </div>
                ) : (
                  <p style={{ color: dimText, textAlign: 'center', padding: 20 }}>
                    {t.logStockTabHint || 'Use the Consume / Purchase buttons above to record stock movements. Edit to change thresholds.'}
                  </p>
                )}
              </div>
            )}

            {/* ── History Tab ── */}
            {tab === 'history' && (
              <div>
                {transactions.length === 0 ? (
                  <p style={{ color: dimText, textAlign: 'center', padding: 20 }}>{L.noTransactions}</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr>
                          {[t.date || 'Date', t.type || 'Type', L.qty, L.unitPrice, L.reference, L.machine, t.users || 'User'].map(h => (
                            <th key={h} style={thStyle}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map(tx => (
                          <tr key={tx.id}>
                            <td style={tdStyle}>{new Date(tx.created_at).toLocaleString('de-CH')}</td>
                            <td style={tdStyle}>
                              <span style={{
                                padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                background: `${TX_COLORS[tx.type]}22`, color: TX_COLORS[tx.type],
                              }}>
                                {TX_ICONS[tx.type]} {tx.type}
                              </span>
                            </td>
                            <td style={{ ...tdStyle, fontWeight: 700, color: tx.qty < 0 ? '#e74c3c' : '#27ae60' }}>
                              {tx.qty > 0 ? '+' : ''}{fmtNum(tx.qty)}
                            </td>
                            <td style={tdStyle}>{tx.unit_price != null ? fmtCHF(tx.unit_price) : '–'}</td>
                            <td style={tdStyle}>{tx.reference || '–'}</td>
                            <td style={tdStyle}>{tx.machine?.name || '–'}</td>
                            <td style={tdStyle}>{tx.user ? `${tx.user.first_name} ${tx.user.last_name}` : '–'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
