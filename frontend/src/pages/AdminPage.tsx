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
  active: boolean;
  manager_id?: string | null;
  created_at: string;
}

interface UserForm {
  email: string;
  first_name: string;
  last_name: string;
  role: 'GLOBAL_MANAGER' | 'LOCAL_MANAGER' | 'ARBEITER';
  departments: string[];
  phone: string;
  password: string;
  active: boolean;
  manager_id: string;
}

const emptyForm: UserForm = {
  email: '', first_name: '', last_name: '',
  role: 'ARBEITER', departments: [], phone: '', password: '', active: true, manager_id: '',
};

const DEPT_OPTIONS = ['garten', 'unterhalt'];
const ROLE_OPTIONS: User['role'][] = ['GLOBAL_MANAGER', 'LOCAL_MANAGER', 'ARBEITER'];

const roleLabel = (r: string) =>
  r === 'GLOBAL_MANAGER' ? 'Global Manager' : r === 'LOCAL_MANAGER' ? 'Lokal Manager' : 'Arbeiter';

export function AdminPage() {
  const { isDark, th } = useTheme();
  const { user: authUser, token } = useAuthStore();
  const API = import.meta.env.VITE_API_URL || '';
  const isGlobal = (authUser?.role || '').toUpperCase() === 'GLOBAL_MANAGER';

  const L = {
    title: 'Benutzerverwaltung',
    addUser: 'Neuer Benutzer',
    editUser: 'Benutzer bearbeiten',
    email: 'E-Mail',
    firstName: 'Vorname',
    lastName: 'Nachname',
    role: 'Rolle',
    departments: 'Abteilungen',
    phone: 'Telefon',
    password: 'Passwort',
    passwordHint: '(leer = unverändert)',
    active: 'Aktiv',
    inactive: 'Inaktiv',
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    search: 'Suchen…',
    allDepts: 'Alle Abteilungen',
    allRoles: 'Alle Rollen',
    allManagers: 'Alle Teams',
    noManager: 'Kein Vorgesetzter',
    noUsers: 'Keine Benutzer gefunden',
    actions: 'Aktionen',
    userSaved: 'Benutzer gespeichert',
    userDeleted: 'Benutzer gelöscht',
    error: 'Fehler',
    status: 'Status',
    total: 'Total',
    managers: 'Manager',
    workers: 'Arbeiter',
    activeUsers: 'Aktiv',
    manager: 'Vorgesetzter',
    team: 'Team',
    unassigned: 'Nicht zugewiesen',
  };

  /* state */
  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]); // for global admin to see all
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterManager, setFilterManager] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  /* fetch */
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/users`, { headers: headers() });
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      const list = data || [];
      setUsers(list);
      setAllUsers(list);
    } catch { showToast(L.error); }
  }, [API, headers]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  /* derived data */
  const localManagers = allUsers.filter(u => u.role === 'LOCAL_MANAGER');

  const managerName = (id: string | null | undefined) => {
    if (!id) return L.unassigned;
    const m = allUsers.find(u => u.id === id);
    return m ? `${m.first_name} ${m.last_name}` : L.unassigned;
  };

  /* filter */
  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.first_name.toLowerCase().includes(q) || u.last_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchDept = !filterDept || (u.departments && u.departments.includes(filterDept));
    const matchRole = !filterRole || u.role === filterRole;
    const matchManager = !filterManager || (
      filterManager === 'unassigned' ? !u.manager_id : u.manager_id === filterManager
    );
    return matchSearch && matchDept && matchRole && matchManager;
  });

  /* grouped view for global admin */
  const groupedByManager = isGlobal ? (() => {
    const groups: Record<string, User[]> = { unassigned: [] };
    localManagers.forEach(m => { groups[m.id] = []; });
    filtered.forEach(u => {
      if (u.role !== 'ARBEITER') return; // only group workers
      if (u.manager_id && groups[u.manager_id]) {
        groups[u.manager_id].push(u);
      } else {
        groups['unassigned'].push(u);
      }
    });
    return groups;
  })() : null;

  /* open modal */
  const openNew = () => {
    setEditId(null);
    const f = { ...emptyForm };
    // Local managers auto-assign new users to themselves
    if (!isGlobal && authUser?.id) {
      f.manager_id = authUser.id;
    }
    setForm(f);
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditId(u.id);
    setForm({
      email: u.email, first_name: u.first_name, last_name: u.last_name,
      role: u.role, departments: u.departments || [], phone: u.phone || '',
      password: '', active: u.active !== false, manager_id: u.manager_id || '',
    });
    setModalOpen(true);
  };

  /* save */
  const saveUser = async () => {
    setSaving(true);
    try {
      const body: any = { ...form };
      if (editId && !body.password) delete body.password;
      if (!body.manager_id) delete body.manager_id;
      const url = editId ? `${API}/api/v1/users/${editId}` : `${API}/api/v1/users`;
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Error'); }
      showToast(L.userSaved);
      setModalOpen(false);
      fetchUsers();
    } catch (e: any) { showToast(`${L.error}: ${e.message}`); }
    setSaving(false);
  };

  /* delete */
  const deleteUser = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/v1/users/${id}`, { method: 'DELETE', headers: headers() });
      if (!res.ok) throw new Error();
      showToast(L.userDeleted);
      setConfirmDel(null);
      fetchUsers();
    } catch { showToast(L.error); }
  };

  /* toggle department */
  const toggleDept = (d: string) => {
    setForm(f => ({
      ...f,
      departments: f.departments.includes(d) ? f.departments.filter(x => x !== d) : [...f.departments, d],
    }));
  };

  /* stats */
  const totalActive = users.filter(u => u.active !== false).length;
  const totalManagers = users.filter(u => u.role !== 'ARBEITER').length;
  const totalWorkers = users.filter(u => u.role === 'ARBEITER').length;

  /* ─── styles ─── */
  const gold = th.gold;
  const inputBg = isDark ? '#1a1a3e' : '#faf7f2';
  const hoverBg = isDark ? '#1e2a4a' : '#faf7f2';
  const dangerBg = '#6B3A3A';
  const successBg = isDark ? '#2a4a2a' : '#e8f5e9';

  const modalOverlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const modalBox: React.CSSProperties = {
    background: th.bgCard, borderRadius: 16, padding: 32, width: 560,
    maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${th.border}`,
    boxShadow: '0 20px 60px rgba(0,0,0,.4)',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: `1px solid ${th.border}`, background: inputBg, color: th.text,
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: th.textDim, marginBottom: 4, display: 'block',
  };

  /* ─── render a user row ─── */
  const renderUserRow = (u: User, i: number) => (
    <tr
      key={u.id}
      style={{
        background: i % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)'),
        cursor: 'pointer', transition: 'background .15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)'))}
      onClick={() => openEdit(u)}
    >
      <td style={{ padding: '10px 16px', width: 40 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: `linear-gradient(135deg, ${gold}, #b8956a)`, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13,
        }}>
          {u.first_name?.[0]}{u.last_name?.[0]}
        </div>
      </td>
      <td style={{ padding: '10px 16px', fontWeight: 600 }}>{u.first_name} {u.last_name}</td>
      <td style={{ padding: '10px 16px', color: th.textDim, fontSize: 13 }}>{u.email}</td>
      <td style={{ padding: '10px 16px' }}>
        <span style={{
          padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
          background: u.role === 'GLOBAL_MANAGER' ? 'rgba(200,169,110,.2)' : u.role === 'LOCAL_MANAGER' ? 'rgba(100,149,237,.2)' : 'rgba(255,255,255,.1)',
          color: u.role === 'GLOBAL_MANAGER' ? gold : u.role === 'LOCAL_MANAGER' ? '#6495ed' : th.textDim,
        }}>{roleLabel(u.role)}</span>
      </td>
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(u.departments || []).map(d => (
            <span key={d} style={{
              padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
              background: d === 'garten' ? 'rgba(76,175,80,.15)' : 'rgba(255,152,0,.15)',
              color: d === 'garten' ? '#4caf50' : '#ff9800',
            }}>{d}</span>
          ))}
        </div>
      </td>
      {isGlobal && (
        <td style={{ padding: '10px 16px', fontSize: 12, color: th.textDim }}>
          {u.manager_id ? managerName(u.manager_id) : <span style={{ opacity: .4 }}>{L.unassigned}</span>}
        </td>
      )}
      <td style={{ padding: '10px 16px' }}>
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: u.active !== false ? '#4caf50' : '#f44336', marginRight: 6,
        }} />
        <span style={{ fontSize: 12 }}>{u.active !== false ? L.active : L.inactive}</span>
      </td>
      <td style={{ padding: '10px 16px' }} onClick={e => e.stopPropagation()}>
        {isGlobal && (
          confirmDel === u.id ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => deleteUser(u.id)}
                style={{ background: dangerBg, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                ✓ {L.delete}</button>
              <button onClick={() => setConfirmDel(null)}
                style={{ background: 'transparent', color: th.textDim, border: `1px solid ${th.border}`, borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
                {L.cancel}</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDel(u.id)}
              style={{ background: 'transparent', color: '#f44336', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4 }}
              title={L.delete}>🗑</button>
          )
        )}
      </td>
    </tr>
  );

  const tableHeaders = ['', L.firstName + ' ' + L.lastName, L.email, L.role, L.departments,
    ...(isGlobal ? [L.manager] : []), L.status, ...(isGlobal ? [L.actions] : [])];

  return (
    <div style={{ background: th.bg, minHeight: '100vh', padding: '24px 32px', color: th.text, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      {/* toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 2000,
          background: toast.includes(L.error) ? dangerBg : successBg,
          color: toast.includes(L.error) ? '#fff' : th.text,
          padding: '12px 24px', borderRadius: 10, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,.3)', transition: 'all .3s',
        }}>{toast}</div>
      )}

      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{L.title}</h1>
          <p style={{ margin: '4px 0 0', color: th.textDim, fontSize: 14 }}>
            {L.total}: {users.length} · {L.activeUsers}: {totalActive} · {L.managers}: {totalManagers} · {L.workers}: {totalWorkers}
          </p>
        </div>
        <button onClick={openNew} style={{
          background: `linear-gradient(135deg, ${gold}, #b8956a)`, color: '#fff',
          border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700,
          cursor: 'pointer', fontSize: 15, boxShadow: '0 4px 15px rgba(200,169,110,.4)',
        }}>+ {L.addUser}</button>
      </div>

      {/* filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input placeholder={L.search} value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '10px 16px', borderRadius: 10, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14, outline: 'none' }} />
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14 }}>
          <option value="">{L.allDepts}</option>
          {DEPT_OPTIONS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
        </select>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14 }}>
          <option value="">{L.allRoles}</option>
          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
        {isGlobal && (
          <select value={filterManager} onChange={e => setFilterManager(e.target.value)}
            style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14 }}>
            <option value="">{L.allManagers}</option>
            <option value="unassigned">{L.unassigned}</option>
            {localManagers.map(m => (
              <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
            ))}
          </select>
        )}
      </div>

      {/* ─── TEAM GROUPED VIEW (global admin) ─── */}
      {isGlobal && !filterManager && !filterRole && !search && groupedByManager ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Local Managers + their teams */}
          {localManagers.map(manager => {
            const team = groupedByManager[manager.id] || [];
            return (
              <div key={manager.id} style={{
                background: th.bgCard, borderRadius: 14, border: `1px solid ${th.border}`, overflow: 'hidden',
              }}>
                {/* manager header */}
                <div style={{
                  padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14,
                  background: isDark ? 'rgba(100,149,237,.08)' : 'rgba(100,149,237,.06)',
                  borderBottom: `1px solid ${th.border}`, cursor: 'pointer',
                }} onClick={() => openEdit(manager)}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6495ed, #4a7bd4)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14,
                  }}>
                    {manager.first_name?.[0]}{manager.last_name?.[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{manager.first_name} {manager.last_name}</div>
                    <div style={{ fontSize: 11, color: '#6495ed', fontWeight: 600 }}>Lokal Manager · {(manager.departments || []).join(', ')}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: 13, color: th.textDim }}>
                    {team.length} {L.workers}
                  </div>
                </div>

                {/* team members */}
                {team.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {team.map((u, i) => renderUserRow(u, i))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: th.textDim, fontSize: 13 }}>
                    Keine Arbeiter zugewiesen
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned workers */}
          {(groupedByManager['unassigned'] || []).length > 0 && (
            <div style={{
              background: th.bgCard, borderRadius: 14, border: `1px solid ${th.border}`, overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14,
                background: isDark ? 'rgba(244,67,54,.06)' : 'rgba(244,67,54,.04)',
                borderBottom: `1px solid ${th.border}`,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: 'rgba(244,67,54,.15)', color: '#f44336',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 16,
                }}>?</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{L.unassigned}</div>
                  <div style={{ fontSize: 11, color: '#f44336', fontWeight: 600 }}>Arbeiter ohne Vorgesetzter</div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 13, color: th.textDim }}>
                  {groupedByManager['unassigned'].length} {L.workers}
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {groupedByManager['unassigned'].map((u, i) => renderUserRow(u, i))}
                </tbody>
              </table>
            </div>
          )}

          {/* Global managers (separate section) */}
          {filtered.filter(u => u.role === 'GLOBAL_MANAGER').length > 0 && (
            <div style={{
              background: th.bgCard, borderRadius: 14, border: `1px solid ${th.border}`, overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 20px', background: isDark ? 'rgba(200,169,110,.08)' : 'rgba(200,169,110,.06)',
                borderBottom: `1px solid ${th.border}`,
              }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: gold }}>Global Managers</div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {filtered.filter(u => u.role === 'GLOBAL_MANAGER').map((u, i) => renderUserRow(u, i))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ─── FLAT TABLE VIEW (filtered or local manager) ─── */
        <div style={{ background: th.bgCard, borderRadius: 14, border: `1px solid ${th.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: th.bgHeader, color: '#fff' }}>
                {tableHeaders.map((h, i) => (
                  <th key={i} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={tableHeaders.length} style={{ padding: 40, textAlign: 'center', color: th.textDim }}>{L.noUsers}</td></tr>
              )}
              {filtered.map((u, i) => renderUserRow(u, i))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── MODAL ─── */}
      {modalOpen && (
        <div style={modalOverlay} onClick={() => setModalOpen(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700, color: gold }}>
              {editId ? L.editUser : L.addUser}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>{L.firstName}</label>
                <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{L.lastName}</label>
                <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                  style={inputStyle} />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>{L.email}</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email"
                style={inputStyle} />
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>{L.phone}</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                style={inputStyle} />
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>
                {L.password} {editId && <span style={{ fontWeight: 400 }}>{L.passwordHint}</span>}
              </label>
              <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} type="password"
                placeholder={editId ? '••••••••' : ''} style={inputStyle} />
            </div>

            {/* Role — only global admin can change */}
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>{L.role}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(isGlobal ? ROLE_OPTIONS : (['ARBEITER'] as User['role'][])).map(r => (
                  <button key={r} onClick={() => isGlobal && setForm(f => ({ ...f, role: r }))}
                    style={{
                      flex: 1, padding: '10px 8px', borderRadius: 8,
                      cursor: isGlobal ? 'pointer' : 'default', fontWeight: 600, fontSize: 13,
                      border: form.role === r ? `2px solid ${gold}` : `1px solid ${th.border}`,
                      background: form.role === r ? (isDark ? 'rgba(200,169,110,.15)' : 'rgba(200,169,110,.1)') : 'transparent',
                      color: form.role === r ? gold : th.text, transition: 'all .15s',
                      opacity: !isGlobal && form.role !== r ? .3 : 1,
                    }}
                  >{roleLabel(r)}</button>
                ))}
              </div>
            </div>

            {/* Manager assignment — only global admin, only for ARBEITER */}
            {isGlobal && form.role === 'ARBEITER' && (
              <div style={{ marginTop: 16 }}>
                <label style={labelStyle}>{L.manager}</label>
                <select value={form.manager_id} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))}
                  style={inputStyle}>
                  <option value="">{L.noManager}</option>
                  {localManagers.map(m => (
                    <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({(m.departments || []).join(', ')})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Departments */}
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>{L.departments}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {DEPT_OPTIONS.map(d => (
                  <button key={d} onClick={() => toggleDept(d)}
                    style={{
                      flex: 1, padding: '10px 8px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                      border: form.departments.includes(d) ? `2px solid ${d === 'garten' ? '#4caf50' : '#ff9800'}` : `1px solid ${th.border}`,
                      background: form.departments.includes(d) ? (d === 'garten' ? 'rgba(76,175,80,.12)' : 'rgba(255,152,0,.12)') : 'transparent',
                      color: form.departments.includes(d) ? (d === 'garten' ? '#4caf50' : '#ff9800') : th.text,
                      transition: 'all .15s',
                    }}
                  >{d.charAt(0).toUpperCase() + d.slice(1)}</button>
                ))}
              </div>
            </div>

            {/* Active toggle */}
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={labelStyle}>{L.status}</label>
              <button onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: form.active ? '#4caf50' : '#666', position: 'relative', transition: 'background .2s',
                }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3,
                  left: form.active ? 24 : 4, transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.3)',
                }} />
              </button>
              <span style={{ fontSize: 13, color: form.active ? '#4caf50' : '#f44336', fontWeight: 600 }}>
                {form.active ? L.active : L.inactive}
              </span>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 28 }}>
              <button onClick={() => setModalOpen(false)}
                style={{ padding: '10px 24px', borderRadius: 8, border: `1px solid ${th.border}`, background: 'transparent', color: th.text, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                {L.cancel}</button>
              <button onClick={saveUser} disabled={saving}
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
    </div>
  );
}
