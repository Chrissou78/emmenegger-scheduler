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

interface InventoryLine {
  part: SparePart;
  systemQty: number;
  countedQty: number;
  difference: number;
  touched: boolean;
  notes: string;
}

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
    { key: 'part_number', label: t.logPartNumber },
    { key: 'name',        label: t.name },
    { key: 'category',    label: t.category },
    { key: 'unit',        label: t.logUnit },
    { key: 'stock_qty',   label: t.logStockQty },
    { key: 'min_qty',     label: t.logMinQty },
    { key: 'reorder_qty', label: t.logReorderQty },
    { key: 'location',    label: t.logLocation },
    { key: 'supplier',    label: t.logSupplier },
    { key: 'supplier_ref',label: t.logSupplierRef },
    { key: 'unit_price',  label: t.logUnitPrice },
    { key: 'qr_code',     label: t.logQrCode },
    { key: 'auto_reorder',label: t.logAutoReorder },
    { key: 'notes',       label: t.notes },
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

  /* ── section state ── */
  type Section = 'logistics' | 'spare-parts' | 'inventory';
  const [section, setSection] = useState<Section>('logistics');

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

  /* ── inventory state ── */
  const [inventoryLines, setInventoryLines] = useState<InventoryLine[]>([]);
  const [invSearch, setInvSearch] = useState('');
  const [invFilterCat, setInvFilterCat] = useState('');
  const [invFilter, setInvFilter] = useState<'' | 'counted' | 'uncounted' | 'discrepancy'>('');
  const [invSaving, setInvSaving] = useState(false);
  const [invConfirm, setInvConfirm] = useState(false);
  const [invSummary, setInvSummary] = useState<{ adjusted: number; valueDiff: number } | null>(null);

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
  const sectionBtn = (active: boolean): React.CSSProperties => ({
    padding: '10px 22px', borderRadius: 10, border: 'none',
    background: active ? th.gold : (isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)'),
    color: active ? '#000' : th.text, fontWeight: 700, cursor: 'pointer', fontSize: 15,
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
    } catch { showToast(t.error, 'err'); }
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
        throw new Error(err.error || t.error);
      }
      showToast(t.saved);
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
      showToast(t.saved);
      closeDetail();
      fetchParts();
      fetchStats();
    } catch { showToast(t.error, 'err'); }
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
        showToast(t.logQtyRequired, 'err');
        return;
      }
      const res = await fetch(`${API}/api/v1/logistics/transactions`, {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t.error);
      }
      showToast(t.success);
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
      showToast(t.saved);
    } catch { showToast(t.error, 'err'); }
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
      showToast(`${json.imported} ${t.imported}`);
      fetchParts();
      fetchStats();
    } catch { showToast(t.error, 'err'); }
  }

  /* ── inventory helpers ── */
  function startInventory() {
    const lines: InventoryLine[] = allParts.map(p => ({
      part: p,
      systemQty: p.stock_qty,
      countedQty: p.stock_qty,
      difference: 0,
      touched: false,
      notes: '',
    }));
    setInventoryLines(lines);
    setInvSearch('');
    setInvFilterCat('');
    setInvFilter('');
    setInvSaving(false);
    setInvConfirm(false);
    setInvSummary(null);
    setSection('inventory');
  }

  function updateInventoryLine(partId: string, countedQty: number) {
    setInventoryLines(prev => prev.map(line =>
      line.part.id === partId
        ? { ...line, countedQty, difference: countedQty - line.systemQty, touched: true }
        : line
    ));
  }

  function updateInventoryNote(partId: string, notes: string) {
    setInventoryLines(prev => prev.map(line =>
      line.part.id === partId ? { ...line, notes } : line
    ));
  }

  function markAllUncountedAsOk() {
    setInventoryLines(prev => prev.map(line =>
      line.touched ? line : { ...line, touched: true, countedQty: line.systemQty, difference: 0 }
    ));
  }

  async function submitInventory() {
    setInvSaving(true);
    try {
      const discrepancies = inventoryLines.filter(l => l.touched && l.difference !== 0);
      let adjusted = 0;
      let valueDiff = 0;

      for (const line of discrepancies) {
        const adjustQty = line.difference;
        const body = {
          part_id: line.part.id,
          type: adjustQty < 0 ? 'CONSUME' : 'ADJUST',
          qty: Math.abs(adjustQty),
          reference: 'Inventory count adjustment',
          notes: line.notes || `Inventory: system=${fmtNum(line.systemQty)}, counted=${fmtNum(line.countedQty)}`,
        };

        const res = await fetch(`${API}/api/v1/logistics/transactions`, {
          method: 'POST', headers, body: JSON.stringify(body),
        });

        if (res.ok) {
          adjusted++;
          valueDiff += line.difference * line.part.unit_price;
        }
      }

      setInvSummary({ adjusted, valueDiff });
      showToast(`${adjusted} ${t.logPartsAdjusted}`);
      fetchParts();
      fetchStats();
    } catch { showToast(t.error, 'err'); }
    finally { setInvSaving(false); setInvConfirm(false); }
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

  /* ── inventory derived ── */
  const filteredInvLines = useMemo(() => {
    let list = inventoryLines;
    if (invSearch) {
      const q = invSearch.toLowerCase();
      list = list.filter(l =>
        l.part.name.toLowerCase().includes(q) ||
        l.part.part_number.toLowerCase().includes(q) ||
        (l.part.location || '').toLowerCase().includes(q)
      );
    }
    if (invFilterCat) list = list.filter(l => l.part.category === invFilterCat);
    if (invFilter === 'counted') list = list.filter(l => l.touched);
    if (invFilter === 'uncounted') list = list.filter(l => !l.touched);
    if (invFilter === 'discrepancy') list = list.filter(l => l.touched && l.difference !== 0);
    return list;
  }, [inventoryLines, invSearch, invFilterCat, invFilter]);

  const invStats = useMemo(() => {
    const total = inventoryLines.length;
    const counted = inventoryLines.filter(l => l.touched).length;
    const uncounted = total - counted;
    const discrepancies = inventoryLines.filter(l => l.touched && l.difference !== 0).length;
    const valueDiff = inventoryLines
      .filter(l => l.touched && l.difference !== 0)
      .reduce((sum, l) => sum + l.difference * l.part.unit_price, 0);
    return { total, counted, uncounted, discrepancies, valueDiff };
  }, [inventoryLines]);

  /* ── logistics overview derived ── */
  const reorderParts = useMemo(() =>
    allParts.filter(p => p.stock_qty <= p.min_qty && p.min_qty > 0)
      .sort((a, b) => (a.stock_qty / (a.min_qty || 1)) - (b.stock_qty / (b.min_qty || 1))),
  [allParts]);

  const machineLinkedParts = useMemo(() =>
    allParts.filter(p => p.machine).reduce<Record<string, SparePart[]>>((acc, p) => {
      const mName = p.machine?.name || 'Unknown';
      (acc[mName] = acc[mName] || []).push(p);
      return acc;
    }, {}),
  [allParts]);

  const supplierGroups = useMemo(() =>
    allParts.filter(p => p.supplier).reduce<Record<string, { count: number; value: number }>>((acc, p) => {
      const s = p.supplier!;
      if (!acc[s]) acc[s] = { count: 0, value: 0 };
      acc[s].count++;
      acc[s].value += p.stock_qty * p.unit_price;
      return acc;
    }, {}),
  [allParts]);

  const locationGroups = useMemo(() =>
    allParts.filter(p => p.location).reduce<Record<string, number>>((acc, p) => {
      acc[p.location!] = (acc[p.location!] || 0) + 1;
      return acc;
    }, {}),
  [allParts]);

  if (!canView) return null;

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
            <h3 style={{ margin: '0 0 20px', color: th.text }}>{t.logRecordTx}</h3>

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={labelStyle}>{t.logSpareParts}</label>
                <select value={txForm.part_id} onChange={e => setTxForm({ ...txForm, part_id: e.target.value })} style={selectStyle}>
                  <option value="">–</option>
                  {allParts.map(p => (
                    <option key={p.id} value={p.id}>{p.part_number} — {p.name} ({fmtNum(p.stock_qty)} {p.unit})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t.type}</label>
                <select value={txForm.type} onChange={e => setTxForm({ ...txForm, type: e.target.value })} style={selectStyle}>
                  {TX_TYPES.map(tp => (
                    <option key={tp} value={tp}>
                      {TX_ICONS[tp]} {tp === 'CONSUME' ? t.logConsume : tp === 'PURCHASE' ? t.logPurchase : tp === 'ADJUST' ? t.logAdjust : t.logReturn}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>{t.logQty}</label>
                  <input type="number" min="0" step="any" value={txForm.qty}
                    onChange={e => setTxForm({ ...txForm, qty: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>{t.logUnitPrice}</label>
                  <input type="number" min="0" step="0.01" value={txForm.unit_price}
                    onChange={e => setTxForm({ ...txForm, unit_price: e.target.value })} style={inputStyle}
                    placeholder="CHF" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>{t.logMachine}</label>
                <select value={txForm.machine_id} onChange={e => setTxForm({ ...txForm, machine_id: e.target.value })} style={selectStyle}>
                  <option value="">–</option>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t.logTask}</label>
                <select value={txForm.task_id} onChange={e => setTxForm({ ...txForm, task_id: e.target.value })} style={selectStyle}>
                  <option value="">–</option>
                  {tasks.map(tk => <option key={tk.id} value={tk.id}>{tk.code} — {tk.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t.logReference}</label>
                <input value={txForm.reference}
                  onChange={e => setTxForm({ ...txForm, reference: e.target.value })} style={inputStyle}
                  placeholder="PO / Job # / Notes" />
              </div>
              <div>
                <label style={labelStyle}>{t.notes}</label>
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

      {/* ── Section Tabs ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => setSection('logistics')} style={sectionBtn(section === 'logistics')}>
          🏭 {t.logLogistics}
        </button>
        <button onClick={() => setSection('spare-parts')} style={sectionBtn(section === 'spare-parts')}>
          🔧 {t.logSpareParts}
        </button>
        <button onClick={() => { if (inventoryLines.length === 0) startInventory(); else setSection('inventory'); }}
          style={sectionBtn(section === 'inventory')}>
          📋 {t.logInventory}
        </button>
      </div>

      {/* ████████████████████ SECTION: LOGISTICS ████████████████████ */}
      {section === 'logistics' && (
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 26, color: th.text }}>{t.logOverview}</h1>
          <p style={{ margin: '0 0 24px', color: dimText, fontSize: 14 }}>{t.logOverviewDesc}</p>

          {/* KPI Cards */}
          {stats && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
              {[
                { label: t.logTotalParts, value: String(stats.totalParts), icon: '📦' },
                { label: t.logTotalValue, value: fmtCHF(stats.totalValue), icon: '💰' },
                { label: t.logLowStock, value: String(stats.lowStock), icon: '⚠️', warn: stats.lowStock > 0 },
                { label: t.logOutOfStock, value: String(stats.outOfStock), icon: '🔴', warn: stats.outOfStock > 0 },
                { label: t.logOpenAlerts, value: String(stats.openAlerts), icon: '🔔', warn: stats.openAlerts > 0 },
                { label: t.logConsumed30d, value: fmtNum(stats.consumed30d), icon: '📤' },
                { label: t.logPurchased30d, value: fmtNum(stats.purchased30d), icon: '📥' },
                { label: t.logSpent30d, value: fmtCHF(stats.spentValue30d), icon: '🧾' },
              ].map(c => (
                <div key={c.label} style={{
                  ...cardStyle, borderColor: c.warn ? '#e74c3c' : th.border,
                }}>
                  <div style={{ fontSize: 22 }}>{c.icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c.warn ? '#e74c3c' : th.text }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: dimText, marginTop: 2 }}>{c.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Pending Reorders */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ margin: '0 0 12px', color: th.text }}>⚠️ {t.logPendingReorders} ({reorderParts.length})</h3>
            {reorderParts.length === 0 ? (
              <p style={{ color: dimText }}>{t.logAllAboveMin}</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr>
                      {[t.logPartNumber, t.name, t.logStockQty, t.logMinQty, t.logReorderQty, t.logSupplier, t.status].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reorderParts.map(p => {
                      const isOut = p.stock_qty <= 0;
                      return (
                        <tr key={p.id} onClick={() => { setSection('spare-parts'); setTimeout(() => openDetail(p), 100); }}
                          style={{ cursor: 'pointer', transition: 'background .15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ ...tdStyle, fontFamily: 'monospace', color: th.text, fontWeight: 600 }}>{p.part_number}</td>
                          <td style={{ ...tdStyle, color: th.text, fontWeight: 600 }}>{p.name}</td>
                          <td style={{ ...tdStyle, fontWeight: 700, color: isOut ? '#e74c3c' : '#f39c12' }}>
                            {fmtNum(p.stock_qty)} {p.unit}
                          </td>
                          <td style={tdStyle}>{fmtNum(p.min_qty)}</td>
                          <td style={tdStyle}>{fmtNum(p.reorder_qty)}</td>
                          <td style={tdStyle}>{p.supplier || '–'}</td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${th.border}` }}>
                            <span style={{
                              padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                              background: isOut ? '#e74c3c22' : '#f39c1222',
                              color: isOut ? '#e74c3c' : '#f39c12',
                            }}>
                              {isOut ? `🔴 ${t.logOutOfStock}` : `⚠️ ${t.logLowStock}`}
                            </span>
                            {p.auto_reorder && (
                              <span style={{
                                display: 'inline-block', marginLeft: 6, padding: '2px 8px',
                                borderRadius: 20, fontSize: 11, fontWeight: 600,
                                background: '#3498db22', color: '#3498db',
                              }}>🔄 Auto</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Machine-Linked Parts */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ margin: '0 0 12px', color: th.text }}>🚜 {t.logPartsByMachine}</h3>
            {Object.keys(machineLinkedParts).length === 0 ? (
              <p style={{ color: dimText }}>{t.logNoMachineLinked}</p>
            ) : (
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                {Object.entries(machineLinkedParts).map(([machineName, mParts]) => (
                  <div key={machineName} style={{
                    padding: 16, borderRadius: 12, border: `1px solid ${th.border}`,
                    background: isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.01)',
                  }}>
                    <div style={{ fontWeight: 700, color: th.text, marginBottom: 8 }}>🚜 {machineName}</div>
                    {mParts.map(p => {
                      const isLow = p.stock_qty > 0 && p.stock_qty <= p.min_qty;
                      const isOut = p.stock_qty <= 0;
                      const color = isOut ? '#e74c3c' : isLow ? '#f39c12' : '#27ae60';
                      return (
                        <div key={p.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 0', borderBottom: `1px solid ${th.border}`,
                        }}>
                          <span style={{ fontSize: 13, color: th.text }}>{p.part_number} — {p.name}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color }}>{fmtNum(p.stock_qty)} {p.unit}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Supplier Overview */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ margin: '0 0 12px', color: th.text }}>🏢 {t.logSupplierOverview}</h3>
            {Object.keys(supplierGroups).length === 0 ? (
              <p style={{ color: dimText }}>{t.logNoSupplierData}</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr>
                      {[t.logSupplier, t.logPartsCol, t.logStockValue].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(supplierGroups)
                      .sort(([, a], [, b]) => b.value - a.value)
                      .map(([name, data]) => (
                        <tr key={name}>
                          <td style={{ ...tdStyle, color: th.text, fontWeight: 600 }}>{name}</td>
                          <td style={tdStyle}>{data.count}</td>
                          <td style={tdStyle}>{fmtCHF(data.value)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Storage Locations */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ margin: '0 0 12px', color: th.text }}>📍 {t.logStorageLocations}</h3>
            {Object.keys(locationGroups).length === 0 ? (
              <p style={{ color: dimText }}>{t.logNoLocationData}</p>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {Object.entries(locationGroups)
                  .sort(([, a], [, b]) => b - a)
                  .map(([loc, count]) => (
                    <div key={loc} style={{
                      padding: '10px 16px', borderRadius: 10, border: `1px solid ${th.border}`,
                      background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)',
                    }}>
                      <div style={{ fontWeight: 600, color: th.text, fontSize: 13 }}>📍 {loc}</div>
                      <div style={{ fontSize: 12, color: dimText }}>{count} {t.logParts}</div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div style={{
            padding: 20, borderRadius: 12, border: `1px solid ${th.border}`,
            background: isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.01)',
            display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <span style={{ fontWeight: 700, color: th.text }}>{t.logQuickActions}:</span>
            <button onClick={() => setSection('spare-parts')} style={btnSecondary}>📦 {t.logViewAllParts}</button>
            <button onClick={() => { setSection('spare-parts'); setView('alerts'); fetchAlerts(); }} style={btnSecondary}>
              🔔 {t.logViewAlerts} {stats && stats.openAlerts > 0 && `(${stats.openAlerts})`}
            </button>
            {canConsume && (
              <button onClick={() => {
                setTxForm({ part_id: '', type: 'CONSUME', qty: '', unit_price: '', reference: '', machine_id: '', task_id: '', notes: '' });
                setShowTxModal(true);
              }} style={{ ...btnPrimary, background: '#e74c3c', color: '#fff' }}>
                📤 {t.logRecordTx}
              </button>
            )}
            {canEdit && (
              <button onClick={startInventory} style={{ ...btnPrimary, background: '#9b59b6', color: '#fff' }}>
                📋 {t.logStartInventory}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ████████████████████ SECTION: SPARE PARTS ████████████████████ */}
      {section === 'spare-parts' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, color: th.text }}>{t.logSparePartsManagement}</h1>
              {stats && (
                <p style={{ margin: '4px 0 0', color: dimText, fontSize: 14 }}>
                  {t.total}: {stats.totalParts} · {t.logLowStock}: {stats.lowStock} · {t.logOpenAlerts}: {stats.openAlerts}
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
                        📤 {t.logRecordTx}
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

          {/* Stats Cards */}
          {stats && !panelOpen && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              {[
                { label: t.total, value: String(stats.totalParts), icon: '📦' },
                { label: t.logTotalValue, value: fmtCHF(stats.totalValue), icon: '💰' },
                { label: t.logLowStock, value: String(stats.lowStock), icon: '⚠️', warn: stats.lowStock > 0 },
                { label: t.logOutOfStock, value: String(stats.outOfStock), icon: '🔴', warn: stats.outOfStock > 0 },
                { label: t.logConsumed30d, value: fmtNum(stats.consumed30d), icon: '📤' },
                { label: t.logPurchased30d, value: fmtNum(stats.purchased30d), icon: '📥' },
                { label: t.logSpent30d, value: fmtCHF(stats.spentValue30d), icon: '🧾' },
                { label: t.logOpenAlerts, value: String(stats.openAlerts), icon: '🔔', warn: stats.openAlerts > 0 },
              ].map(c => (
                <div key={c.label} style={{
                  ...cardStyle, borderColor: c.warn ? '#e74c3c' : th.border,
                }}>
                  <div style={{ fontSize: 22 }}>{c.icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c.warn ? '#e74c3c' : th.text }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: dimText, marginTop: 2 }}>{c.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* View Tabs */}
          {!panelOpen && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={() => setView('list')} style={viewBtn(view === 'list')}>📦 {t.logSpareParts}</button>
              <button onClick={() => { setView('alerts'); fetchAlerts(); }} style={viewBtn(view === 'alerts')}>
                🔔 {t.logAlerts} {stats && stats.openAlerts > 0 && (
                  <span style={{
                    display: 'inline-block', padding: '1px 7px', borderRadius: 10,
                    background: '#e74c3c', color: '#fff', fontSize: 11, fontWeight: 700, marginLeft: 6,
                  }}>{stats.openAlerts}</span>
                )}
              </button>
              <button onClick={() => { setView('transactions'); fetchTransactions(); }} style={viewBtn(view === 'transactions')}>
                📋 {t.logTransactions}
              </button>
            </div>
          )}

          {/* ════════════════════ LIST VIEW ════════════════════ */}
          {view === 'list' && !panelOpen && (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                <input placeholder={t.search} value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  style={{ ...inputStyle, maxWidth: 260 }} />
                <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1); }} style={{ ...selectStyle, maxWidth: 200 }}>
                  <option value="">{t.logAllCategories}</option>
                  {usedCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filterStock} onChange={e => { setFilterStock(e.target.value as any); setPage(1); }} style={{ ...selectStyle, maxWidth: 200 }}>
                  <option value="">{t.logAllStock}</option>
                  <option value="low">⚠️ {t.logLowStock}</option>
                  <option value="out">🔴 {t.logOutOfStock}</option>
                </select>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: dimText }}>⏳ {t.loading}</div>
              ) : parts.length === 0 ? (
                <p style={{ color: dimText, textAlign: 'center', padding: 40 }}>{t.logNoParts}</p>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr>
                          {[t.logPartNumber, t.name, t.category, t.logStockQty, t.logMinQty, t.logLocation, t.logSupplier, t.logUnitPrice, t.status].map(h => (
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
                                  {isOut ? `🔴 ${t.logOutOfStock}` : isLow ? `⚠️ ${t.logLowStock}` : '✅ OK'}
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
                <p style={{ color: dimText, textAlign: 'center', padding: 40 }}>{t.logNoAlerts}</p>
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
                            {a.part?.part_number} · {t.logStockQty}: {fmtNum(a.part?.stock_qty ?? 0)} · {t.logMinQty}: {fmtNum(a.part?.min_qty ?? 0)}
                            {a.part?.supplier && ` · ${t.logSupplier}: ${a.part.supplier}`}
                          </div>
                          <div style={{ fontSize: 11, color: dimText }}>
                            {new Date(a.created_at).toLocaleString('de-CH')}
                          </div>
                        </div>
                      </div>
                      {canEdit && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => updateAlert(a.id, 'ACKNOWLEDGED')} style={btnSecondary}>
                            {t.logAcknowledge}
                          </button>
                          <button onClick={() => updateAlert(a.id, 'RESOLVED')} style={btnPrimary}>
                            {t.logResolve}
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
                <p style={{ color: dimText, textAlign: 'center', padding: 40 }}>{t.logNoTransactions}</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr>
                        {[t.date, t.type, t.logSpareParts, t.logQty, t.logUnitPrice, t.logMachine, t.logTask, t.logReference, t.users].map(h => (
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
                    {editing ? (form.name || (selected ? selected.name : t.logNewPart)) : (selected?.name || '')}
                  </h2>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selected && !editing && canConsume && (
                      <button onClick={() => {
                        setTxForm({ part_id: selected.id, type: 'CONSUME', qty: '', unit_price: '', reference: '', machine_id: '', task_id: '', notes: '' });
                        setShowTxModal(true);
                      }} style={{ ...btnPrimary, background: '#e74c3c', color: '#fff' }}>
                        📤 {t.logConsume}
                      </button>
                    )}
                    {selected && !editing && canEdit && (
                      <button onClick={() => {
                        setTxForm({ part_id: selected.id, type: 'PURCHASE', qty: '', unit_price: String(selected.unit_price || ''), reference: '', machine_id: '', task_id: '', notes: '' });
                        setShowTxModal(true);
                      }} style={{ ...btnPrimary, background: '#27ae60', color: '#fff' }}>
                        📥 {t.logPurchase}
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
                        <div style={{ fontSize: 11, color: dimText }}>{t.logStockQty}</div>
                        <div style={{ fontSize: 26, fontWeight: 700, color: stockColor }}>
                          {fmtNum(selected.stock_qty)} <span style={{ fontSize: 14 }}>{selected.unit}</span>
                        </div>
                      </div>
                      <div style={cardStyle}>
                        <div style={{ fontSize: 11, color: dimText }}>{t.logMinQty}</div>
                        <div style={{ fontSize: 26, fontWeight: 700, color: th.text }}>{fmtNum(selected.min_qty)}</div>
                      </div>
                      <div style={cardStyle}>
                        <div style={{ fontSize: 11, color: dimText }}>{t.logReorderQty}</div>
                        <div style={{ fontSize: 26, fontWeight: 700, color: th.text }}>{fmtNum(selected.reorder_qty)}</div>
                      </div>
                      <div style={cardStyle}>
                        <div style={{ fontSize: 11, color: dimText }}>{t.logUnitPrice}</div>
                        <div style={{ fontSize: 26, fontWeight: 700, color: th.text }}>{fmtCHF(selected.unit_price)}</div>
                      </div>
                      <div style={cardStyle}>
                        <div style={{ fontSize: 11, color: dimText }}>{t.logTotalValue}</div>
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
                      {tb === 'general' ? t.general : tb === 'stock' ? t.logStockQty : t.logStockHistory}
                    </button>
                  ))}
                </div>

                {/* ── General Tab ── */}
                {tab === 'general' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {([
                      ['part_number', t.logPartNumber, 'text'],
                      ['name', t.name, 'text'],
                      ['description', t.description, 'text'],
                      ['category', t.category, 'select-category'],
                      ['unit', t.logUnit, 'select-unit'],
                      ['location', t.logLocation, 'text'],
                      ['supplier', t.logSupplier, 'text'],
                      ['supplier_ref', t.logSupplierRef, 'text'],
                      ['unit_price', t.logUnitPrice, 'number'],
                      ['qr_code', t.logQrCode, 'text'],
                      ['machine_id', t.logLinkedMachine, 'select-machine'],
                      ['auto_reorder', t.logAutoReorder, 'checkbox'],
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

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>{t.notes}</label>
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
                          <label style={labelStyle}>{t.logStockQty}</label>
                          <input type="number" step="any" value={form.stock_qty ?? ''}
                            onChange={e => setForm({ ...form, stock_qty: parseFloat(e.target.value) || 0 })}
                            style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>{t.logMinQty}</label>
                          <input type="number" step="any" value={form.min_qty ?? ''}
                            onChange={e => setForm({ ...form, min_qty: parseFloat(e.target.value) || 0 })}
                            style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>{t.logReorderQty}</label>
                          <input type="number" step="any" value={form.reorder_qty ?? ''}
                            onChange={e => setForm({ ...form, reorder_qty: parseFloat(e.target.value) || 0 })}
                            style={inputStyle} />
                        </div>
                      </div>
                    ) : (
                      <p style={{ color: dimText, textAlign: 'center', padding: 20 }}>
                        {t.logStockTabHint}
                      </p>
                    )}
                  </div>
                )}

                {/* ── History Tab ── */}
                {tab === 'history' && (
                  <div>
                    {transactions.length === 0 ? (
                      <p style={{ color: dimText, textAlign: 'center', padding: 20 }}>{t.logNoTransactions}</p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                          <thead>
                            <tr>
                              {[t.date, t.type, t.logQty, t.logUnitPrice, t.logReference, t.logMachine, t.users].map(h => (
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
      )}

      {/* ████████████████████ SECTION: INVENTORY ████████████████████ */}
      {section === 'inventory' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, color: th.text }}>{t.logInventoryCount}</h1>
              <p style={{ margin: '4px 0 0', color: dimText, fontSize: 14 }}>{t.logInventoryDesc}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => {
                setInventoryLines([]);
                setInvSummary(null);
                setSection('logistics');
              }} style={btnSecondary}>
                {t.logCancelInventory}
              </button>
              <button onClick={startInventory} style={btnSecondary}>
                🔄 {t.logResetCount}
              </button>
            </div>
          </div>

          {/* Summary shown after submission */}
          {invSummary && (
            <div style={{
              padding: 20, borderRadius: 12, marginBottom: 20,
              background: '#27ae6022', border: '1px solid #27ae60',
            }}>
              <h3 style={{ margin: '0 0 8px', color: '#27ae60' }}>✅ {t.logInventoryApplied}</h3>
              <p style={{ margin: 0, color: th.text }}>
                {invSummary.adjusted} {t.logPartsAdjusted} · {t.logValueDifference}: {fmtCHF(invSummary.valueDiff)}
              </p>
              <button onClick={() => { setSection('logistics'); setInventoryLines([]); setInvSummary(null); }}
                style={{ ...btnPrimary, marginTop: 12 }}>
                {t.logBackToLogistics}
              </button>
            </div>
          )}

          {!invSummary && (
            <>
              {/* Progress Cards */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                <div style={cardStyle}>
                  <div style={{ fontSize: 22 }}>📦</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: th.text }}>{invStats.total}</div>
                  <div style={{ fontSize: 11, color: dimText }}>{t.logTotalParts}</div>
                </div>
                <div style={{ ...cardStyle, borderColor: '#27ae60' }}>
                  <div style={{ fontSize: 22 }}>✅</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#27ae60' }}>{invStats.counted}</div>
                  <div style={{ fontSize: 11, color: dimText }}>{t.logCounted}</div>
                </div>
                <div style={{ ...cardStyle, borderColor: invStats.uncounted > 0 ? '#f39c12' : th.border }}>
                  <div style={{ fontSize: 22 }}>⏳</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: invStats.uncounted > 0 ? '#f39c12' : th.text }}>
                    {invStats.uncounted}
                  </div>
                  <div style={{ fontSize: 11, color: dimText }}>{t.logUncounted}</div>
                </div>
                <div style={{ ...cardStyle, borderColor: invStats.discrepancies > 0 ? '#e74c3c' : th.border }}>
                  <div style={{ fontSize: 22 }}>⚠️</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: invStats.discrepancies > 0 ? '#e74c3c' : th.text }}>
                    {invStats.discrepancies}
                  </div>
                  <div style={{ fontSize: 11, color: dimText }}>{t.logDiscrepancies}</div>
                </div>
                <div style={{ ...cardStyle, borderColor: invStats.valueDiff !== 0 ? '#e74c3c' : th.border }}>
                  <div style={{ fontSize: 22 }}>💰</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: invStats.valueDiff < 0 ? '#e74c3c' : invStats.valueDiff > 0 ? '#27ae60' : th.text }}>
                    {invStats.valueDiff >= 0 ? '+' : ''}{fmtCHF(invStats.valueDiff)}
                  </div>
                  <div style={{ fontSize: 11, color: dimText }}>{t.logValueDifference}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: dimText }}>{t.logProgress}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: th.text }}>
                    {invStats.total > 0 ? Math.round((invStats.counted / invStats.total) * 100) : 0}%
                  </span>
                </div>
                <div style={{
                  height: 8, borderRadius: 4,
                  background: isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 4, transition: 'width .3s',
                    background: invStats.counted === invStats.total ? '#27ae60' : th.gold,
                    width: `${invStats.total > 0 ? (invStats.counted / invStats.total) * 100 : 0}%`,
                  }} />
                </div>
              </div>

              {/* Filters & Actions */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
                <input placeholder={t.logSearchParts} value={invSearch}
                  onChange={e => setInvSearch(e.target.value)}
                  style={{ ...inputStyle, maxWidth: 260 }} />
                <select value={invFilterCat} onChange={e => setInvFilterCat(e.target.value)}
                  style={{ ...selectStyle, maxWidth: 200 }}>
                  <option value="">{t.logAllCategories}</option>
                  {usedCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={invFilter} onChange={e => setInvFilter(e.target.value as any)}
                  style={{ ...selectStyle, maxWidth: 200 }}>
                  <option value="">{t.logAllItems}</option>
                  <option value="counted">✅ {t.logCounted}</option>
                  <option value="uncounted">⏳ {t.logUncounted}</option>
                  <option value="discrepancy">⚠️ {t.logDiscrepancies}</option>
                </select>
                <div style={{ flex: 1 }} />
                {invStats.uncounted > 0 && (
                  <button onClick={markAllUncountedAsOk} style={btnSecondary}>
                    {t.logMarkAllOk}
                  </button>
                )}
                {invStats.counted > 0 && (
                  invConfirm ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ color: '#e74c3c', fontWeight: 600, fontSize: 13 }}>
                        {t.logConfirmAdjustments} ({invStats.discrepancies})
                      </span>
                      <button onClick={submitInventory} disabled={invSaving}
                        style={{ ...btnPrimary, background: '#27ae60', color: '#fff', opacity: invSaving ? 0.6 : 1 }}>
                        {invSaving ? t.logApplying : t.confirm}
                      </button>
                      <button onClick={() => setInvConfirm(false)} style={btnSecondary}>{t.cancel}</button>
                    </div>
                  ) : (
                    <button onClick={() => setInvConfirm(true)}
                      style={{ ...btnPrimary, background: '#27ae60', color: '#fff' }}>
                      {t.logApplyAdjustments} ({invStats.discrepancies})
                    </button>
                  )
                )}
              </div>

              {/* Inventory Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr>
                      {[t.logPartNumber, t.name, t.category, t.logLocation, t.logSystemQty, t.logCountedQty, t.logDifference, t.notes, t.status].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvLines.map(line => {
                      const hasDiff = line.touched && line.difference !== 0;
                      const rowBg = hasDiff
                        ? (line.difference < 0 ? (isDark ? 'rgba(231,76,60,.1)' : 'rgba(231,76,60,.05)') : (isDark ? 'rgba(39,174,96,.1)' : 'rgba(39,174,96,.05)'))
                        : 'transparent';

                      return (
                        <tr key={line.part.id} style={{ background: rowBg }}>
                          <td style={{ ...tdStyle, fontFamily: 'monospace', color: th.text, fontWeight: 600 }}>
                            {line.part.part_number}
                          </td>
                          <td style={{ ...tdStyle, color: th.text, fontWeight: 600 }}>{line.part.name}</td>
                          <td style={tdStyle}>{line.part.category}</td>
                          <td style={tdStyle}>{line.part.location || '–'}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>
                            {fmtNum(line.systemQty)} {line.part.unit}
                          </td>
                          <td style={{ ...tdStyle, padding: '6px 8px' }}>
                            <input type="number" step="any" min="0"
                              value={line.touched ? line.countedQty : ''}
                              placeholder={fmtNum(line.systemQty)}
                              onChange={e => {
                                const val = e.target.value === '' ? line.systemQty : parseFloat(e.target.value) || 0;
                                updateInventoryLine(line.part.id, val);
                              }}
                              style={{
                                ...inputStyle,
                                width: 100,
                                textAlign: 'center',
                                fontWeight: 700,
                                background: line.touched ? (hasDiff ? (line.difference < 0 ? '#e74c3c11' : '#27ae6011') : '#27ae6011') : inputBg,
                                borderColor: line.touched ? (hasDiff ? (line.difference < 0 ? '#e74c3c' : '#27ae60') : '#27ae60') : th.border,
                              }} />
                          </td>
                          <td style={{
                            ...tdStyle, fontWeight: 700,
                            color: !line.touched ? dimText : line.difference < 0 ? '#e74c3c' : line.difference > 0 ? '#27ae60' : dimText,
                          }}>
                            {line.touched ? (
                              `${line.difference >= 0 ? '+' : ''}${fmtNum(line.difference)} ${line.part.unit}`
                            ) : '–'}
                          </td>
                          <td style={{ ...tdStyle, padding: '6px 8px' }}>
                            <input value={line.notes}
                              onChange={e => updateInventoryNote(line.part.id, e.target.value)}
                              placeholder={t.notes}
                              style={{ ...inputStyle, width: 140, fontSize: 12 }} />
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${th.border}` }}>
                            {!line.touched ? (
                              <span style={{ fontSize: 12, color: dimText }}>⏳ {t.logPending}</span>
                            ) : hasDiff ? (
                              <span style={{
                                padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                background: '#e74c3c22', color: '#e74c3c',
                              }}>⚠️ {t.logDiscrepancy}</span>
                            ) : (
                              <span style={{
                                padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                background: '#27ae6022', color: '#27ae60',
                              }}>✅ {t.logMatch}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredInvLines.length === 0 && (
                <p style={{ color: dimText, textAlign: 'center', padding: 40 }}>{t.logNoPartsFilter}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
