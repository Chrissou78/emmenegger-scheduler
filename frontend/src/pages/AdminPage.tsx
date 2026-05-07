import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../contexts/themeContext';
import { useAuthStore } from '../contexts/authStore';

/* ─── types ─── */
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'GLOBAL_MANAGER' | 'LOCAL_MANAGER' | 'ARBEITER';
  departments: string[];
  phone?: string;
  is_active: boolean;
  manager_id?: string | null;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  address?: string;
  city?: string;
  zip?: string;
  phone?: string;
  email?: string;
  contact_person?: string;
  notes?: string;
  created_at: string;
}

interface Machine {
  id: string;
  name: string;
  category: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
  notes?: string;
  created_at: string;
}

interface Task {
  id: string;
  name: string;
  short_code: string;
  description?: string;
  customer_id?: string;
  status: string;
  color_bg?: string;
  color_text?: string;
  recurrence_type?: string;
  schedule_type?: string;
  created_at: string;
}

interface UserForm {
  email: string;
  first_name: string;
  last_name: string;
  role: User['role'];
  departments: string[];
  phone: string;
  password: string;
  is_active: boolean;
  manager_id: string;
}

interface CustomerForm {
  name: string;
  address: string;
  city: string;
  zip: string;
  phone: string;
  email: string;
  contact_person: string;
  notes: string;
}

interface MachineForm {
  name: string;
  category: string;
  status: Machine['status'];
  notes: string;
}

interface TaskForm {
  name: string;
  short_code: string;
  description: string;
  customer_id: string;
  status: string;
  color_bg: string;
  color_text: string;
}

const emptyUser: UserForm = { email: '', first_name: '', last_name: '', role: 'ARBEITER', departments: [], phone: '', password: '', is_active: true, manager_id: '' };
const emptyCustomer: CustomerForm = { name: '', address: '', city: '', zip: '', phone: '', email: '', contact_person: '', notes: '' };
const emptyMachine: MachineForm = { name: '', category: '', status: 'AVAILABLE', notes: '' };
const emptyTask: TaskForm = { name: '', short_code: '', description: '', customer_id: '', status: 'ACTIVE', color_bg: '#C8A96E', color_text: '#ffffff' };

const DEPT_OPTIONS = ['garten', 'unterhalt'];
const ROLE_OPTIONS: User['role'][] = ['GLOBAL_MANAGER', 'LOCAL_MANAGER', 'ARBEITER'];
const STATUS_OPTIONS: Machine['status'][] = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE'];
const TASK_STATUS = ['ACTIVE', 'INACTIVE', 'COMPLETED'];
const MACHINE_CATEGORIES = ['Bagger', 'Dumper', 'Rasenmäher', 'Kettensäge', 'Heckenschere', 'Laubbläser', 'Transporter', 'Anhänger', 'Sonstiges'];

const roleLabel = (r: string) => r === 'GLOBAL_MANAGER' ? 'Global Manager' : r === 'LOCAL_MANAGER' ? 'Lokal Manager' : 'Arbeiter';
const statusLabel = (s: string): string => ({ AVAILABLE: 'Verfügbar', IN_USE: 'In Gebrauch', MAINTENANCE: 'Wartung', OUT_OF_SERVICE: 'Ausser Betrieb' }[s] || s);
const statusColor = (s: string): string => ({ AVAILABLE: '#4caf50', IN_USE: '#C8A96E', MAINTENANCE: '#ff9800', OUT_OF_SERVICE: '#f44336' }[s] || '#888');

type Tab = 'users' | 'customers' | 'machines' | 'tasks';

export function AdminPage() {
  const { isDark, th } = useTheme();
  const { user: authUser, token } = useAuthStore();
  const API = import.meta.env.VITE_API_URL || '';
  const isGlobal = (authUser?.role || '').toUpperCase() === 'GLOBAL_MANAGER';
  const isManager = isGlobal || (authUser?.role || '').toUpperCase() === 'LOCAL_MANAGER';

  /* ─── state ─── */
  const [tab, setTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalType, setModalType] = useState<Tab | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // Data
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Forms
  const [userForm, setUserForm] = useState<UserForm>({ ...emptyUser });
  const [custForm, setCustForm] = useState<CustomerForm>({ ...emptyCustomer });
  const [machForm, setMachForm] = useState<MachineForm>({ ...emptyMachine });
  const [taskForm, setTaskForm] = useState<TaskForm>({ ...emptyTask });

  // Filters
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterManager, setFilterManager] = useState('');
  const [filterMachCat, setFilterMachCat] = useState('');
  const [filterMachStatus, setFilterMachStatus] = useState('');
  const [filterTaskStatus, setFilterTaskStatus] = useState('');

  /* ─── helpers ─── */
  const hdrs = useCallback(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const gold = th.gold;
  const inputBg = isDark ? '#1a1a3e' : '#faf7f2';
  const hoverBg = isDark ? '#1e2a4a' : '#faf7f2';
  const dangerBg = '#6B3A3A';
  const successBg = isDark ? '#2a4a2a' : '#e8f5e9';

  /* ─── fetch all ─── */
  const fetchUsers = useCallback(async () => {
    try { const r = await fetch(`${API}/api/v1/users`, { headers: hdrs() }); const { data } = await r.json(); setUsers(data || []); } catch { }
  }, [API, hdrs]);
  const fetchCustomers = useCallback(async () => {
    try { const r = await fetch(`${API}/api/v1/customers`, { headers: hdrs() }); const { data } = await r.json(); setCustomers(data || []); } catch { }
  }, [API, hdrs]);
  const fetchMachines = useCallback(async () => {
    try { const r = await fetch(`${API}/api/v1/machines`, { headers: hdrs() }); const { data } = await r.json(); setMachines(data || []); } catch { }
  }, [API, hdrs]);
  const fetchTasks = useCallback(async () => {
    try { const r = await fetch(`${API}/api/v1/tasks`, { headers: hdrs() }); const { data } = await r.json(); setTasks(data || []); } catch { }
  }, [API, hdrs]);

  useEffect(() => { fetchUsers(); fetchCustomers(); fetchMachines(); fetchTasks(); }, [fetchUsers, fetchCustomers, fetchMachines, fetchTasks]);

  /* ─── derived ─── */
  const localManagers = users.filter(u => u.role === 'LOCAL_MANAGER');
  const managerName = (id: string | null | undefined) => {
    if (!id) return '—';
    const m = users.find(u => u.id === id);
    return m ? `${m.first_name} ${m.last_name}` : '—';
  };
  const customerName = (id: string | undefined) => {
    if (!id) return '—';
    const c = customers.find(c => c.id === id);
    return c ? c.name : '—';
  };

  /* ─── filtered data ─── */
  const q = search.toLowerCase();
  const filteredUsers = users.filter(u => {
    const ms = !q || `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(q);
    const md = !filterDept || (u.departments || []).includes(filterDept);
    const mr = !filterRole || u.role === filterRole;
    const mm = !filterManager || (filterManager === 'unassigned' ? !u.manager_id : u.manager_id === filterManager);
    return ms && md && mr && mm;
  });
  const filteredCustomers = customers.filter(c => !q || `${c.name} ${c.city || ''} ${c.contact_person || ''}`.toLowerCase().includes(q));
  const filteredMachines = machines.filter(m => {
    const ms = !q || `${m.name} ${m.category || ''}`.toLowerCase().includes(q);
    const mc = !filterMachCat || m.category === filterMachCat;
    const mst = !filterMachStatus || m.status === filterMachStatus;
    return ms && mc && mst;
  });
  const filteredTasks = tasks.filter(t => {
    const ms = !q || `${t.name} ${t.short_code}`.toLowerCase().includes(q);
    const mst = !filterTaskStatus || t.status === filterTaskStatus;
    return ms && mst;
  });

  /* ─── open modals ─── */
  const openNewUser = () => { setEditId(null); setUserForm({ ...emptyUser, manager_id: !isGlobal && authUser?.id ? authUser.id : '' }); setModalType('users'); };
  const openEditUser = (u: User) => { setEditId(u.id); setUserForm({ email: u.email, first_name: u.first_name, last_name: u.last_name, role: u.role, departments: u.departments || [], phone: u.phone || '', password: '', is_active: u.is_active !== false, manager_id: u.manager_id || '' }); setModalType('users'); };

  const openNewCustomer = () => { setEditId(null); setCustForm({ ...emptyCustomer }); setModalType('customers'); };
  const openEditCustomer = (c: Customer) => { setEditId(c.id); setCustForm({ name: c.name, address: c.address || '', city: c.city || '', zip: c.zip || '', phone: c.phone || '', email: c.email || '', contact_person: c.contact_person || '', notes: c.notes || '' }); setModalType('customers'); };

  const openNewMachine = () => { setEditId(null); setMachForm({ ...emptyMachine }); setModalType('machines'); };
  const openEditMachine = (m: Machine) => { setEditId(m.id); setMachForm({ name: m.name, category: m.category || '', status: m.status, notes: m.notes || '' }); setModalType('machines'); };

  const openNewTask = () => { setEditId(null); setTaskForm({ ...emptyTask }); setModalType('tasks'); };
  const openEditTask = (t: Task) => { setEditId(t.id); setTaskForm({ name: t.name, short_code: t.short_code || '', description: t.description || '', customer_id: t.customer_id || '', status: t.status || 'ACTIVE', color_bg: t.color_bg || '#C8A96E', color_text: t.color_text || '#ffffff' }); setModalType('tasks'); };

  /* ─── save / delete generics ─── */
  const saveEntity = async (endpoint: string, body: any, refresh: () => void) => {
    setSaving(true);
    try {
      const url = editId ? `${API}/api/v1/${endpoint}/${editId}` : `${API}/api/v1/${endpoint}`;
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: hdrs(), body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Error'); }
      showToast('✅ Gespeichert');
      setModalType(null);
      refresh();
    } catch (e: any) { showToast(`❌ Fehler: ${e.message}`); }
    setSaving(false);
  };

  const deleteEntity = async (endpoint: string, id: string, refresh: () => void) => {
    try {
      const res = await fetch(`${API}/api/v1/${endpoint}/${id}`, { method: 'DELETE', headers: hdrs() });
      if (!res.ok) throw new Error();
      showToast('🗑 Gelöscht');
      setConfirmDel(null);
      refresh();
    } catch { showToast('❌ Fehler'); }
  };

  const saveUser = () => {
    const body: any = { ...userForm };
    if (editId && !body.password) delete body.password;
    if (!body.manager_id) delete body.manager_id;
    saveEntity('users', body, fetchUsers);
  };
  const saveCustomer = () => saveEntity('customers', custForm, fetchCustomers);
  const saveMachine = () => saveEntity('machines', machForm, fetchMachines);
  const saveTask = () => saveEntity('tasks', taskForm, fetchTasks);

  /* ─── toggle helpers ─── */
  const toggleDept = (d: string) => setUserForm(f => ({ ...f, departments: f.departments.includes(d) ? f.departments.filter(x => x !== d) : [...f.departments, d] }));

  /* ─── styles ─── */
  const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const modalBox: React.CSSProperties = { background: th.bgCard, borderRadius: 16, padding: 32, width: 560, maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${th.border}`, boxShadow: '0 20px 60px rgba(0,0,0,.4)' };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: th.textDim, marginBottom: 4, display: 'block' };
  const btnGold: React.CSSProperties = { background: `linear-gradient(135deg, ${gold}, #b8956a)`, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 15, boxShadow: '0 4px 15px rgba(200,169,110,.4)' };
  const btnSave: React.CSSProperties = { ...btnGold, borderRadius: 8, padding: '10px 24px', fontSize: 14, opacity: saving ? .7 : 1, cursor: saving ? 'wait' : 'pointer' };
  const btnCancel: React.CSSProperties = { padding: '10px 24px', borderRadius: 8, border: `1px solid ${th.border}`, background: 'transparent', color: th.text, cursor: 'pointer', fontWeight: 600, fontSize: 14 };

  /* ─── tab config ─── */
  const tabs: { key: Tab; label: string; icon: string; visible: boolean }[] = [
    { key: 'users', label: 'Benutzer', icon: '👥', visible: true },
    { key: 'customers', label: 'Kunden', icon: '🏢', visible: isGlobal },
    { key: 'machines', label: 'Maschinen', icon: '🚜', visible: isManager },
    { key: 'tasks', label: 'Aufträge', icon: '📋', visible: isManager },
  ];

  /* ─── delete confirm button ─── */
  const DeleteBtn = ({ id, endpoint, refresh }: { id: string; endpoint: string; refresh: () => void }) => (
    confirmDel === id ? (
      <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
        <button onClick={() => deleteEntity(endpoint, id, refresh)} style={{ background: dangerBg, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>✓ Löschen</button>
        <button onClick={() => setConfirmDel(null)} style={{ background: 'transparent', color: th.textDim, border: `1px solid ${th.border}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 11 }}>Nein</button>
      </div>
    ) : (
      <button onClick={e => { e.stopPropagation(); setConfirmDel(id); }} style={{ background: 'transparent', color: '#f44336', border: 'none', cursor: 'pointer', fontSize: 14, padding: 4 }} title="Löschen">🗑</button>
    )
  );

  return (
    <div style={{ background: th.bg, minHeight: '100vh', padding: '24px 32px', color: th.text, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      {/* toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 2000,
          background: toast.includes('❌') ? dangerBg : successBg,
          color: toast.includes('❌') ? '#fff' : th.text,
          padding: '12px 24px', borderRadius: 10, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,.3)',
        }}>{toast}</div>
      )}

      {/* page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Administration</h1>
        <button
          onClick={() => {
            if (tab === 'users') openNewUser();
            else if (tab === 'customers') openNewCustomer();
            else if (tab === 'machines') openNewMachine();
            else if (tab === 'tasks') openNewTask();
          }}
          style={btnGold}
        >+ Neu</button>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {tabs.filter(t => t.visible).map(tb => (
          <button key={tb.key} onClick={() => { setTab(tb.key); setSearch(''); setConfirmDel(null); }}
            style={{
              padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              border: 'none', transition: 'all .15s',
              background: tab === tb.key ? `linear-gradient(135deg, ${gold}, #b8956a)` : (isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)'),
              color: tab === tb.key ? '#fff' : th.textDim,
            }}
          >{tb.icon} {tb.label}</button>
        ))}
      </div>

      {/* search + filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '10px 16px', borderRadius: 10, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14, outline: 'none' }} />

        {tab === 'users' && (
          <>
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
              style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14 }}>
              <option value="">Alle Rollen</option>
              {ROLE_OPTIONS.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
              style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14 }}>
              <option value="">Alle Abteilungen</option>
              {DEPT_OPTIONS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
            </select>
            {isGlobal && (
              <select value={filterManager} onChange={e => setFilterManager(e.target.value)}
                style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14 }}>
                <option value="">Alle Teams</option>
                <option value="unassigned">Nicht zugewiesen</option>
                {localManagers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
              </select>
            )}
          </>
        )}
        {tab === 'machines' && (
          <>
            <select value={filterMachCat} onChange={e => setFilterMachCat(e.target.value)}
              style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14 }}>
              <option value="">Alle Kategorien</option>
              {MACHINE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterMachStatus} onChange={e => setFilterMachStatus(e.target.value)}
              style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14 }}>
              <option value="">Alle Status</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </>
        )}
        {tab === 'tasks' && (
          <select value={filterTaskStatus} onChange={e => setFilterTaskStatus(e.target.value)}
            style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14 }}>
            <option value="">Alle Status</option>
            {TASK_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {/* ════════════════════════ USERS TAB ════════════════════════ */}
      {tab === 'users' && (
        <div style={{ background: th.bgCard, borderRadius: 14, border: `1px solid ${th.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: th.bgHeader, color: '#fff' }}>
                {['', 'Name', 'E-Mail', 'Rolle', 'Abteilungen', ...(isGlobal ? ['Vorgesetzter'] : []), 'Status', ''].map((h, i) => (
                  <th key={i} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 && <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: th.textDim }}>Keine Benutzer</td></tr>}
              {filteredUsers.map((u, i) => (
                <tr key={u.id} style={{ background: i % 2 ? (isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)') : 'transparent', cursor: 'pointer', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = hoverBg}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 ? (isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)') : 'transparent'}
                  onClick={() => openEditUser(u)}>
                  <td style={{ padding: '10px 16px', width: 40 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${gold}, #b8956a)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                      {u.first_name?.[0]}{u.last_name?.[0]}
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>{u.first_name} {u.last_name}</td>
                  <td style={{ padding: '10px 16px', color: th.textDim, fontSize: 13 }}>{u.email}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: u.role === 'GLOBAL_MANAGER' ? 'rgba(200,169,110,.2)' : u.role === 'LOCAL_MANAGER' ? 'rgba(100,149,237,.2)' : 'rgba(255,255,255,.1)', color: u.role === 'GLOBAL_MANAGER' ? gold : u.role === 'LOCAL_MANAGER' ? '#6495ed' : th.textDim }}>{roleLabel(u.role)}</span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(u.departments || []).map(d => <span key={d} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: d === 'garten' ? 'rgba(76,175,80,.15)' : 'rgba(255,152,0,.15)', color: d === 'garten' ? '#4caf50' : '#ff9800' }}>{d}</span>)}
                    </div>
                  </td>
                  {isGlobal && <td style={{ padding: '10px 16px', fontSize: 12, color: th.textDim }}>{managerName(u.manager_id)}</td>}
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: u.is_active !== false ? '#4caf50' : '#f44336', marginRight: 6 }} />
                    <span style={{ fontSize: 12 }}>{u.is_active !== false ? 'Aktiv' : 'Inaktiv'}</span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>{isGlobal && <DeleteBtn id={u.id} endpoint="users" refresh={fetchUsers} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ════════════════════════ CUSTOMERS TAB ════════════════════════ */}
      {tab === 'customers' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filteredCustomers.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: th.textDim }}>Keine Kunden</div>}
          {filteredCustomers.map(c => (
            <div key={c.id} onClick={() => openEditCustomer(c)}
              style={{ background: th.bgCard, borderRadius: 14, padding: 20, border: `1px solid ${th.border}`, cursor: 'pointer', transition: 'all .15s', position: 'relative' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = gold}
              onMouseLeave={e => e.currentTarget.style.borderColor = th.border}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{c.name}</h3>
                  {c.contact_person && <p style={{ margin: '4px 0 0', fontSize: 12, color: th.textDim }}>👤 {c.contact_person}</p>}
                </div>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg, ${gold}33, ${gold}11)`, color: gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏢</div>
              </div>
              {(c.address || c.city) && <p style={{ margin: '10px 0 0', fontSize: 13, color: th.textDim }}>📍 {[c.address, c.zip, c.city].filter(Boolean).join(', ')}</p>}
              {c.phone && <p style={{ margin: '4px 0 0', fontSize: 13, color: th.textDim }}>📞 {c.phone}</p>}
              {c.email && <p style={{ margin: '4px 0 0', fontSize: 13, color: th.textDim }}>✉️ {c.email}</p>}
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: th.textDim }}>{tasks.filter(t => t.customer_id === c.id).length} Aufträge</span>
                {isGlobal && <DeleteBtn id={c.id} endpoint="customers" refresh={fetchCustomers} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════ MACHINES TAB ════════════════════════ */}
      {tab === 'machines' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filteredMachines.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: th.textDim }}>Keine Maschinen</div>}
          {filteredMachines.map(m => (
            <div key={m.id} onClick={() => openEditMachine(m)}
              style={{ background: th.bgCard, borderRadius: 14, padding: 20, border: `1px solid ${th.border}`, cursor: 'pointer', transition: 'all .15s', position: 'relative', overflow: 'hidden' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = gold}
              onMouseLeave={e => e.currentTarget.style.borderColor = th.border}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: statusColor(m.status) }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{m.name}</h3>
                  {m.category && <p style={{ margin: '4px 0 0', fontSize: 12, color: th.textDim }}>{m.category}</p>}
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: `${statusColor(m.status)}22`, color: statusColor(m.status) }}>{statusLabel(m.status)}</span>
              </div>
              {m.notes && <p style={{ margin: '12px 0 0', fontSize: 13, color: th.textDim, lineHeight: 1.4 }}>{m.notes}</p>}
              <div style={{ marginTop: 12, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                <DeleteBtn id={m.id} endpoint="machines" refresh={fetchMachines} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════ TASKS TAB ════════════════════════ */}
      {tab === 'tasks' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filteredTasks.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: th.textDim }}>Keine Aufträge</div>}
          {filteredTasks.map(t => (
            <div key={t.id} onClick={() => openEditTask(t)}
              style={{ background: th.bgCard, borderRadius: 14, padding: 20, border: `1px solid ${th.border}`, cursor: 'pointer', transition: 'all .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = gold}
              onMouseLeave={e => e.currentTarget.style.borderColor = th.border}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: t.color_bg || gold, color: t.color_text || '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                    {t.short_code || '?'}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{t.name}</h3>
                    {t.customer_id && <p style={{ margin: '2px 0 0', fontSize: 11, color: th.textDim }}>🏢 {customerName(t.customer_id)}</p>}
                  </div>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: t.status === 'ACTIVE' ? 'rgba(76,175,80,.15)' : t.status === 'COMPLETED' ? 'rgba(200,169,110,.15)' : 'rgba(244,67,54,.15)', color: t.status === 'ACTIVE' ? '#4caf50' : t.status === 'COMPLETED' ? gold : '#f44336' }}>{t.status}</span>
              </div>
              {t.description && <p style={{ margin: '10px 0 0', fontSize: 13, color: th.textDim, lineHeight: 1.4 }}>{t.description}</p>}
              <div style={{ marginTop: 12, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                <DeleteBtn id={t.id} endpoint="tasks" refresh={fetchTasks} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════ USER MODAL ════════════════════════ */}
      {modalType === 'users' && (
        <div style={modalOverlay} onClick={() => setModalType(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700, color: gold }}>{editId ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><label style={labelStyle}>Vorname</label><input value={userForm.first_name} onChange={e => setUserForm(f => ({ ...f, first_name: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Nachname</label><input value={userForm.last_name} onChange={e => setUserForm(f => ({ ...f, last_name: e.target.value }))} style={inputStyle} /></div>
            </div>
            <div style={{ marginTop: 16 }}><label style={labelStyle}>E-Mail</label><input value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} type="email" style={inputStyle} /></div>
            <div style={{ marginTop: 16 }}><label style={labelStyle}>Telefon</label><input value={userForm.phone} onChange={e => setUserForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} /></div>
            <div style={{ marginTop: 16 }}><label style={labelStyle}>Passwort {editId && <span style={{ fontWeight: 400 }}>(leer = unverändert)</span>}</label><input value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} type="password" placeholder={editId ? '••••••••' : ''} style={inputStyle} /></div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Rolle</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(isGlobal ? ROLE_OPTIONS : ['ARBEITER'] as User['role'][]).map(r => (
                  <button key={r} onClick={() => isGlobal && setUserForm(f => ({ ...f, role: r }))} style={{ flex: 1, padding: '10px 8px', borderRadius: 8, cursor: isGlobal ? 'pointer' : 'default', fontWeight: 600, fontSize: 13, border: userForm.role === r ? `2px solid ${gold}` : `1px solid ${th.border}`, background: userForm.role === r ? (isDark ? 'rgba(200,169,110,.15)' : 'rgba(200,169,110,.1)') : 'transparent', color: userForm.role === r ? gold : th.text, transition: 'all .15s', opacity: !isGlobal && userForm.role !== r ? .3 : 1 }}>{roleLabel(r)}</button>
                ))}
              </div>
            </div>
            {isGlobal && userForm.role === 'ARBEITER' && (
              <div style={{ marginTop: 16 }}><label style={labelStyle}>Vorgesetzter</label>
                <select value={userForm.manager_id} onChange={e => setUserForm(f => ({ ...f, manager_id: e.target.value }))} style={inputStyle}>
                  <option value="">Kein Vorgesetzter</option>
                  {localManagers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                </select>
              </div>
            )}
            <div style={{ marginTop: 16 }}><label style={labelStyle}>Abteilungen</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {DEPT_OPTIONS.map(d => (
                  <button key={d} onClick={() => toggleDept(d)} style={{ flex: 1, padding: '10px 8px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, border: userForm.departments.includes(d) ? `2px solid ${d === 'garten' ? '#4caf50' : '#ff9800'}` : `1px solid ${th.border}`, background: userForm.departments.includes(d) ? (d === 'garten' ? 'rgba(76,175,80,.12)' : 'rgba(255,152,0,.12)') : 'transparent', color: userForm.departments.includes(d) ? (d === 'garten' ? '#4caf50' : '#ff9800') : th.text, transition: 'all .15s' }}>{d.charAt(0).toUpperCase() + d.slice(1)}</button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: th.textDim }}>Status</label>
              <button onClick={() => setUserForm(f => ({ ...f, is_active: !f.is_active }))} style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: userForm.is_active ? '#4caf50' : '#666', position: 'relative', transition: 'background .2s' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: userForm.is_active ? 24 : 4, transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }} />
              </button>
              <span style={{ fontSize: 13, color: userForm.is_active ? '#4caf50' : '#f44336', fontWeight: 600 }}>{userForm.is_active ? 'Aktiv' : 'Inaktiv'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 28 }}>
              <button onClick={() => setModalType(null)} style={btnCancel}>Abbrechen</button>
              <button onClick={saveUser} disabled={saving} style={btnSave}>{saving ? '...' : 'Speichern'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════ CUSTOMER MODAL ════════════════════════ */}
      {modalType === 'customers' && (
        <div style={modalOverlay} onClick={() => setModalType(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700, color: gold }}>{editId ? 'Kunde bearbeiten' : 'Neuer Kunde'}</h2>
            <div><label style={labelStyle}>Firmenname *</label><input value={custForm.name} onChange={e => setCustForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} /></div>
            <div style={{ marginTop: 16 }}><label style={labelStyle}>Kontaktperson</label><input value={custForm.contact_person} onChange={e => setCustForm(f => ({ ...f, contact_person: e.target.value }))} style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              <div><label style={labelStyle}>E-Mail</label><input value={custForm.email} onChange={e => setCustForm(f => ({ ...f, email: e.target.value }))} type="email" style={inputStyle} /></div>
              <div><label style={labelStyle}>Telefon</label><input value={custForm.phone} onChange={e => setCustForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} /></div>
            </div>
            <div style={{ marginTop: 16 }}><label style={labelStyle}>Adresse</label><input value={custForm.address} onChange={e => setCustForm(f => ({ ...f, address: e.target.value }))} style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, marginTop: 16 }}>
              <div><label style={labelStyle}>PLZ</label><input value={custForm.zip} onChange={e => setCustForm(f => ({ ...f, zip: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Ort</label><input value={custForm.city} onChange={e => setCustForm(f => ({ ...f, city: e.target.value }))} style={inputStyle} /></div>
            </div>
            <div style={{ marginTop: 16 }}><label style={labelStyle}>Notizen</label><textarea value={custForm.notes} onChange={e => setCustForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 28 }}>
              <button onClick={() => setModalType(null)} style={btnCancel}>Abbrechen</button>
              <button onClick={saveCustomer} disabled={saving || !custForm.name} style={{ ...btnSave, opacity: (saving || !custForm.name) ? .5 : 1 }}>{saving ? '...' : 'Speichern'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════ MACHINE MODAL ════════════════════════ */}
      {modalType === 'machines' && (
        <div style={modalOverlay} onClick={() => setModalType(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700, color: gold }}>{editId ? 'Maschine bearbeiten' : 'Neue Maschine'}</h2>
            <div><label style={labelStyle}>Name *</label><input value={machForm.name} onChange={e => setMachForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} /></div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Kategorie</label>
              <select value={machForm.category} onChange={e => setMachForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                <option value="">—</option>
                {MACHINE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Status</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {STATUS_OPTIONS.map(s => (
                  <button key={s} onClick={() => setMachForm(f => ({ ...f, status: s }))} style={{ flex: 1, padding: '10px 6px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 11, border: machForm.status === s ? `2px solid ${statusColor(s)}` : `1px solid ${th.border}`, background: machForm.status === s ? `${statusColor(s)}22` : 'transparent', color: machForm.status === s ? statusColor(s) : th.text, transition: 'all .15s', minWidth: 80 }}>{statusLabel(s)}</button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 16 }}><label style={labelStyle}>Notizen</label><textarea value={machForm.notes} onChange={e => setMachForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 28 }}>
              <button onClick={() => setModalType(null)} style={btnCancel}>Abbrechen</button>
              <button onClick={saveMachine} disabled={saving || !machForm.name} style={{ ...btnSave, opacity: (saving || !machForm.name) ? .5 : 1 }}>{saving ? '...' : 'Speichern'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════ TASK MODAL ════════════════════════ */}
      {modalType === 'tasks' && (
        <div style={modalOverlay} onClick={() => setModalType(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700, color: gold }}>{editId ? 'Auftrag bearbeiten' : 'Neuer Auftrag'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 16 }}>
              <div><label style={labelStyle}>Name *</label><input value={taskForm.name} onChange={e => setTaskForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Code *</label><input value={taskForm.short_code} onChange={e => setTaskForm(f => ({ ...f, short_code: e.target.value }))} maxLength={4} style={{ ...inputStyle, textAlign: 'center', fontWeight: 700, textTransform: 'lowercase' }} /></div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Kunde</label>
              <select value={taskForm.customer_id} onChange={e => setTaskForm(f => ({ ...f, customer_id: e.target.value }))} style={inputStyle}>
                <option value="">— Kein Kunde —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ marginTop: 16 }}><label style={labelStyle}>Beschreibung</label><textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Status</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {TASK_STATUS.map(s => (
                  <button key={s} onClick={() => setTaskForm(f => ({ ...f, status: s }))} style={{ flex: 1, padding: '10px 8px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, border: taskForm.status === s ? `2px solid ${s === 'ACTIVE' ? '#4caf50' : s === 'COMPLETED' ? gold : '#f44336'}` : `1px solid ${th.border}`, background: taskForm.status === s ? (s === 'ACTIVE' ? 'rgba(76,175,80,.12)' : s === 'COMPLETED' ? 'rgba(200,169,110,.12)' : 'rgba(244,67,54,.12)') : 'transparent', color: taskForm.status === s ? (s === 'ACTIVE' ? '#4caf50' : s === 'COMPLETED' ? gold : '#f44336') : th.text, transition: 'all .15s' }}>{s}</button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Farben</label>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 12, color: th.textDim }}>Hintergrund</label>
                  <input type="color" value={taskForm.color_bg} onChange={e => setTaskForm(f => ({ ...f, color_bg: e.target.value }))} style={{ width: 40, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 12, color: th.textDim }}>Text</label>
                  <input type="color" value={taskForm.color_text} onChange={e => setTaskForm(f => ({ ...f, color_text: e.target.value }))} style={{ width: 40, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} />
                </div>
                <div style={{ padding: '8px 16px', borderRadius: 8, background: taskForm.color_bg, color: taskForm.color_text, fontWeight: 700, fontSize: 13 }}>
                  {taskForm.short_code || 'abc'} — Vorschau
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 28 }}>
              <button onClick={() => setModalType(null)} style={btnCancel}>Abbrechen</button>
              <button onClick={saveTask} disabled={saving || !taskForm.name || !taskForm.short_code} style={{ ...btnSave, opacity: (saving || !taskForm.name || !taskForm.short_code) ? .5 : 1 }}>{saving ? '...' : 'Speichern'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
