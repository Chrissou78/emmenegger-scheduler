// src/pages/MachinesPage.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from '../contexts/themeContext';
import { useAuthStore } from '../contexts/authStore';
import { CsvToolbar } from '../components/CsvToolbar';
import { resolvePermissions, type Role, type Permission } from '../../../shared/constants/roles';
import { useRolesStore } from '../store/rolesStore';
import { getTranslations, type LangCode } from '../i18n';

const API = import.meta.env.VITE_API_URL || '';

/* ────────────────── normalizeRole ────────────────── */
function normalizeRole(raw: string): Role {
  const upper = (raw || '').toUpperCase();
  switch (upper) {
    case 'GLOBAL_MANAGER': return 'ADMIN';
    case 'LOCAL_MANAGER':  return 'MANAGER';
    case 'ARBEITER':       return 'EMPLOYEE';
    default:               return (upper as Role) || 'EMPLOYEE';
  }
}

/* ────────────────── interfaces ────────────────── */
interface Machine {
  id: string;
  name: string;
  type?: string;
  category?: string;
  license_plate?: string;
  status: string;
  department?: string;
  notes?: string;
  year?: number;
  brand?: string;
  model?: string;
  serial_number?: string;
  created_at?: string;
  updated_at?: string;
}

interface MachineAllocation {
  id: string;
  machine_id: string;
  task_id: string;
  user_id?: string;
  date: string;
  start_time?: string;
  end_time?: string;
  notes?: string;
  task?: { id: string; name: string; code: string; color?: string };
  user?: { id: string; first_name: string; last_name: string };
}

/* ────────────────── constants ────────────────── */
const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: '#4ecdc4', IN_USE: '#f39c12', MAINTENANCE: '#e67e22', OUT_OF_SERVICE: '#e74c3c',
};

const STATUS_ICONS: Record<string, string> = {
  AVAILABLE: '🟢', IN_USE: '🔵', MAINTENANCE: '🟠', OUT_OF_SERVICE: '🔴',
};

const STATUSES = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE'];

const CATEGORIES = [
  'EXCAVATOR', 'DUMPER', 'ROLLER', 'LOADER', 'CRANE', 'TRUCK',
  'VAN', 'CAR', 'TRAILER', 'MOWER', 'CHAINSAW', 'COMPACTOR',
  'GENERATOR', 'PUMP', 'LIGHT_EQUIPMENT', 'OTHER',
];

const TYPES = ['VEHICLE', 'HEAVY', 'LIGHT', 'TOOL', 'ATTACHMENT', 'OTHER'];

/* ────────────────── helpers ────────────────── */
function translateCategory(cat: string | undefined, t: Record<string, string>): string {
  if (!cat) return '–';
  return t[`CAT_${cat.toUpperCase()}`] || cat;
}

function translateType(type: string | undefined, t: Record<string, string>): string {
  if (!type) return '–';
  return t[`TYPE_${type.toUpperCase()}`] || type;
}

function translateDept(dept: string | undefined, t: Record<string, string>): string {
  if (!dept) return '–';
  return t[`DEPT_${dept.toUpperCase()}`] || dept;
}

function translateStatus(status: string, t: Record<string, string>): string {
  return t[status] || status;
}

const DATE_LOCALES: Record<string, string> = {
  de: 'de-CH', en: 'en-GB', fr: 'fr-CH', pt: 'pt-BR',
};

function machineToForm(m: Machine): Partial<Machine> {
  return {
    name: m.name || '',
    type: m.type || '',
    category: m.category || '',
    license_plate: m.license_plate || '',
    status: m.status || 'AVAILABLE',
    department: m.department || '',
    brand: m.brand || '',
    model: m.model || '',
    year: m.year ?? undefined,
    serial_number: m.serial_number || '',
    notes: m.notes || '',
  };
}

/* ────────────────── CSV ────────────────── */
const csvColumns = (t: Record<string, string>) => [
  { key: 'name', label: t.name },
  { key: 'type', label: t.type },
  { key: 'category', label: t.category },
  { key: 'license_plate', label: t.licensePlate },
  { key: 'status', label: t.status },
  { key: 'department', label: t.department },
  { key: 'brand', label: t.brand },
  { key: 'model', label: t.model },
  { key: 'year', label: t.year },
  { key: 'serial_number', label: t.serialNumber },
  { key: 'notes', label: t.notes },
];

const CSV_EXAMPLE_ROWS = [
  {
    name: 'CAT 320', type: 'HEAVY', category: 'EXCAVATOR',
    license_plate: 'BE 12345', status: 'AVAILABLE', department: 'GARTEN_TIEFBAU',
    brand: 'Caterpillar', model: '320 GC', year: '2022', serial_number: 'CAT320-001',
    notes: 'Hauptbagger',
  },
  {
    name: 'Mercedes Sprinter', type: 'VEHICLE', category: 'VAN',
    license_plate: 'BE 67890', status: 'IN_USE', department: 'UNTERHALT',
    brand: 'Mercedes', model: 'Sprinter 316', year: '2021', serial_number: 'SPR-002',
    notes: 'Werkstattwagen',
  },
];

/* ────────────────── component ────────────────── */
export function MachinesPage() {
  const { th, isDark, lang } = useTheme();
  const { token, user } = useAuthStore();
  const t = getTranslations(lang as LangCode);
  const locale = DATE_LOCALES[lang] || 'de-CH';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  /* ── permissions ── */
  const { permissionMap } = useRolesStore();
  const perms = useMemo(() => {
    const role = normalizeRole(user?.role || '');
    return resolvePermissions(role, user?.custom_permissions, permissionMap);
  }, [user, permissionMap]);

  const canView = perms.has('machines.view' as Permission);
  const canEdit = perms.has('machines.edit' as Permission);
  const canDelete = perms.has('machines.delete' as Permission);

  /* ── state ── */
  const [machines, setMachines] = useState<Machine[]>([]);
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Machine | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Machine>>({});
  const [tab, setTab] = useState<'general' | 'allocations' | 'notes'>('general');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [allocations, setAllocations] = useState<MachineAllocation[]>([]);

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
    setAllocations([]);
  }

  const panelOpen = selected !== null || editing;

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
    background: th.gold, color: '#000',
    fontWeight: 600, cursor: 'pointer', fontSize: 14, transition: 'opacity .15s',
  };

  const btnDanger: React.CSSProperties = { ...btnPrimary, background: '#e74c3c', color: '#fff' };

  const btnSecondary: React.CSSProperties = {
    padding: '8px 18px', borderRadius: 8,
    border: `1px solid ${th.border}`,
    background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
    color: th.text, fontWeight: 600, cursor: 'pointer', fontSize: 14, transition: 'opacity .15s',
  };

  const btnBack: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 8, border: 'none',
    background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)',
    color: th.text, fontWeight: 600, cursor: 'pointer', fontSize: 13,
    transition: 'opacity .15s', marginBottom: 16,
  };

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none',
    background: active ? (isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.04)') : 'transparent',
    color: active ? th.text : dimText,
    fontWeight: active ? 700 : 500, cursor: 'pointer',
    borderBottom: active ? `2px solid ${th.gold}` : '2px solid transparent',
    transition: 'all .15s',
  });

  const paginationBtn = (disabled: boolean): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: disabled ? (isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)') : th.gold,
    color: disabled ? (isDark ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.25)') : '#000',
    fontWeight: 600, fontSize: 14,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.6 : 1, transition: 'all .15s',
  });

  const thStyle: React.CSSProperties = {
    textAlign: 'left' as const, padding: '10px 12px',
    borderBottom: `2px solid ${th.border}`,
    color: dimText, fontWeight: 600, fontSize: 12,
    textTransform: 'uppercase' as const, letterSpacing: '0.5px',
  };

  const tdStyle: React.CSSProperties = {
    padding: '10px 12px', borderBottom: `1px solid ${th.border}`, color: dimText,
  };

  const labelStyle: React.CSSProperties = { fontSize: 12, color: dimText, fontWeight: 600 };

  const statCard: React.CSSProperties = {
    padding: '10px 16px', borderRadius: 10,
    background: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)',
    textAlign: 'center' as const, minWidth: 100,
  };

  /* ── data fetching ── */
  const fetchMachines = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/machines`, { headers });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const raw = json.data ?? json;
      let list: Machine[] = Array.isArray(raw) ? raw : [];

      // client-side filter & search
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(m =>
          (m.name || '').toLowerCase().includes(q) ||
          (m.license_plate || '').toLowerCase().includes(q) ||
          (m.brand || '').toLowerCase().includes(q) ||
          (m.model || '').toLowerCase().includes(q)
        );
      }
      if (filterCategory) list = list.filter(m => m.category === filterCategory);
      if (filterStatus) list = list.filter(m => m.status === filterStatus);

      setAllMachines(Array.isArray(json.data ?? json) ? (json.data ?? json) : []);
      setTotal(list.length);

      // client-side pagination
      const start = (page - 1) * pageSize;
      setMachines(list.slice(start, start + pageSize));
    } catch {
      showToast(t.error, 'err');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, filterCategory, filterStatus, token]);

  const fetchAllocations = useCallback(async (machineId: string) => {
    try {
      const res = await fetch(`${API}/api/v1/machines/${machineId}/allocations`, { headers });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setAllocations(Array.isArray(json.data ?? json) ? (json.data ?? json) : []);
    } catch {
      setAllocations([]);
    }
  }, [token]);

  const fetchDetail = useCallback(async (m: Machine) => {
    setSelected(m);
    setForm(machineToForm(m));
    setEditing(false);
    setTab('general');
    setConfirmDelete(false);
    fetchAllocations(m.id);
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, [fetchAllocations]);

  useEffect(() => { fetchMachines(); }, [fetchMachines]);

  /* ── CRUD ── */
  async function saveMachine() {
    try {
      const method = selected ? 'PUT' : 'POST';
      const url = selected
        ? `${API}/api/v1/machines/${selected.id}`
        : `${API}/api/v1/machines`;
      const res = await fetch(url, { method, headers, body: JSON.stringify(form) });
      if (!res.ok) throw new Error();
      showToast(t.saved);
      closeDetail();
      fetchMachines();
    } catch {
      showToast(t.error, 'err');
    }
  }

  async function deleteMachine() {
    if (!selected) return;
    try {
      const res = await fetch(`${API}/api/v1/machines/${selected.id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error();
      showToast(t.deleted);
      closeDetail();
      fetchMachines();
    } catch {
      showToast(t.error, 'err');
    }
  }

  /* ── CSV import ── */
  async function handleCsvImport(rows: Record<string, string>[]) {
    let ok = 0, fail = 0;
    for (const row of rows) {
      try {
        const res = await fetch(`${API}/api/v1/machines`, {
          method: 'POST', headers,
          body: JSON.stringify({
            name: row.name,
            type: row.type || undefined,
            category: row.category || undefined,
            license_plate: row.license_plate || undefined,
            status: row.status || 'AVAILABLE',
            department: row.department || undefined,
            brand: row.brand || undefined,
            model: row.model || undefined,
            year: row.year ? parseInt(row.year, 10) : undefined,
            serial_number: row.serial_number || undefined,
            notes: row.notes || undefined,
          }),
        });
        res.ok ? ok++ : fail++;
      } catch { fail++; }
    }
    await fetchMachines();
    showToast(`${ok} ${t.imported}${fail > 0 ? ` (${fail} failed)` : ''}`, fail > 0 ? 'err' : 'ok');
  }

  /* ── derived ── */
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const availableCount = useMemo(
    () => allMachines.filter(m => m.status === 'AVAILABLE').length,
    [allMachines],
  );

  // unique categories from actual data (for filter dropdown)
  const usedCategories = useMemo(() => {
    const cats = new Set(allMachines.map(m => m.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [allMachines]);

  const csvData = useMemo(
    () => allMachines.map(m => ({
      name: m.name,
      type: m.type || '',
      category: m.category || '',
      license_plate: m.license_plate || '',
      status: m.status,
      department: m.department || '',
      brand: m.brand || '',
      model: m.model || '',
      year: m.year != null ? String(m.year) : '',
      serial_number: m.serial_number || '',
      notes: m.notes || '',
    })),
    [allMachines],
  );

  if (!canView) return null;

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
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 20,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, color: th.text }}>{t.title}</h1>
          <p style={{ margin: '4px 0 0', color: dimText, fontSize: 14 }}>
            {t.total}: {allMachines.length} · {t.available}: {availableCount}
          </p>
        </div>
        {!panelOpen && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <CsvToolbar
              columns={csvColumns(t)}
              data={csvData}
              filename={`machines_${new Date().toISOString().split('T')[0]}`}
              exampleRows={CSV_EXAMPLE_ROWS}
              validators={{ name: (v: string) => (v ? null : 'Name is required') }}
              canImport={canEdit}
              onImport={handleCsvImport}
            />
            {canEdit && (
              <button
                onClick={() => {
                  setSelected(null);
                  setForm(machineToForm({
                    id: '', name: '', status: 'AVAILABLE', created_at: '',
                  }));
                  setEditing(true);
                  setTab('general');
                }}
                style={btnPrimary}
              >
                {t.add}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════ LIST VIEW ═══════════════ */}
      {!panelOpen && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <input
              placeholder={t.search}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ ...inputStyle, maxWidth: 260 }}
            />
            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
              style={{ ...selectStyle, maxWidth: 200 }}
            >
              <option value="">{t.allCategories}</option>
              {usedCategories.map(cat => (
                <option key={cat} value={cat}>{translateCategory(cat, t)}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              style={{ ...selectStyle, maxWidth: 180 }}
            >
              <option value="">{t.allStatuses}</option>
              {STATUSES.map(s => (
                <option key={s} value={s}>{translateStatus(s, t)}</option>
              ))}
            </select>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: dimText }}>⏳ {t.loading}</div>
          )}

          {!loading && (
            <>
              {machines.length === 0 ? (
                <p style={{ color: dimText, textAlign: 'center', padding: 40 }}>{t.noMachines}</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr>
                        {[t.name, t.category, t.type, t.licensePlate, t.department, t.status].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {machines.map(m => (
                        <tr
                          key={m.id}
                          onClick={() => fetchDetail(m)}
                          style={{ cursor: 'pointer', transition: 'background .15s' }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLElement).style.background = isDark
                              ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)')
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLElement).style.background = 'transparent')
                          }
                        >
                          <td style={{ ...tdStyle, color: th.text, fontWeight: 600 }}>
                            {m.name}
                            {m.brand || m.model ? (
                              <div style={{ fontSize: 12, color: dimText, fontWeight: 400 }}>
                                {[m.brand, m.model].filter(Boolean).join(' ')}
                              </div>
                            ) : null}
                          </td>
                          <td style={tdStyle}>{translateCategory(m.category, t)}</td>
                          <td style={tdStyle}>{translateType(m.type, t)}</td>
                          <td style={tdStyle}>{m.license_plate || '–'}</td>
                          <td style={tdStyle}>{translateDept(m.department, t)}</td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${th.border}` }}>
                            <span style={{
                              display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                              fontSize: 12, fontWeight: 600,
                              background: `${STATUS_COLORS[m.status] || '#95a5a6'}22`,
                              color: STATUS_COLORS[m.status] || '#95a5a6',
                            }}>
                              {STATUS_ICONS[m.status] || ''} {translateStatus(m.status, t)}                            
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  gap: 12, marginTop: 16,
                }}>
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    style={paginationBtn(page <= 1)}
                  >
                    {t.prev}
                  </button>
                  <span style={{ color: dimText, fontSize: 14 }}>
                    {t.page} {page} {t.of} {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    style={paginationBtn(page >= totalPages)}
                  >
                    {t.next}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ═══════════════ DETAIL / EDIT PANEL ═══════════════ */}
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
                {editing
                  ? (form.name || (selected ? selected.name : t.add))
                  : (selected?.name || '')}
              </h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selected && !editing && canEdit && (
                  <>
                    <button
                      onClick={() => { setForm(machineToForm(selected)); setEditing(true); }}
                      style={btnPrimary}
                    >
                      {t.edit}
                    </button>
                    {canDelete && (
                      confirmDelete ? (
                        <>
                          <span style={{ color: th.text, alignSelf: 'center', fontSize: 13 }}>
                            {t.confirmDelete}
                          </span>
                          <button onClick={deleteMachine} style={btnDanger}>{t.yes}</button>
                          <button onClick={() => setConfirmDelete(false)} style={btnSecondary}>{t.no}</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelete(true)} style={btnDanger}>{t.delete}</button>
                      )
                    )}
                  </>
                )}
                {editing && (
                  <>
                    <button onClick={saveMachine} style={btnPrimary}>{t.save}</button>
                    <button
                      onClick={() => {
                        if (selected) { setForm(machineToForm(selected)); setEditing(false); }
                        else { closeDetail(); }
                      }}
                      style={btnSecondary}
                    >
                      {t.cancel}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Status + category badge (view mode) */}
            {selected && !editing && (
              <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-block', padding: '4px 12px', borderRadius: 20,
                  fontSize: 12, fontWeight: 600,
                  background: `${STATUS_COLORS[selected.status] || '#95a5a6'}22`,
                  color: STATUS_COLORS[selected.status] || '#95a5a6',
                }}>
                  {STATUS_ICONS[selected.status] || ''} {translateStatus(selected.status, t)}
                </span>
                {selected.category && (
                  <span style={{
                    display: 'inline-block', padding: '4px 12px', borderRadius: 20,
                    fontSize: 12, fontWeight: 600,
                    background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
                    color: dimText,
                  }}>
                    {translateCategory(selected.category, t)}
                  </span>
                )}
              </div>
            )}

            {/* Stats row (view mode) */}
            {selected && !editing && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                {[
                  { label: t.type, value: translateType(selected.type, t) },
                  { label: t.department, value: translateDept(selected.department, t) },
                  { label: t.licensePlate, value: selected.license_plate || '–' },
                  {
                    label: t.year,
                    value: selected.year ? String(selected.year) : '–',
                  },
                ].map(s => (
                  <div key={s.label} style={statCard}>
                    <div style={{ fontSize: 12, color: dimText }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: th.text }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${th.border}` }}>
              {(['general', 'allocations', 'notes'] as const).map(tb => (
                <button key={tb} onClick={() => setTab(tb)} style={tabBtnStyle(tab === tb)}>
                  {t[tb === 'notes' ? 'notesTab' : tb]}
                </button>
              ))}
            </div>

            {/* ── General Tab ── */}
            {tab === 'general' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {([
                  ['name', t.name, 'text'],
                  ['type', t.type, 'select-type'],
                  ['category', t.category, 'select-category'],
                  ['brand', t.brand, 'text'],
                  ['model', t.model, 'text'],
                  ['year', t.year, 'number'],
                  ['serial_number', t.serialNumber, 'text'],
                  ['license_plate', t.licensePlate, 'text'],
                  ['department', t.department, 'select-dept'],
                  ['status', t.status, 'select-status'],
                ] as [string, string, string][]).map(([key, label, inputType]) => (
                  <div key={key}>
                    <label style={labelStyle}>{label}</label>
                    {editing ? (
                      inputType === 'select-status' ? (
                        <select
                          value={(form as any)[key] || ''}
                          onChange={e => setForm({ ...form, [key]: e.target.value })}
                          style={selectStyle}
                        >
                          {STATUSES.map(s => (
                            <option key={s} value={s}>{translateStatus(s, t)}</option>
                          ))}
                        </select>
                      ) : inputType === 'select-category' ? (
                        <select
                          value={(form as any)[key] || ''}
                          onChange={e => setForm({ ...form, [key]: e.target.value })}
                          style={selectStyle}
                        >
                          <option value="">–</option>
                          {CATEGORIES.map(c => (
                            <option key={c} value={c}>{translateCategory(c, t)}</option>
                          ))}
                        </select>
                      ) : inputType === 'select-type' ? (
                        <select
                          value={(form as any)[key] || ''}
                          onChange={e => setForm({ ...form, [key]: e.target.value })}
                          style={selectStyle}
                        >
                          <option value="">–</option>
                          {TYPES.map(tp => (
                            <option key={tp} value={tp}>{translateType(tp, t)}</option>
                          ))}
                        </select>
                      ) : inputType === 'select-dept' ? (
                        <select
                          value={(form as any)[key] || ''}
                          onChange={e => setForm({ ...form, [key]: e.target.value })}
                          style={selectStyle}
                        >
                          <option value="">–</option>
                          <option value="GARTEN_TIEFBAU">{translateDept('GARTEN_TIEFBAU', t)}</option>
                          <option value="UNTERHALT">{translateDept('UNTERHALT', t)}</option>
                        </select>
                      ) : inputType === 'number' ? (
                        <input
                          type="number"
                          value={(form as any)[key] ?? ''}
                          onChange={e => setForm({ ...form, [key]: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                          style={inputStyle}
                        />
                      ) : (
                        <input
                          value={(form as any)[key] || ''}
                          onChange={e => setForm({ ...form, [key]: e.target.value })}
                          style={inputStyle}
                        />
                      )
                    ) : (
                      <p style={{ margin: '4px 0 0', color: th.text, fontSize: 14 }}>
                        {key === 'status' ? translateStatus((selected as any)?.[key] || '', t)
                          : key === 'category' ? translateCategory((selected as any)?.[key], t)
                          : key === 'type' ? translateType((selected as any)?.[key], t)
                          : key === 'department' ? translateDept((selected as any)?.[key], t)
                          : (selected as any)?.[key] || '–'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Allocations Tab ── */}
            {tab === 'allocations' && (
              <div>
                {allocations.length === 0 ? (
                  <p style={{ color: dimText, textAlign: 'center', padding: 20 }}>–</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr>
                          {[t.date, t.task, t.user, t.startTime, t.endTime].map(h => (
                            <th key={h} style={thStyle}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allocations.map(a => (
                          <tr key={a.id}>
                            <td style={tdStyle}>
                              {new Date(a.date).toLocaleDateString(locale)}
                            </td>
                            <td style={{ ...tdStyle, color: th.text, fontWeight: 600 }}>
                              {a.task ? `${a.task.code || ''} ${a.task.name || ''}`.trim() : '–'}
                            </td>
                            <td style={tdStyle}>
                              {a.user ? `${a.user.first_name} ${a.user.last_name}` : '–'}
                            </td>
                            <td style={tdStyle}>{a.start_time || '–'}</td>
                            <td style={tdStyle}>{a.end_time || '–'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Notes Tab ── */}
            {tab === 'notes' && (
              <div>
                {editing ? (
                  <textarea
                    value={form.notes || ''}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    rows={8}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                ) : (
                  <p style={{ color: th.text, fontSize: 14, whiteSpace: 'pre-wrap' }}>
                    {selected?.notes || '–'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
