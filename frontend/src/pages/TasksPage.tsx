import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../contexts/themeContext';
import { useAuthStore } from '../contexts/authStore';
import { useRolesStore } from '../store/rolesStore';
import { resolvePermissions, type Role, type Permission } from '../../../shared/constants/roles';
import { CsvToolbar } from '../components/CsvToolbar';

const API = import.meta.env.VITE_API_URL || '';

interface Customer {
  id: string;
  name: string;
}

interface Task {
  id: string;
  code: string;
  name: string;
  description?: string;
  color: string;
  schedule_type: string;
  status?: string;
  estimated_hours?: number;
  customer?: Customer | null;
}

interface TaskForm {
  code: string;
  name: string;
  description: string;
  scheduleType: string;
  customerId: string;
  estimatedHours: string;
  color: string;
  status: string;
}

const EMPTY_FORM: TaskForm = {
  code: '', name: '', description: '', scheduleType: 'GARTEN_TIEFBAU',
  customerId: '', estimatedHours: '', color: '#8B7355', status: 'ACTIVE',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#4ecdc4', COMPLETED: '#95a5a6', CANCELLED: '#e74c3c', PAUSED: '#f39c12',
};

const STATUS_LABELS: Record<string, Record<string, string>> = {
  de: { ACTIVE: 'Aktiv', COMPLETED: 'Abgeschlossen', CANCELLED: 'Storniert', PAUSED: 'Pausiert' },
  en: { ACTIVE: 'Active', COMPLETED: 'Completed', CANCELLED: 'Cancelled', PAUSED: 'Paused' },
  fr: { ACTIVE: 'Actif', COMPLETED: 'Terminé', CANCELLED: 'Annulé', PAUSED: 'En pause' },
  pt: { ACTIVE: 'Ativo', COMPLETED: 'Concluído', CANCELLED: 'Cancelado', PAUSED: 'Pausado' },
};

const TYPE_LABELS: Record<string, Record<string, string>> = {
  de: { GARTEN_TIEFBAU: 'Garten & Tiefbau', UNTERHALT: 'Unterhalt' },
  en: { GARTEN_TIEFBAU: 'Garden & Civil', UNTERHALT: 'Maintenance' },
  fr: { GARTEN_TIEFBAU: 'Jardin & Génie civil', UNTERHALT: 'Entretien' },
  pt: { GARTEN_TIEFBAU: 'Jardim & Obras', UNTERHALT: 'Manutenção' },
};

const PAGE_LABELS: Record<string, Record<string, string>> = {
  de: {
    title: 'Aufträge', search: 'Suchen...', all: 'Alle', addTask: 'Neuer Auftrag',
    code: 'Code', name: 'Name', customer: 'Kunde', type: 'Typ', hours: 'Stunden',
    status: 'Status', actions: 'Aktionen', edit: 'Bearbeiten', delete: 'Löschen',
    save: 'Speichern', cancel: 'Abbrechen', description: 'Beschreibung',
    estimatedHours: 'Geschätzte Stunden', color: 'Farbe', noTasks: 'Keine Aufträge gefunden',
    totalHours: 'Total Stunden', taskCount: 'Aufträge', editTask: 'Auftrag bearbeiten',
    confirmDelete: 'Auftrag wirklich stornieren?', noCustomer: 'Kein Kunde',
    h: 'h', d: 'Tage', imported: 'Aufträge importiert',
    accessDenied: 'Kein Zugriff',
  },
  en: {
    title: 'Tasks', search: 'Search...', all: 'All', addTask: 'New Task',
    code: 'Code', name: 'Name', customer: 'Customer', type: 'Type', hours: 'Hours',
    status: 'Status', actions: 'Actions', edit: 'Edit', delete: 'Delete',
    save: 'Save', cancel: 'Cancel', description: 'Description',
    estimatedHours: 'Estimated Hours', color: 'Color', noTasks: 'No tasks found',
    totalHours: 'Total Hours', taskCount: 'Tasks', editTask: 'Edit Task',
    confirmDelete: 'Really cancel this task?', noCustomer: 'No customer',
    h: 'h', d: 'days', imported: 'tasks imported',
    accessDenied: 'Access Denied',
  },
  fr: {
    title: 'Tâches', search: 'Rechercher...', all: 'Toutes', addTask: 'Nouvelle tâche',
    code: 'Code', name: 'Nom', customer: 'Client', type: 'Type', hours: 'Heures',
    status: 'Statut', actions: 'Actions', edit: 'Modifier', delete: 'Supprimer',
    save: 'Enregistrer', cancel: 'Annuler', description: 'Description',
    estimatedHours: 'Heures estimées', color: 'Couleur', noTasks: 'Aucune tâche trouvée',
    totalHours: 'Total heures', taskCount: 'Tâches', editTask: 'Modifier tâche',
    confirmDelete: 'Vraiment annuler cette tâche?', noCustomer: 'Aucun client',
    h: 'h', d: 'jours', imported: 'tâches importées',
    accessDenied: 'Accès refusé',
  },
  pt: {
    title: 'Tarefas', search: 'Pesquisar...', all: 'Todas', addTask: 'Nova Tarefa',
    code: 'Código', name: 'Nome', customer: 'Cliente', type: 'Tipo', hours: 'Horas',
    status: 'Status', actions: 'Ações', edit: 'Editar', delete: 'Excluir',
    save: 'Salvar', cancel: 'Cancelar', description: 'Descrição',
    estimatedHours: 'Horas estimadas', color: 'Cor', noTasks: 'Nenhuma tarefa encontrada',
    totalHours: 'Total horas', taskCount: 'Tarefas', editTask: 'Editar Tarefa',
    confirmDelete: 'Realmente cancelar esta tarefa?', noCustomer: 'Sem cliente',
    h: 'h', d: 'dias', imported: 'tarefas importadas',
    accessDenied: 'Acesso negado',
  },
};

const csvColumns = (lbl: Record<string, string>) => [
  { key: 'code', label: lbl.code },
  { key: 'name', label: lbl.name },
  { key: 'description', label: lbl.description },
  { key: 'schedule_type', label: lbl.type },
  { key: 'customer_name', label: lbl.customer },
  { key: 'estimated_hours', label: lbl.estimatedHours },
  { key: 'status', label: lbl.status },
  { key: 'color', label: lbl.color },
];

const CSV_EXAMPLE_ROWS = [
  { code: 'a', name: 'Gartenarbeit Müller', description: 'Rasenpflege und Hecken schneiden', schedule_type: 'GARTEN_TIEFBAU', customer_name: '', estimated_hours: '40', status: 'ACTIVE', color: '#8B7355' },
  { code: 'b', name: 'Unterhalt Lindenpark', description: 'Wöchentliche Grünpflege', schedule_type: 'UNTERHALT', customer_name: '', estimated_hours: '16', status: 'ACTIVE', color: '#4A6741' },
];

function formatHours(h: number | undefined | null, lbl: Record<string, string>): string {
  if (!h) return '–';
  if (h >= 9) {
    const days = h / 9;
    const rounded = Math.round(days * 10) / 10;
    return `${h}${lbl.h} (${rounded} ${lbl.d})`;
  }
  return `${h}${lbl.h}`;
}

export function TasksPage() {
  const { th, isDark, lang } = useTheme();
  const { token, user } = useAuthStore();
  const { permissionMap } = useRolesStore();
  const lbl = PAGE_LABELS[lang] || PAGE_LABELS.de;
  const statusLbl = STATUS_LABELS[lang] || STATUS_LABELS.de;
  const typeLbl = TYPE_LABELS[lang] || TYPE_LABELS.de;

  /* ── Permission handling ── */
  const perms = useMemo(() => {
    const role: Role = (user?.role as Role) || 'EMPLOYEE';
    return resolvePermissions(role, user?.custom_permissions, permissionMap);
  }, [user, permissionMap]);

  const canView = perms.has('tasks.view' as Permission);
  const canEdit = perms.has('tasks.edit' as Permission);
  const canDelete = perms.has('tasks.delete' as Permission);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [sortCol, setSortCol] = useState<'name' | 'code' | 'hours' | 'customer'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  useEffect(() => { fetchTasks(); fetchCustomers(); }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  async function fetchTasks() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/v1/tasks`, { headers: authHeaders });
      const d = await r.json();
      setTasks(d.data || d || []);
    } catch { setToast({ msg: 'Failed to load tasks', err: true }); }
    setLoading(false);
  }

  async function fetchCustomers() {
    try {
      const r = await fetch(`${API}/api/v1/customers`, { headers: authHeaders });
      const d = await r.json();
      setCustomers(d.data || d || []);
    } catch { /* silent */ }
  }

  function openAdd() {
    if (!canEdit) return;
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(task: Task) {
    if (!canEdit) return;
    setEditingTask(task);
    setForm({
      code: task.code || '',
      name: task.name || '',
      description: task.description || '',
      scheduleType: task.schedule_type || 'GARTEN_TIEFBAU',
      customerId: task.customer?.id || '',
      estimatedHours: task.estimated_hours?.toString() || '',
      color: task.color || '#8B7355',
      status: task.status || 'ACTIVE',
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!canEdit) return;
    const body = {
      code: form.code,
      name: form.name,
      description: form.description || undefined,
      scheduleType: form.scheduleType,
      customerId: form.customerId || undefined,
      estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : undefined,
      color: form.color,
      status: form.status,
    };
    try {
      if (editingTask) {
        await fetch(`${API}/api/v1/tasks/${editingTask.id}`, { method: 'PUT', headers: authHeaders, body: JSON.stringify(body) });
      } else {
        await fetch(`${API}/api/v1/tasks`, { method: 'POST', headers: authHeaders, body: JSON.stringify(body) });
      }
      setModalOpen(false);
      fetchTasks();
      setToast({ msg: editingTask ? 'Task updated' : 'Task created' });
    } catch { setToast({ msg: 'Save failed', err: true }); }
  }

  async function handleDelete(task: Task) {
    if (!canDelete) return;
    if (!confirm(lbl.confirmDelete)) return;
    try {
      await fetch(`${API}/api/v1/tasks/${task.id}`, { method: 'DELETE', headers: authHeaders });
      fetchTasks();
      setToast({ msg: 'Task cancelled' });
    } catch { setToast({ msg: 'Delete failed', err: true }); }
  }

  async function handleCsvImport(rows: Record<string, any>[]) {
    if (!canEdit) return;
    let ok = 0;
    let fail = 0;
    for (const row of rows) {
      try {
        const res = await fetch(`${API}/api/v1/tasks`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({
            code: row.code, name: row.name,
            description: row.description || undefined,
            scheduleType: row.schedule_type || 'GARTEN_TIEFBAU',
            estimatedHours: row.estimated_hours ? parseFloat(row.estimated_hours) : undefined,
            color: row.color || '#8B7355', status: row.status || 'ACTIVE',
          }),
        });
        if (res.ok) ok++; else fail++;
      } catch { fail++; }
    }
    await fetchTasks();
    setToast({ msg: `${ok} ${lbl.imported}${fail > 0 ? ` (${fail} failed)` : ''}`, err: fail > 0 });
  }

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  }

  const filtered = useMemo(() => {
    let list = [...tasks];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(t =>
        (t.name || '').toLowerCase().includes(s) ||
        (t.code || '').toLowerCase().includes(s) ||
        (t.customer?.name || '').toLowerCase().includes(s) ||
        (t.description || '').toLowerCase().includes(s)
      );
    }
    if (filterType !== 'ALL') list = list.filter(t => t.schedule_type === filterType);
    if (filterStatus !== 'ALL') list = list.filter(t => (t.status || 'ACTIVE') === filterStatus);
    list.sort((a, b) => {
      let va: string | number = '', vb: string | number = '';
      switch (sortCol) {
        case 'name': va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase(); break;
        case 'code': va = (a.code || '').toLowerCase(); vb = (b.code || '').toLowerCase(); break;
        case 'hours': va = a.estimated_hours || 0; vb = b.estimated_hours || 0; break;
        case 'customer': va = (a.customer?.name || '').toLowerCase(); vb = (b.customer?.name || '').toLowerCase(); break;
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [tasks, search, filterType, filterStatus, sortCol, sortAsc]);

  const totalHours = useMemo(() => filtered.reduce((sum, t) => sum + (t.estimated_hours || 0), 0), [filtered]);

  const csvData = useMemo(() =>
    filtered.map(t => ({
      code: t.code, name: t.name, description: t.description || '',
      schedule_type: t.schedule_type, customer_name: t.customer?.name || '',
      estimated_hours: t.estimated_hours ?? '', status: t.status || 'ACTIVE', color: t.color,
    })),
    [filtered]
  );

  const gold = th.gold;
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 6, border: `1px solid ${th.border}`,
    background: th.bg, color: th.text, fontSize: 13, fontFamily: "'Inter','Segoe UI',sans-serif", outline: 'none',
  };
  const btnStyle = (bg: string, color: string): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 6, border: 'none', background: bg, color,
    fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: 0.5,
    fontFamily: "'Inter','Segoe UI',sans-serif", transition: 'opacity .15s',
  });
  const sortArrow = (col: typeof sortCol) => sortCol === col ? (sortAsc ? ' ▲' : ' ▼') : '';

  /* ── Access guard ── */
  if (!canView) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: th.text }}>
        <h2>{lbl.accessDenied}</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto', fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 300, color: gold, letterSpacing: 2 }}>{lbl.title}</h1>
          <div style={{ fontSize: 12, color: th.textDim, marginTop: 4 }}>
            {filtered.length} {lbl.taskCount} · {totalHours.toLocaleString()} {lbl.totalHours}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CsvToolbar
            columns={csvColumns(lbl)}
            data={csvData as Record<string, any>[]}
            filename={`tasks_${new Date().toISOString().split('T')[0]}`}
            formatters={{
              estimated_hours: (v: any) => v != null && v !== '' ? String(v) : '',
              schedule_type: (v: any) => v || 'GARTEN_TIEFBAU',
            }}
            exampleRows={CSV_EXAMPLE_ROWS}
            validators={{
              code: (v: string) => v ? null : 'Code is required',
              name: (v: string) => v ? null : 'Name is required',
            }}
            canImport={canEdit}
            onImport={handleCsvImport}
          />
          {canEdit && (
            <button onClick={openAdd} style={btnStyle(gold, '#fff')}>
              + {lbl.addTask}
            </button>
          )}
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED'] as const).map(s => {
          const count = tasks.filter(t => (t.status || 'ACTIVE') === s).length;
          return (
            <div key={s} style={{ padding: '10px 18px', borderRadius: 8, background: th.bgCard, border: `1px solid ${th.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[s] }} />
              <span style={{ fontSize: 13, color: th.text, fontWeight: 600 }}>{count}</span>
              <span style={{ fontSize: 12, color: th.textDim }}>{statusLbl[s]}</span>
            </div>
          );
        })}
      </div>

      {/* FILTERS */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder={lbl.search} value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: 260, flexShrink: 0 }} />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...inputStyle, width: 180 }}>
          <option value="ALL">{lbl.type}: {lbl.all}</option>
          <option value="GARTEN_TIEFBAU">{typeLbl.GARTEN_TIEFBAU}</option>
          <option value="UNTERHALT">{typeLbl.UNTERHALT}</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: 160 }}>
          <option value="ALL">{lbl.status}: {lbl.all}</option>
          {Object.keys(STATUS_COLORS).map(s => (<option key={s} value={s}>{statusLbl[s]}</option>))}
        </select>
      </div>

      {/* TABLE */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: th.textDim, fontSize: 14 }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: th.textDim, fontSize: 14 }}>{lbl.noTasks}</div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${th.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: th.bgCard }}>
                <th style={thStyle(th)} />
                <th style={{ ...thStyle(th), cursor: 'pointer' }} onClick={() => toggleSort('code')}>{lbl.code}{sortArrow('code')}</th>
                <th style={{ ...thStyle(th), cursor: 'pointer', textAlign: 'left' }} onClick={() => toggleSort('name')}>{lbl.name}{sortArrow('name')}</th>
                <th style={{ ...thStyle(th), cursor: 'pointer', textAlign: 'left' }} onClick={() => toggleSort('customer')}>{lbl.customer}{sortArrow('customer')}</th>
                <th style={thStyle(th)}>{lbl.type}</th>
                <th style={{ ...thStyle(th), cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('hours')}>{lbl.hours}{sortArrow('hours')}</th>
                <th style={thStyle(th)}>{lbl.status}</th>
                {canEdit && <th style={thStyle(th)}>{lbl.actions}</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => (
                <tr key={task.id}
                  style={{ borderBottom: `1px solid ${th.borderFaint}`, transition: 'background .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = th.rowHover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={tdStyle(th)}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, background: task.color || '#8B7355', margin: '0 auto' }} />
                  </td>
                  <td style={{ ...tdStyle(th), fontWeight: 700, fontFamily: 'monospace', color: gold }}>{task.code}</td>
                  <td style={{ ...tdStyle(th), textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, color: th.text }}>{task.name}</div>
                    {task.description && (
                      <div style={{ fontSize: 11, color: th.textDim, marginTop: 2 }}>
                        {task.description.length > 80 ? task.description.slice(0, 80) + '…' : task.description}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle(th), textAlign: 'left', color: th.textMuted }}>
                    {task.customer?.name || <span style={{ color: th.textGhost, fontStyle: 'italic' }}>{lbl.noCustomer}</span>}
                  </td>
                  <td style={{ ...tdStyle(th), textAlign: 'center' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                      background: task.schedule_type === 'UNTERHALT'
                        ? (isDark ? 'rgba(78,205,196,.12)' : 'rgba(78,205,196,.15)')
                        : (isDark ? 'rgba(200,169,110,.12)' : 'rgba(200,169,110,.15)'),
                      color: task.schedule_type === 'UNTERHALT' ? '#4ecdc4' : gold,
                    }}>
                      {typeLbl[task.schedule_type] || task.schedule_type}
                    </span>
                  </td>
                  <td style={{ ...tdStyle(th), textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                    {formatHours(task.estimated_hours, lbl)}
                  </td>
                  <td style={{ ...tdStyle(th), textAlign: 'center' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                      background: isDark
                        ? `${STATUS_COLORS[task.status || 'ACTIVE']}22`
                        : `${STATUS_COLORS[task.status || 'ACTIVE']}18`,
                      color: STATUS_COLORS[task.status || 'ACTIVE'],
                    }}>
                      {statusLbl[task.status || 'ACTIVE']}
                    </span>
                  </td>
                  {canEdit && (
                    <td style={{ ...tdStyle(th), textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button onClick={() => openEdit(task)}
                          style={{ ...btnStyle('transparent', gold), padding: '4px 10px', border: `1px solid ${th.border}` }}>
                          {lbl.edit}
                        </button>
                        {canDelete && (
                          <button onClick={() => handleDelete(task)}
                            style={{ ...btnStyle('transparent', '#e74c3c'), padding: '4px 10px', border: `1px solid ${th.border}` }}>
                            {lbl.delete}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL */}
      {modalOpen && canEdit && (
        <div style={{
          position: 'fixed', inset: 0, background: th.modalBg, display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }} onClick={() => setModalOpen(false)}>
          <div style={{
            background: th.modalCard, borderRadius: 12, padding: 28, width: 480,
            maxHeight: '85vh', overflowY: 'auto', border: `1px solid ${th.border}`,
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 300, color: gold, letterSpacing: 1 }}>
              {editingTask ? lbl.editTask : lbl.addTask}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle(th)}>{lbl.code}</label>
                  <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={labelStyle(th)}>{lbl.name}</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle(th)}>{lbl.description}</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle(th)}>{lbl.type}</label>
                  <select value={form.scheduleType} onChange={e => setForm({ ...form, scheduleType: e.target.value })} style={inputStyle}>
                    <option value="GARTEN_TIEFBAU">{typeLbl.GARTEN_TIEFBAU}</option>
                    <option value="UNTERHALT">{typeLbl.UNTERHALT}</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle(th)}>{lbl.status}</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                    {Object.keys(STATUS_COLORS).map(s => (<option key={s} value={s}>{statusLbl[s]}</option>))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 2 }}>
                  <label style={labelStyle(th)}>{lbl.customer}</label>
                  <select value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} style={inputStyle}>
                    <option value="">– {lbl.noCustomer} –</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle(th)}>{lbl.estimatedHours}</label>
                  <input type="number" step="0.5" min="0" value={form.estimatedHours} onChange={e => setForm({ ...form, estimatedHours: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle(th)}>{lbl.color}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ width: 40, height: 36, border: 'none', cursor: 'pointer', background: 'transparent' }} />
                    <input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ ...inputStyle, fontFamily: 'monospace' }} />
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button onClick={() => setModalOpen(false)} style={btnStyle(th.btnBg, th.text)}>{lbl.cancel}</button>
              <button onClick={handleSave} style={btnStyle(gold, '#fff')}>{lbl.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 8,
          background: toast.err ? th.toastErrBg : th.toastBg,
          color: toast.err ? th.toastErrText : th.toastText,
          border: `1px solid ${toast.err ? th.toastErrBorder : th.toastBorder}`,
          fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,.3)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* helper styles */
function thStyle(th: Record<string, string>): React.CSSProperties {
  return {
    padding: '10px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700,
    color: th.textDim, letterSpacing: 0.5, textTransform: 'uppercase',
    borderBottom: `2px solid ${th.border}`, whiteSpace: 'nowrap',
  };
}
function tdStyle(th: Record<string, string>): React.CSSProperties {
  return { padding: '10px 14px', textAlign: 'center', fontSize: 13, color: th.text, borderBottom: `1px solid ${th.borderFaint}` };
}
function labelStyle(th: Record<string, string>): React.CSSProperties {
  return { display: 'block', fontSize: 11, fontWeight: 700, color: th.textDim, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 };
}
