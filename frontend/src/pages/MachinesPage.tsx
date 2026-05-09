import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../contexts/themeContext';
import { useAuthStore } from '../contexts/authStore';
import { CsvToolbar } from '../components/CsvToolbar';
import { resolvePermissions, type Role } from '../../../shared/constants/roles';
import { useRolesStore } from "../store/rolesStore";

/* ─── types ─── */
interface Machine {
  id: string;
  name: string;
  category: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
  notes?: string;
  operators?: string[];
  created_at: string;
}

interface MachineAllocation {
  id: string;
  machine_id: string;
  user_id: string;
  task_id?: string;
  date: string;
  start_time?: string;
  end_time?: string;
  notes?: string;
}

interface MachineForm {
  name: string;
  category: string;
  status: Machine['status'];
  notes: string;
}

interface AllocForm {
  machine_id: string;
  user_id: string;
  task_id: string;
  date: string;
  start_time: string;
  end_time: string;
  notes: string;
}

const emptyMachine: MachineForm = { name: '', category: '', status: 'AVAILABLE', notes: '' };
const emptyAlloc: AllocForm = { machine_id: '', user_id: '', task_id: '', date: '', start_time: '07:00', end_time: '17:00', notes: '' };

const STATUS_OPTIONS: Machine['status'][] = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE'];

const L_ALL: Record<string, Record<string, string>> = {
  de: {
    title: 'Maschinenpark', machines: 'Maschinen', allocations: 'Zuweisungen',
    addMachine: 'Neue Maschine', editMachine: 'Maschine bearbeiten', addAlloc: 'Neue Zuweisung',
    name: 'Name', category: 'Kategorie', status: 'Status', notes: 'Notizen',
    save: 'Speichern', cancel: 'Abbrechen', delete: 'Löschen', search: 'Suchen…',
    allCategories: 'Alle Kategorien', allStatuses: 'Alle Status',
    noMachines: 'Keine Maschinen', noAllocs: 'Keine Zuweisungen',
    machine: 'Maschine', employee: 'Mitarbeiter', task: 'Auftrag', date: 'Datum',
    startTime: 'Startzeit', endTime: 'Endzeit', saved: 'Gespeichert', deleted: 'Gelöscht',
    error: 'Fehler', available: 'Verfügbar', inUse: 'In Gebrauch', maintenance: 'Wartung',
    outOfService: 'Ausser Betrieb', total: 'Total', today: 'Heute',
    imported: 'importiert',
  },
  en: {
    title: 'Machine Park', machines: 'Machines', allocations: 'Allocations',
    addMachine: 'New Machine', editMachine: 'Edit Machine', addAlloc: 'New Allocation',
    name: 'Name', category: 'Category', status: 'Status', notes: 'Notes',
    save: 'Save', cancel: 'Cancel', delete: 'Delete', search: 'Search…',
    allCategories: 'All Categories', allStatuses: 'All Statuses',
    noMachines: 'No machines', noAllocs: 'No allocations',
    machine: 'Machine', employee: 'Employee', task: 'Task', date: 'Date',
    startTime: 'Start Time', endTime: 'End Time', saved: 'Saved', deleted: 'Deleted',
    error: 'Error', available: 'Available', inUse: 'In Use', maintenance: 'Maintenance',
    outOfService: 'Out of Service', total: 'Total', today: 'Today',
    imported: 'imported',
  },
  fr: {
    title: 'Parc machines', machines: 'Machines', allocations: 'Affectations',
    addMachine: 'Nouvelle machine', editMachine: 'Modifier machine', addAlloc: 'Nouvelle affectation',
    name: 'Nom', category: 'Catégorie', status: 'Statut', notes: 'Notes',
    save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer', search: 'Rechercher…',
    allCategories: 'Toutes catégories', allStatuses: 'Tous les statuts',
    noMachines: 'Aucune machine', noAllocs: 'Aucune affectation',
    machine: 'Machine', employee: 'Employé', task: 'Tâche', date: 'Date',
    startTime: 'Heure début', endTime: 'Heure fin', saved: 'Enregistré', deleted: 'Supprimé',
    error: 'Erreur', available: 'Disponible', inUse: 'En service', maintenance: 'Maintenance',
    outOfService: 'Hors service', total: 'Total', today: "Aujourd'hui",
    imported: 'importé(s)',
  },
  pt: {
    title: 'Parque de Máquinas', machines: 'Máquinas', allocations: 'Alocações',
    addMachine: 'Nova Máquina', editMachine: 'Editar Máquina', addAlloc: 'Nova Alocação',
    name: 'Nome', category: 'Categoria', status: 'Estado', notes: 'Notas',
    save: 'Salvar', cancel: 'Cancelar', delete: 'Excluir', search: 'Pesquisar…',
    allCategories: 'Todas categorias', allStatuses: 'Todos os estados',
    noMachines: 'Sem máquinas', noAllocs: 'Sem alocações',
    machine: 'Máquina', employee: 'Funcionário', task: 'Tarefa', date: 'Data',
    startTime: 'Hora início', endTime: 'Hora fim', saved: 'Salvo', deleted: 'Excluído',
    error: 'Erro', available: 'Disponível', inUse: 'Em uso', maintenance: 'Manutenção',
    outOfService: 'Fora de serviço', total: 'Total', today: 'Hoje',
    imported: 'importado(s)',
  },
};

const statusColor = (s: string) => {
  const map: Record<string, string> = { AVAILABLE: '#4caf50', IN_USE: '#C8A96E', MAINTENANCE: '#ff9800', OUT_OF_SERVICE: '#f44336' };
  return map[s] || '#888';
};

const CATEGORIES = ['Bagger', 'Dumper', 'Rasenmäher', 'Kettensäge', 'Heckenschere', 'Laubbläser', 'Transporter', 'Sonstiges'];

/* ─── CSV column definitions ─── */
const csvMachineColumns = (L: Record<string, string>) => [
  { key: 'name', label: L.name },
  { key: 'category', label: L.category },
  { key: 'status', label: L.status },
  { key: 'notes', label: L.notes },
];

const csvAllocColumns = (L: Record<string, string>) => [
  { key: 'machine_name', label: L.machine },
  { key: 'employee_name', label: L.employee },
  { key: 'task_name', label: L.task },
  { key: 'date', label: L.date },
  { key: 'start_time', label: L.startTime },
  { key: 'end_time', label: L.endTime },
  { key: 'notes', label: L.notes },
];

const CSV_MACHINE_EXAMPLES = [
  { name: 'CAT 308', category: 'Bagger', status: 'AVAILABLE', notes: '8t Minibagger, GPS' },
  { name: 'Husqvarna 550XP', category: 'Kettensäge', status: 'IN_USE', notes: 'Neuanschaffung 2025' },
  { name: 'STIHL BR 800', category: 'Laubbläser', status: 'MAINTENANCE', notes: 'Filter wechseln' },
];

const CSV_ALLOC_EXAMPLES = [
  { machine_name: 'CAT 308', employee_name: 'Max Müller', task_name: 'Gartenarbeit Müller', date: '2026-05-08', start_time: '07:00', end_time: '12:00', notes: 'Aushub Nordseite' },
  { machine_name: 'Husqvarna 550XP', employee_name: 'Lena Weber', task_name: 'Unterhalt Lindenpark', date: '2026-05-08', start_time: '08:00', end_time: '16:00', notes: '' },
];

export function MachinesPage() {
  const { isDark, th, lang } = useTheme();
  const L = L_ALL[lang] || L_ALL.de;
  const { user, token } = useAuthStore();
  const API = import.meta.env.VITE_API_URL || '';

  /* ── permissions from roles system ── */
  const { permissionMap } = useRolesStore();
  const perms = useMemo(() => {
    const role: Role = user?.role || "EMPLOYEE";
    return resolvePermissions(role, user?.custom_permissions, permissionMap);
  }, [user, permissionMap]);

  const canView = perms.has('machines.view');
  const canEdit = perms.has('machines.edit');
  const canDelete = perms.has('machines.delete');

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      AVAILABLE: L.available,
      IN_USE: L.inUse,
      MAINTENANCE: L.maintenance,
      OUT_OF_SERVICE: L.outOfService,
    };
    return map[s] || s;
  };

  /* state */
  const [tab, setTab] = useState<'machines' | 'allocations'>('machines');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [allocs, setAllocs] = useState<MachineAllocation[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [machineModal, setMachineModal] = useState(false);
  const [allocModal, setAllocModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [mForm, setMForm] = useState<MachineForm>({ ...emptyMachine });
  const [aForm, setAForm] = useState<AllocForm>({ ...emptyAlloc });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [allocDate, setAllocDate] = useState(() => new Date().toISOString().split('T')[0]);

  const hdrs = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* fetch */
  const fetchMachines = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/machines`, { headers: hdrs() });
      const { data } = await res.json();
      setMachines(data || []);
    } catch { /* ignore */ }
  }, [API, hdrs]);

  const fetchAllocs = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/machines/allocations?date=${allocDate}`, { headers: hdrs() });
      const { data } = await res.json();
      setAllocs(data || []);
    } catch { /* ignore */ }
  }, [API, hdrs, allocDate]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/users`, { headers: hdrs() });
      const { data } = await res.json();
      setUsers(data || []);
    } catch { /* ignore */ }
  }, [API, hdrs]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/tasks`, { headers: hdrs() });
      const { data } = await res.json();
      setTasks(data || []);
    } catch { /* ignore */ }
  }, [API, hdrs]);

  useEffect(() => { fetchMachines(); fetchUsers(); fetchTasks(); }, [fetchMachines, fetchUsers, fetchTasks]);
  useEffect(() => { fetchAllocs(); }, [fetchAllocs]);

  /* machines CRUD */
  const openNewMachine = () => { setEditId(null); setMForm({ ...emptyMachine }); setMachineModal(true); };
  const openEditMachine = (m: Machine) => {
    setEditId(m.id);
    setMForm({ name: m.name, category: m.category, status: m.status, notes: m.notes || '' });
    setMachineModal(true);
  };

  const saveMachine = async () => {
    setSaving(true);
    try {
      const url = editId ? `${API}/api/v1/machines/${editId}` : `${API}/api/v1/machines`;
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: hdrs(), body: JSON.stringify(mForm) });
      if (!res.ok) throw new Error();
      showToast(L.saved);
      setMachineModal(false);
      fetchMachines();
    } catch { showToast(L.error, 'err'); }
    setSaving(false);
  };

  const deleteMachine = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/v1/machines/${id}`, { method: 'DELETE', headers: hdrs() });
      if (!res.ok) throw new Error();
      showToast(L.deleted);
      setConfirmDel(null);
      fetchMachines();
    } catch { showToast(L.error, 'err'); }
  };

  /* alloc CRUD */
  const openNewAlloc = () => {
    setAForm({ ...emptyAlloc, date: allocDate });
    setAllocModal(true);
  };

  const saveAlloc = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/v1/machines/allocations`, {
        method: 'POST', headers: hdrs(), body: JSON.stringify(aForm),
      });
      if (!res.ok) throw new Error();
      showToast(L.saved);
      setAllocModal(false);
      fetchAllocs();
    } catch { showToast(L.error, 'err'); }
    setSaving(false);
  };

  const deleteAlloc = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/v1/machines/allocations/${id}`, { method: 'DELETE', headers: hdrs() });
      if (!res.ok) throw new Error();
      showToast(L.deleted);
      fetchAllocs();
    } catch { showToast(L.error, 'err'); }
  };

  /* ─── CSV import handler (machines) ─── */
  async function handleMachineCsvImport(rows: Record<string, string>[]) {
    let ok = 0, fail = 0;
    for (const row of rows) {
      try {
        const payload: Record<string, string> = {
          name: row.name,
          category: row.category || 'Sonstiges',
          status: STATUS_OPTIONS.includes(row.status as Machine['status'])
            ? row.status
            : 'AVAILABLE',
          notes: row.notes || '',
        };
        const res = await fetch(`${API}/api/v1/machines`, {
          method: 'POST', headers: hdrs(), body: JSON.stringify(payload),
        });
        res.ok ? ok++ : fail++;
      } catch { fail++; }
    }
    await fetchMachines();
    showToast(
      `${ok} ${L.imported}${fail > 0 ? ` (${fail} failed)` : ''}`,
      fail > 0 ? 'err' : 'ok',
    );
  }

  /* filters */
  const filteredMachines = machines.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.name.toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q);
    const matchCat = !filterCat || m.category === filterCat;
    const matchStatus = !filterStatus || m.status === filterStatus;
    return matchSearch && matchCat && matchStatus;
  });

  const categories = [...new Set(machines.map(m => m.category).filter(Boolean))];

  /* helpers */
  const userName = (id: string) => { const u = users.find(u => u.id === id); return u ? `${u.first_name} ${u.last_name}` : id.slice(0, 8); };
  const machineName = (id: string) => machines.find(m => m.id === id)?.name || id.slice(0, 8);
  const taskName = (id: string) => { const tk = tasks.find(tk => tk.id === id); return tk ? (tk.short_code || tk.name) : ''; };

  /* ─── CSV export data (machines) ─── */
  const csvMachineData = useMemo(() =>
    filteredMachines.map(m => ({
      name: m.name,
      category: m.category || '',
      status: m.status,
      notes: m.notes || '',
    })),
  [filteredMachines]);

  /* ─── CSV export data (allocations) ─── */
  const csvAllocData = useMemo(() =>
    allocs.map(a => ({
      machine_name: machineName(a.machine_id),
      employee_name: userName(a.user_id),
      task_name: a.task_id ? taskName(a.task_id) : '',
      date: a.date,
      start_time: a.start_time || '',
      end_time: a.end_time || '',
      notes: a.notes || '',
    })),
  [allocs, machines, users, tasks]);

  /* ─── derived colours ─── */
  const gold = th.gold;
  const inputBg = isDark ? '#1a1a3e' : '#faf7f2';

  const modalOverlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const modalBox: React.CSSProperties = {
    background: th.bgCard, borderRadius: 16, padding: 32, width: 500,
    maxHeight: '85vh', overflowY: 'auto', border: `1px solid ${th.border}`,
    boxShadow: '0 20px 60px rgba(0,0,0,.4)',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: `1px solid ${th.border}`, background: inputBg, color: th.text,
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: th.textDim, marginBottom: 4, display: 'block' };

  /* stats */
  const statAvail = machines.filter(m => m.status === 'AVAILABLE').length;
  const statInUse = machines.filter(m => m.status === 'IN_USE').length;
  const statMaint = machines.filter(m => m.status === 'MAINTENANCE').length;

  /* ── if user has no view permission, render nothing ── */
  if (!canView) return null;

  return (
    <div style={{ background: th.bg, minHeight: '100vh', padding: '24px 32px', color: th.text, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      {/* toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 2000,
          background: toast.type === 'err' ? '#6B3A3A' : (isDark ? '#2a4a2a' : '#e8f5e9'),
          color: toast.type === 'err' ? '#fff' : th.text,
          padding: '12px 24px', borderRadius: 10, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,.3)',
        }}>{toast.msg}</div>
      )}

      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{L.title}</h1>
          <p style={{ margin: '4px 0 0', color: th.textDim, fontSize: 14 }}>
            {L.total}: {machines.length} · {L.available}: {statAvail} · {L.inUse}: {statInUse} · {L.maintenance}: {statMaint}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {tab === 'machines' && (
            <CsvToolbar
              columns={csvMachineColumns(L)}
              data={csvMachineData}
              filename={`machines_${new Date().toISOString().split('T')[0]}`}
              exampleRows={CSV_MACHINE_EXAMPLES}
              formatters={{
                status: (v: string) => STATUS_OPTIONS.includes(v as Machine['status']) ? v : 'AVAILABLE',
              }}
              validators={{
                name: (v: string) => (v ? null : 'Name is required'),
              }}
              canImport={canEdit}
              onImport={handleMachineCsvImport}
            />
          )}
          {tab === 'allocations' && (
            <CsvToolbar
              columns={csvAllocColumns(L)}
              data={csvAllocData}
              filename={`allocations_${allocDate}`}
              exampleRows={CSV_ALLOC_EXAMPLES}
              canImport={false}
              onImport={async () => {}}
            />
          )}
          {canEdit && tab === 'machines' && (
            <button onClick={openNewMachine} style={{
              background: `linear-gradient(135deg, ${gold}, #b8956a)`, color: '#fff',
              border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700,
              cursor: 'pointer', fontSize: 15, boxShadow: '0 4px 15px rgba(200,169,110,.4)',
            }}>+ {L.addMachine}</button>
          )}
          {canEdit && tab === 'allocations' && (
            <button onClick={openNewAlloc} style={{
              background: `linear-gradient(135deg, ${gold}, #b8956a)`, color: '#fff',
              border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700,
              cursor: 'pointer', fontSize: 15, boxShadow: '0 4px 15px rgba(200,169,110,.4)',
            }}>+ {L.addAlloc}</button>
          )}
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['machines', 'allocations'] as const).map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            style={{
              padding: '10px 22px', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer',
              border: 'none', transition: 'all .15s',
              background: tab === tb ? `linear-gradient(135deg, ${gold}, #b8956a)` : (isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)'),
              color: tab === tb ? '#fff' : th.textDim,
            }}
          >{tb === 'machines' ? L.machines : L.allocations}</button>
        ))}
      </div>

      {/* ─── MACHINES TAB ─── */}
      {tab === 'machines' && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <input placeholder={L.search} value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 200, padding: '10px 16px', borderRadius: 10, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14, outline: 'none' }} />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14 }}>
              <option value="">{L.allCategories}</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14 }}>
              <option value="">{L.allStatuses}</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {filteredMachines.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: th.textDim }}>{L.noMachines}</div>
            )}
            {filteredMachines.map(m => (
              <div key={m.id}
                onClick={() => canEdit && openEditMachine(m)}
                style={{
                  background: th.bgCard, borderRadius: 14, padding: 20,
                  border: `1px solid ${th.border}`, cursor: canEdit ? 'pointer' : 'default',
                  transition: 'all .15s', position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => { if (canEdit) e.currentTarget.style.borderColor = gold; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = th.border; }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: statusColor(m.status) }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{m.name}</h3>
                    {m.category && <p style={{ margin: '4px 0 0', fontSize: 12, color: th.textDim }}>{m.category}</p>}
                  </div>
                  <span style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    background: `${statusColor(m.status)}22`, color: statusColor(m.status),
                  }}>{statusLabel(m.status)}</span>
                </div>

                {m.notes && <p style={{ margin: '12px 0 0', fontSize: 13, color: th.textDim, lineHeight: 1.4 }}>{m.notes}</p>}

                {(() => {
                  const todayAllocs = allocs.filter(a => a.machine_id === m.id);
                  if (todayAllocs.length === 0) return null;
                  return (
                    <div style={{ marginTop: 12, borderTop: `1px solid ${th.border}`, paddingTop: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: gold }}>{L.today}:</span>
                      {todayAllocs.map(a => (
                        <div key={a.id} style={{ fontSize: 12, color: th.textDim, marginTop: 4 }}>
                          {userName(a.user_id)} {a.start_time && a.end_time ? `${a.start_time}–${a.end_time}` : ''}
                          {a.task_id ? ` · ${taskName(a.task_id)}` : ''}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {canDelete && (
                  <div style={{ marginTop: 12, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    {confirmDel === m.id ? (
                      <span style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                        <button onClick={() => deleteMachine(m.id)}
                          style={{ background: '#6B3A3A', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                          ✓ {L.delete}</button>
                        <button onClick={() => setConfirmDel(null)}
                          style={{ background: 'transparent', color: th.textDim, border: `1px solid ${th.border}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 11 }}>
                          {L.cancel}</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDel(m.id)}
                        style={{ background: 'transparent', color: '#f44336', border: 'none', cursor: 'pointer', fontSize: 14 }}>🗑</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ─── ALLOCATIONS TAB ─── */}
      {tab === 'allocations' && (
        <>
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => { const d = new Date(allocDate); d.setDate(d.getDate() - 1); setAllocDate(d.toISOString().split('T')[0]); }}
              style={{ background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: th.text, fontSize: 18 }}>‹</button>
            <input type="date" value={allocDate} onChange={e => setAllocDate(e.target.value)}
              style={{ ...inputStyle, width: 'auto' }} />
            <button onClick={() => { const d = new Date(allocDate); d.setDate(d.getDate() + 1); setAllocDate(d.toISOString().split('T')[0]); }}
              style={{ background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: th.text, fontSize: 18 }}>›</button>
            <button onClick={() => setAllocDate(new Date().toISOString().split('T')[0])}
              style={{ background: 'transparent', border: `1px solid ${th.border}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: gold, fontWeight: 600, fontSize: 13 }}>{L.today}</button>
          </div>

          <div style={{ background: th.bgCard, borderRadius: 14, border: `1px solid ${th.border}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: th.bgHeader, color: '#fff' }}>
                  {[L.machine, L.employee, L.task, L.startTime, L.endTime, L.notes, ''].map((h, i) => (
                    <th key={i} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allocs.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: th.textDim }}>{L.noAllocs}</td></tr>
                )}
                {allocs.map((a, i) => (
                  <tr key={a.id} style={{ background: i % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)') }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{machineName(a.machine_id)}</td>
                    <td style={{ padding: '10px 16px' }}>{userName(a.user_id)}</td>
                    <td style={{ padding: '10px 16px', color: gold, fontWeight: 600 }}>{a.task_id ? taskName(a.task_id) : '–'}</td>
                    <td style={{ padding: '10px 16px' }}>{a.start_time || '–'}</td>
                    <td style={{ padding: '10px 16px' }}>{a.end_time || '–'}</td>
                    <td style={{ padding: '10px 16px', color: th.textDim, fontSize: 13 }}>{a.notes || '–'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      {canDelete && (
                        <button onClick={() => deleteAlloc(a.id)}
                          style={{ background: 'transparent', color: '#f44336', border: 'none', cursor: 'pointer', fontSize: 14 }}>🗑</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── MACHINE MODAL ─── */}
      {machineModal && (
        <div style={modalOverlay} onClick={() => setMachineModal(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700, color: gold }}>
              {editId ? L.editMachine : L.addMachine}
            </h2>
            <div>
              <label style={labelStyle}>{L.name}</label>
              <input value={mForm.name} onChange={e => setMForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>{L.category}</label>
              <select value={mForm.category} onChange={e => setMForm(f => ({ ...f, category: e.target.value }))}
                style={inputStyle}>
                <option value="">–</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>{L.status}</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {STATUS_OPTIONS.map(s => (
                  <button key={s} onClick={() => setMForm(f => ({ ...f, status: s }))}
                    style={{
                      flex: 1, padding: '10px 8px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12,
                      border: mForm.status === s ? `2px solid ${statusColor(s)}` : `1px solid ${th.border}`,
                      background: mForm.status === s ? `${statusColor(s)}22` : 'transparent',
                      color: mForm.status === s ? statusColor(s) : th.text, transition: 'all .15s', minWidth: 90,
                    }}>{statusLabel(s)}</button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>{L.notes}</label>
              <textarea value={mForm.notes} onChange={e => setMForm(f => ({ ...f, notes: e.target.value }))}
                rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 28 }}>
              <button onClick={() => setMachineModal(false)}
                style={{ padding: '10px 24px', borderRadius: 8, border: `1px solid ${th.border}`, background: 'transparent', color: th.text, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                {L.cancel}</button>
              <button onClick={saveMachine} disabled={saving}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none',
                  background: `linear-gradient(135deg, ${gold}, #b8956a)`, color: '#fff',
                  cursor: saving ? 'wait' : 'pointer', fontWeight: 700, fontSize: 14,
                  opacity: saving ? .7 : 1, boxShadow: '0 4px 15px rgba(200,169,110,.4)',
                }}>{saving ? '...' : L.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ALLOCATION MODAL ─── */}
      {allocModal && (
        <div style={modalOverlay} onClick={() => setAllocModal(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700, color: gold }}>{L.addAlloc}</h2>
            <div>
              <label style={labelStyle}>{L.machine}</label>
              <select value={aForm.machine_id} onChange={e => setAForm(f => ({ ...f, machine_id: e.target.value }))} style={inputStyle}>
                <option value="">–</option>
                {machines.filter(m => m.status !== 'OUT_OF_SERVICE').map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.category})</option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>{L.employee}</label>
              <select value={aForm.user_id} onChange={e => setAForm(f => ({ ...f, user_id: e.target.value }))} style={inputStyle}>
                <option value="">–</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>{L.task} (optional)</label>
              <select value={aForm.task_id} onChange={e => setAForm(f => ({ ...f, task_id: e.target.value }))} style={inputStyle}>
                <option value="">–</option>
                {tasks.map(tk => (
                  <option key={tk.id} value={tk.id}>{tk.short_code || tk.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>{L.date}</label>
              <input type="date" value={aForm.date} onChange={e => setAForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              <div>
                <label style={labelStyle}>{L.startTime}</label>
                <input type="time" value={aForm.start_time} onChange={e => setAForm(f => ({ ...f, start_time: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{L.endTime}</label>
                <input type="time" value={aForm.end_time} onChange={e => setAForm(f => ({ ...f, end_time: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>{L.notes}</label>
              <textarea value={aForm.notes} onChange={e => setAForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 28 }}>
              <button onClick={() => setAllocModal(false)}
                style={{ padding: '10px 24px', borderRadius: 8, border: `1px solid ${th.border}`, background: 'transparent', color: th.text, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                {L.cancel}</button>
              <button onClick={saveAlloc} disabled={saving || !aForm.machine_id || !aForm.user_id}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none',
                  background: `linear-gradient(135deg, ${gold}, #b8956a)`, color: '#fff',
                  cursor: (saving || !aForm.machine_id || !aForm.user_id) ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: 14,
                  opacity: (saving || !aForm.machine_id || !aForm.user_id) ? .5 : 1,
                  boxShadow: '0 4px 15px rgba(200,169,110,.4)',
                }}>{saving ? '...' : L.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
