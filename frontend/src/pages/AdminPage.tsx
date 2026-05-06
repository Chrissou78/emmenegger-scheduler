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
}

const emptyForm: UserForm = {
  email: '', first_name: '', last_name: '',
  role: 'ARBEITER', departments: [], phone: '', password: '', active: true,
};

const DEPT_OPTIONS = ['garten', 'unterhalt'];
const ROLE_OPTIONS: User['role'][] = ['GLOBAL_MANAGER', 'LOCAL_MANAGER', 'ARBEITER'];

const roleLabel = (r: string) =>
  r === 'GLOBAL_MANAGER' ? 'Global Manager' : r === 'LOCAL_MANAGER' ? 'Lokal Manager' : 'Arbeiter';

export function AdminPage() {
  const { isDark, th, t } = useTheme();
  const { token } = useAuthStore();
  const API = import.meta.env.VITE_API_URL || '';

  /* ─── local labels (supplement theme translations) ─── */
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
  };

  /* state */
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');
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
      setUsers(data || []);
    } catch { showToast(L.error); }
  }, [API, headers]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  /* filter */
  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.first_name.toLowerCase().includes(q) || u.last_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchDept = !filterDept || (u.departments && u.departments.includes(filterDept));
    const matchRole = !filterRole || u.role === filterRole;
    return matchSearch && matchDept && matchRole;
  });

  /* open modal */
  const openNew = () => { setEditId(null); setForm({ ...emptyForm }); setModalOpen(true); };
  const openEdit = (u: User) => {
    setEditId(u.id);
    setForm({
      email: u.email, first_name: u.first_name, last_name: u.last_name,
      role: u.role, departments: u.departments || [], phone: u.phone || '',
      password: '', active: u.active !== false,
    });
    setModalOpen(true);
  };

  /* save */
  const saveUser = async () => {
    setSaving(true);
    try {
      const body: any = { ...form };
      if (editId && !body.password) delete body.password;
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

  /* toggle department in form */
  const toggleDept = (d: string) => {
    setForm(f => ({
      ...f,
      departments: f.departments.includes(d)
        ? f.departments.filter(x => x !== d)
        : [...f.departments, d],
    }));
  };

  /* stats */
  const totalActive = users.filter(u => u.active !== false).length;
  const totalManagers = users.filter(u => u.role !== 'ARBEITER').length;
  const totalWorkers = users.filter(u => u.role === 'ARBEITER').length;

  /* ─── derived colours from theme ─── */
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
    background: th.bgCard, borderRadius: 16, padding: 32, width: 520,
    maxHeight: '85vh', overflowY: 'auto', border: `1px solid ${th.border}`,
    boxShadow: '0 20px 60px rgba(0,0,0,.4)',
  };

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
        <button
          onClick={openNew}
          style={{
            background: `linear-gradient(135deg, ${gold}, #b8956a)`, color: '#fff',
            border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700,
            cursor: 'pointer', fontSize: 15, boxShadow: '0 4px 15px rgba(200,169,110,.4)',
          }}
        >+ {L.addUser}</button>
      </div>

      {/* filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder={L.search} value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200, padding: '10px 16px', borderRadius: 10,
            border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14, outline: 'none',
          }}
        />
        <select
          value={filterDept} onChange={e => setFilterDept(e.target.value)}
          style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14 }}
        >
          <option value="">{L.allDepts}</option>
          {DEPT_OPTIONS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
        </select>
        <select
          value={filterRole} onChange={e => setFilterRole(e.target.value)}
          style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14 }}
        >
          <option value="">{L.allRoles}</option>
          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
      </div>

      {/* table */}
      <div style={{ background: th.bgCard, borderRadius: 14, border: `1px solid ${th.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: th.bgHeader, color: '#fff' }}>
              {['', L.firstName, L.lastName, L.email, L.role, L.departments, L.status, L.actions].map((h, i) => (
                <th key={i} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: th.textDim }}>{L.noUsers}</td></tr>
            )}
            {filtered.map((u, i) => (
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
                <td style={{ padding: '10px 16px', fontWeight: 600 }}>{u.first_name}</td>
                <td style={{ padding: '10px 16px' }}>{u.last_name}</td>
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
                <td style={{ padding: '10px 16px' }}>
                  <span style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                    background: u.active !== false ? '#4caf50' : '#f44336', marginRight: 6,
                  }} />
                  <span style={{ fontSize: 12 }}>{u.active !== false ? L.active : L.inactive}</span>
                </td>
                <td style={{ padding: '10px 16px' }} onClick={e => e.stopPropagation()}>
                  {confirmDel === u.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => deleteUser(u.id)}
                        style={{ background: dangerBg, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >✓ {L.delete}</button>
                      <button
                        onClick={() => setConfirmDel(null)}
                        style={{ background: 'transparent', color: th.textDim, border: `1px solid ${th.border}`, borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}
                      >{L.cancel}</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDel(u.id)}
                      style={{ background: 'transparent', color: '#f44336', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4 }}
                      title={L.delete}
                    >🗑</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* modal */}
      {modalOpen && (
        <div style={modalOverlay} onClick={() => setModalOpen(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700, color: gold }}>
              {editId ? L.editUser : L.addUser}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: th.textDim, marginBottom: 4, display: 'block' }}>{L.firstName}</label>
                <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: th.textDim, marginBottom: 4, display: 'block' }}>{L.lastName}</label>
                <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: th.textDim, marginBottom: 4, display: 'block' }}>{L.email}</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: th.textDim, marginBottom: 4, display: 'block' }}>{L.phone}</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: th.textDim, marginBottom: 4, display: 'block' }}>
                {L.password} {editId && <span style={{ fontWeight: 400 }}>{L.passwordHint}</span>}
              </label>
              <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} type="password"
                placeholder={editId ? '••••••••' : ''}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${th.border}`, background: inputBg, color: th.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: th.textDim, marginBottom: 8, display: 'block' }}>{L.role}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {ROLE_OPTIONS.map(r => (
                  <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                    style={{
                      flex: 1, padding: '10px 8px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                      border: form.role === r ? `2px solid ${gold}` : `1px solid ${th.border}`,
                      background: form.role === r ? (isDark ? 'rgba(200,169,110,.15)' : 'rgba(200,169,110,.1)') : 'transparent',
                      color: form.role === r ? gold : th.text, transition: 'all .15s',
                    }}
                  >{roleLabel(r)}</button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: th.textDim, marginBottom: 8, display: 'block' }}>{L.departments}</label>
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

            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: th.textDim }}>{L.status}</label>
              <button
                onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: form.active ? '#4caf50' : '#666', position: 'relative', transition: 'background .2s',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3,
                  left: form.active ? 24 : 4, transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.3)',
                }} />
              </button>
              <span style={{ fontSize: 13, color: form.active ? '#4caf50' : '#f44336', fontWeight: 600 }}>
                {form.active ? L.active : L.inactive}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 28 }}>
              <button
                onClick={() => setModalOpen(false)}
                style={{ padding: '10px 24px', borderRadius: 8, border: `1px solid ${th.border}`, background: 'transparent', color: th.text, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
              >{L.cancel}</button>
              <button
                onClick={saveUser} disabled={saving}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none',
                  background: `linear-gradient(135deg, ${gold}, #b8956a)`, color: '#fff',
                  cursor: saving ? 'wait' : 'pointer', fontWeight: 700, fontSize: 14,
                  opacity: saving ? .7 : 1, boxShadow: '0 4px 15px rgba(200,169,110,.4)',
                }}
              >{saving ? '...' : L.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
