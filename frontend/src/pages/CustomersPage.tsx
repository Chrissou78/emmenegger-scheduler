// src/pages/CustomersPage.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from '../contexts/themeContext';
import { useAuthStore } from '../contexts/authStore';
import { CsvToolbar } from '../components/CsvToolbar';
import { resolvePermissions, type Role, type Permission } from '../../../shared/constants/roles';

const API = import.meta.env.VITE_API_URL || '';

/* ────────────────── interfaces ────────────────── */
interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  role?: string;
  is_primary?: boolean;
}

interface Customer {
  id: string;
  name: string;
  customer_type: string;
  company_name?: string;
  street?: string;
  postal_code?: string;
  city?: string;
  canton?: string;
  phone?: string;
  email?: string;
  website?: string;
  status: string;
  language?: string;
  payment_terms?: number;
  notes?: string;
  contacts?: Contact[];
  tasks_count?: number;
  active_tasks_count?: number;
  total_hours?: number;
  created_at?: string;
}

/* ────────────────── translations ────────────────── */
const T: Record<string, Record<string, string>> = {
  de: {
    title: 'Kunden', search: 'Suchen…', allTypes: 'Alle Typen', allStatuses: 'Alle Status',
    add: '+ Neuer Kunde', name: 'Name', type: 'Typ', company: 'Firma', street: 'Strasse',
    postalCode: 'PLZ', city: 'Ort', canton: 'Kanton', phone: 'Telefon', email: 'E-Mail',
    website: 'Website', status: 'Status', language: 'Sprache', paymentTerms: 'Zahlungsfrist (Tage)',
    notes: 'Notizen', save: 'Speichern', cancel: 'Abbrechen', edit: 'Bearbeiten', delete: 'Löschen',
    confirmDelete: 'Wirklich löschen?', yes: 'Ja', no: 'Nein', general: 'Allgemein',
    contacts: 'Kontakte', billing: 'Abrechnung', notesTab: 'Notizen', tasks: 'Aufträge',
    activeTasks: 'Aktive Aufträge', totalHours: 'Total Stunden', memberSince: 'Kunde seit',
    noCustomers: 'Keine Kunden gefunden.', saved: 'Gespeichert', deleted: 'Gelöscht',
    error: 'Fehler', imported: 'importiert', addContact: '+ Kontakt', firstName: 'Vorname',
    lastName: 'Nachname', role: 'Funktion', primary: 'Hauptkontakt', prev: '← Zurück',
    next: 'Weiter →', page: 'Seite', of: 'von', total: 'Total', active: 'Aktiv',
    inactive: 'Inaktiv', PRIVATE: 'Privat', COMPANY: 'Firma', ACTIVE: 'Aktiv',
    INACTIVE: 'Inaktiv', BLOCKED: 'Gesperrt', close: 'Schliessen',
    loading: 'Laden…', back: '← Zurück zur Liste',
  },
  en: {
    title: 'Customers', search: 'Search…', allTypes: 'All Types', allStatuses: 'All Statuses',
    add: '+ New Customer', name: 'Name', type: 'Type', company: 'Company', street: 'Street',
    postalCode: 'Postal Code', city: 'City', canton: 'Canton', phone: 'Phone', email: 'Email',
    website: 'Website', status: 'Status', language: 'Language', paymentTerms: 'Payment Terms (days)',
    notes: 'Notes', save: 'Save', cancel: 'Cancel', edit: 'Edit', delete: 'Delete',
    confirmDelete: 'Really delete?', yes: 'Yes', no: 'No', general: 'General',
    contacts: 'Contacts', billing: 'Billing', notesTab: 'Notes', tasks: 'Tasks',
    activeTasks: 'Active Tasks', totalHours: 'Total Hours', memberSince: 'Customer since',
    noCustomers: 'No customers found.', saved: 'Saved', deleted: 'Deleted',
    error: 'Error', imported: 'imported', addContact: '+ Contact', firstName: 'First Name',
    lastName: 'Last Name', role: 'Role', primary: 'Primary Contact', prev: '← Previous',
    next: 'Next →', page: 'Page', of: 'of', total: 'Total', active: 'Active',
    inactive: 'Inactive', PRIVATE: 'Private', COMPANY: 'Company', ACTIVE: 'Active',
    INACTIVE: 'Inactive', BLOCKED: 'Blocked', close: 'Close',
    loading: 'Loading…', back: '← Back to list',
  },
  fr: {
    title: 'Clients', search: 'Rechercher…', allTypes: 'Tous les types', allStatuses: 'Tous les statuts',
    add: '+ Nouveau client', name: 'Nom', type: 'Type', company: 'Entreprise', street: 'Rue',
    postalCode: 'Code postal', city: 'Ville', canton: 'Canton', phone: 'Téléphone', email: 'E-mail',
    website: 'Site web', status: 'Statut', language: 'Langue', paymentTerms: 'Délai de paiement (jours)',
    notes: 'Notes', save: 'Enregistrer', cancel: 'Annuler', edit: 'Modifier', delete: 'Supprimer',
    confirmDelete: 'Vraiment supprimer ?', yes: 'Oui', no: 'Non', general: 'Général',
    contacts: 'Contacts', billing: 'Facturation', notesTab: 'Notes', tasks: 'Tâches',
    activeTasks: 'Tâches actives', totalHours: 'Heures totales', memberSince: 'Client depuis',
    noCustomers: 'Aucun client trouvé.', saved: 'Enregistré', deleted: 'Supprimé',
    error: 'Erreur', imported: 'importé(s)', addContact: '+ Contact', firstName: 'Prénom',
    lastName: 'Nom', role: 'Fonction', primary: 'Contact principal', prev: '← Précédent',
    next: 'Suivant →', page: 'Page', of: 'de', total: 'Total', active: 'Actif',
    inactive: 'Inactif', PRIVATE: 'Privé', COMPANY: 'Entreprise', ACTIVE: 'Actif',
    INACTIVE: 'Inactif', BLOCKED: 'Bloqué', close: 'Fermer',
    loading: 'Chargement…', back: '← Retour à la liste',
  },
  pt: {
    title: 'Clientes', search: 'Pesquisar…', allTypes: 'Todos os tipos', allStatuses: 'Todos os estados',
    add: '+ Novo cliente', name: 'Nome', type: 'Tipo', company: 'Empresa', street: 'Rua',
    postalCode: 'Código postal', city: 'Cidade', canton: 'Cantão', phone: 'Telefone', email: 'E-mail',
    website: 'Website', status: 'Estado', language: 'Idioma', paymentTerms: 'Prazo de pagamento (dias)',
    notes: 'Notas', save: 'Guardar', cancel: 'Cancelar', edit: 'Editar', delete: 'Eliminar',
    confirmDelete: 'Eliminar mesmo?', yes: 'Sim', no: 'Não', general: 'Geral',
    contacts: 'Contactos', billing: 'Faturação', notesTab: 'Notas', tasks: 'Tarefas',
    activeTasks: 'Tarefas ativas', totalHours: 'Total de horas', memberSince: 'Cliente desde',
    noCustomers: 'Nenhum cliente encontrado.', saved: 'Guardado', deleted: 'Eliminado',
    error: 'Erro', imported: 'importado(s)', addContact: '+ Contacto', firstName: 'Nome próprio',
    lastName: 'Apelido', role: 'Função', primary: 'Contacto principal', prev: '← Anterior',
    next: 'Seguinte →', page: 'Página', of: 'de', total: 'Total', active: 'Ativo',
    inactive: 'Inativo', PRIVATE: 'Privado', COMPANY: 'Empresa', ACTIVE: 'Ativo',
    INACTIVE: 'Inativo', BLOCKED: 'Bloqueado', close: 'Fechar',
    loading: 'A carregar…', back: '← Voltar à lista',
  },
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#4ecdc4', INACTIVE: '#95a5a6', BLOCKED: '#e74c3c',
};

const TYPE_ICONS: Record<string, string> = { PRIVATE: '👤', COMPANY: '🏢' };

/* ────────────────── CSV columns & example rows ────────────────── */
const csvColumns = (t: Record<string, string>) => [
  { key: 'name', label: t.name },
  { key: 'customer_type', label: t.type },
  { key: 'company_name', label: t.company },
  { key: 'street', label: t.street },
  { key: 'postal_code', label: t.postalCode },
  { key: 'city', label: t.city },
  { key: 'canton', label: t.canton },
  { key: 'phone', label: t.phone },
  { key: 'email', label: t.email },
  { key: 'website', label: t.website },
  { key: 'status', label: t.status },
  { key: 'language', label: t.language },
  { key: 'payment_terms', label: t.paymentTerms },
  { key: 'notes', label: t.notes },
];

const CSV_EXAMPLE_ROWS = [
  {
    name: 'Müller Hans', customer_type: 'PRIVATE', company_name: '',
    street: 'Bahnhofstrasse 12', postal_code: '8001', city: 'Zürich', canton: 'ZH',
    phone: '+41 44 123 45 67', email: 'hans.mueller@example.ch', website: '',
    status: 'ACTIVE', language: 'de', payment_terms: '30', notes: 'Stammkunde',
  },
  {
    name: 'GreenScape AG', customer_type: 'COMPANY', company_name: 'GreenScape AG',
    street: 'Industriestrasse 5', postal_code: '3000', city: 'Bern', canton: 'BE',
    phone: '+41 31 987 65 43', email: 'info@greenscape.ch', website: 'https://greenscape.ch',
    status: 'ACTIVE', language: 'de', payment_terms: '60', notes: 'Grossauftrag Grünpflege',
  },
];

/* ────────────────── helpers ────────────────── */
const DATE_LOCALES: Record<string, string> = {
  de: 'de-CH', en: 'en-GB', fr: 'fr-CH', pt: 'pt-BR',
};

function formatCurrency(val?: number): string {
  if (val == null) return '–';
  return val.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeCustomer(raw: any): Customer {
  return {
    id: raw.id,
    name: raw.name || raw.company_name || raw.display_name || '',
    customer_type: raw.customer_type || raw.type || 'PRIVATE',
    company_name: raw.company_name || '',
    street: raw.street || raw.address || '',
    postal_code: raw.postal_code || raw.zip || raw.plz || '',
    city: raw.city || raw.ort || '',
    canton: raw.canton || raw.kanton || '',
    phone: raw.phone || raw.telefon || '',
    email: raw.email || '',
    website: raw.website || '',
    status: raw.status || 'ACTIVE',
    language: raw.language || raw.sprache || 'de',
    payment_terms: raw.payment_terms ?? raw.paymentTerms ?? undefined,
    notes: raw.notes || raw.notizen || '',
    contacts: raw.contacts || [],
    tasks_count: raw.tasks_count ?? raw.tasksCount ?? 0,
    active_tasks_count: raw.active_tasks_count ?? raw.activeTasksCount ?? 0,
    total_hours: raw.total_hours ?? raw.totalHours ?? 0,
    created_at: raw.created_at || raw.createdAt || '',
  };
}

function customerToForm(c: Customer): Partial<Customer> {
  return {
    name: c.name || '',
    customer_type: c.customer_type || 'PRIVATE',
    company_name: c.company_name || '',
    street: c.street || '',
    postal_code: c.postal_code || '',
    city: c.city || '',
    canton: c.canton || '',
    phone: c.phone || '',
    email: c.email || '',
    website: c.website || '',
    status: c.status || 'ACTIVE',
    language: c.language || 'de',
    payment_terms: c.payment_terms ?? 30,
    notes: c.notes || '',
  };
}

/* ────────────────── component ────────────────── */
export function CustomersPage() {
  const { th, isDark, lang } = useTheme();
  const { token, user } = useAuthStore();
  const t = T[lang] || T.de;
  const locale = DATE_LOCALES[lang] || 'de-CH';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  /* ── permissions from roles system ── */
  const perms = useMemo(() => {
    const role = (user?.role || 'EMPLOYEE').toUpperCase() as Role;
    const custom = user?.custom_permissions as
      | { add?: Permission[]; remove?: Permission[] }
      | undefined;
    return resolvePermissions(role, custom);
  }, [user]);

  const canView = perms.has('customers.view');
  const canEdit = perms.has('customers.edit');
  const canDelete = perms.has('customers.delete');

  /* ── state ── */
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Customer | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Customer>>({});
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactForm, setContactForm] = useState<Partial<Contact>>({});
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [tab, setTab] = useState<'general' | 'contacts' | 'billing' | 'notes'>('general');
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
    setContactForm({});
    setEditingContact(null);
  }

  const panelOpen = selected !== null || editing;

  /* ── theme-aware style helpers ── */
  const dimText = isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.4)';
  const inputBg = isDark ? '#1a1a3e' : '#faf7f2';
  const panelBg = isDark ? '#1e1e3a' : '#fff';

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: `1px solid ${th.border}`, background: inputBg,
    color: th.text, fontSize: 14, outline: 'none',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle, appearance: 'auto' as const,
  };

  const btnPrimary: React.CSSProperties = {
    padding: '8px 18px', borderRadius: 8, border: 'none',
    background: th.gold, color: '#000',
    fontWeight: 600, cursor: 'pointer', fontSize: 14,
    transition: 'opacity .15s',
  };

  const btnDanger: React.CSSProperties = {
    ...btnPrimary, background: '#e74c3c', color: '#fff',
  };

  const btnSecondary: React.CSSProperties = {
    padding: '8px 18px', borderRadius: 8,
    border: `1px solid ${th.border}`,
    background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
    color: th.text, fontWeight: 600, cursor: 'pointer', fontSize: 14,
    transition: 'opacity .15s',
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
    background: disabled
      ? (isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)')
      : th.gold,
    color: disabled
      ? (isDark ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.25)')
      : '#000',
    fontWeight: 600, fontSize: 14,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all .15s',
  });

  const contactBtnSmall = (bg: string): React.CSSProperties => ({
    padding: '4px 10px', borderRadius: 6, border: 'none',
    background: bg, color: '#fff', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', transition: 'opacity .15s',
  });

  const statCard: React.CSSProperties = {
    padding: '10px 16px', borderRadius: 10,
    background: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)',
    textAlign: 'center' as const, minWidth: 100,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, color: dimText, fontWeight: 600,
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left' as const, padding: '10px 12px',
    borderBottom: `2px solid ${th.border}`,
    color: dimText, fontWeight: 600, fontSize: 12,
    textTransform: 'uppercase' as const, letterSpacing: '0.5px',
  };

  const tdStyle: React.CSSProperties = {
    padding: '10px 12px', borderBottom: `1px solid ${th.border}`, color: dimText,
  };

  /* ── data fetching ── */
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (search) params.set('search', search);
      if (filterType) params.set('customer_type', filterType);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`${API}/api/v1/customers?${params}`, { headers });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const raw = json.data ?? json;
      const list = (Array.isArray(raw) ? raw : []).map(normalizeCustomer);
      setCustomers(list);
      setTotal(json.total ?? list.length);
    } catch {
      showToast(t.error, 'err');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, filterType, filterStatus, token]);

  const fetchAllCustomers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/customers?pageSize=9999`, { headers });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const raw = json.data ?? json;
      setAllCustomers((Array.isArray(raw) ? raw : []).map(normalizeCustomer));
    } catch { /* silent */ }
  }, [token]);

  const fetchDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API}/api/v1/customers/${id}`, { headers });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const raw = json.data ?? json;
      const cust = normalizeCustomer(raw);
      setSelected(cust);
      setContacts(cust.contacts ?? []);
      setForm(customerToForm(cust));
      setEditing(false);
      setTab('general');
      setConfirmDelete(false);
      setContactForm({});
      setEditingContact(null);
      setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch {
      showToast(t.error, 'err');
    }
  }, [token]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { fetchAllCustomers(); }, [fetchAllCustomers]);

  /* ── CRUD customers ── */
  async function saveCustomer() {
    try {
      const method = selected ? 'PUT' : 'POST';
      const url = selected
        ? `${API}/api/v1/customers/${selected.id}`
        : `${API}/api/v1/customers`;
      const res = await fetch(url, { method, headers, body: JSON.stringify(form) });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const saved = normalizeCustomer(json.data ?? json);
      showToast(t.saved);
      if (selected) {
        setSelected(saved);
        setForm(customerToForm(saved));
        setCustomers((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
        setEditing(false);
      } else {
        closeDetail();
      }
      fetchCustomers();
      fetchAllCustomers();
    } catch {
      showToast(t.error, 'err');
    }
  }

  async function deleteCustomer() {
    if (!selected) return;
    try {
      const res = await fetch(`${API}/api/v1/customers/${selected.id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error();
      showToast(t.deleted);
      closeDetail();
      fetchCustomers();
      fetchAllCustomers();
    } catch {
      showToast(t.error, 'err');
    }
  }

  /* ── CRUD contacts ── */
  async function saveContact() {
    if (!selected) return;
    try {
      const method = editingContact ? 'PUT' : 'POST';
      const url = editingContact
        ? `${API}/api/v1/contacts/${editingContact}`
        : `${API}/api/v1/contacts`;
      const body = { ...contactForm, customer_id: selected.id };
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      showToast(t.saved);
      setContactForm({});
      setEditingContact(null);
      fetchDetail(selected.id);
    } catch {
      showToast(t.error, 'err');
    }
  }

  async function deleteContact(id: string) {
    try {
      const res = await fetch(`${API}/api/v1/contacts/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error();
      showToast(t.deleted);
      if (selected) fetchDetail(selected.id);
    } catch {
      showToast(t.error, 'err');
    }
  }

  /* ── CSV import handler ── */
  async function handleCsvImport(rows: Record<string, string>[]) {
    let ok = 0, fail = 0;
    for (const row of rows) {
      try {
        const res = await fetch(`${API}/api/v1/customers`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: row.name,
            customer_type: row.customer_type || 'PRIVATE',
            company_name: row.company_name || undefined,
            street: row.street || undefined,
            postal_code: row.postal_code || undefined,
            city: row.city || undefined,
            canton: row.canton || undefined,
            phone: row.phone || undefined,
            email: row.email || undefined,
            website: row.website || undefined,
            status: row.status || 'ACTIVE',
            language: row.language || 'de',
            payment_terms: row.payment_terms ? parseInt(row.payment_terms, 10) : undefined,
            notes: row.notes || undefined,
          }),
        });
        res.ok ? ok++ : fail++;
      } catch {
        fail++;
      }
    }
    await fetchCustomers();
    await fetchAllCustomers();
    showToast(
      `${ok} ${t.imported}${fail > 0 ? ` (${fail} failed)` : ''}`,
      fail > 0 ? 'err' : 'ok',
    );
  }

  /* ── derived data ── */
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const activeCount = useMemo(
    () => allCustomers.filter((c) => c.status === 'ACTIVE').length,
    [allCustomers],
  );

  const csvData = useMemo(
    () =>
      allCustomers.map((c) => ({
        name: c.name,
        customer_type: c.customer_type,
        company_name: c.company_name || '',
        street: c.street || '',
        postal_code: c.postal_code || '',
        city: c.city || '',
        canton: c.canton || '',
        phone: c.phone || '',
        email: c.email || '',
        website: c.website || '',
        status: c.status,
        language: c.language || '',
        payment_terms: c.payment_terms != null ? String(c.payment_terms) : '',
        notes: c.notes || '',
      })),
    [allCustomers],
  );

  /* ── if user has no view permission, render nothing ── */
  if (!canView) return null;

  /* ────────────────── render ────────────────── */
  return (
    <div style={{ padding: '24px 16px', maxWidth: 1400, margin: '0 auto', color: th.text }}>

      {/* ── Toast ── */}
      {toast && (
        <div
          style={{
            position: 'fixed', top: 20, right: 20, zIndex: 9999,
            padding: '12px 24px', borderRadius: 10,
            background: toast.type === 'err' ? '#e74c3c' : '#4ecdc4',
            color: '#fff', fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,.25)',
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12, marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 26, color: th.text }}>{t.title}</h1>
          <p style={{ margin: '4px 0 0', color: dimText, fontSize: 14 }}>
            {t.total}: {total} · {t.active}: {activeCount}
          </p>
        </div>

        {!panelOpen && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <CsvToolbar
              columns={csvColumns(t)}
              data={csvData}
              filename={`customers_${new Date().toISOString().split('T')[0]}`}
              exampleRows={CSV_EXAMPLE_ROWS}
              validators={{
                name: (v: string) => (v ? null : 'Name is required'),
              }}
              canImport={canEdit}
              onImport={handleCsvImport}
            />
            {canEdit && (
              <button
                onClick={() => {
                  setSelected(null);
                  setForm(customerToForm({
                    id: '', name: '', customer_type: 'PRIVATE', status: 'ACTIVE',
                    language: 'de', payment_terms: 30, created_at: '',
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
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
              style={{ ...selectStyle, maxWidth: 160 }}
            >
              <option value="">{t.allTypes}</option>
              <option value="PRIVATE">{t.PRIVATE}</option>
              <option value="COMPANY">{t.COMPANY}</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              style={{ ...selectStyle, maxWidth: 160 }}
            >
              <option value="">{t.allStatuses}</option>
              <option value="ACTIVE">{t.ACTIVE}</option>
              <option value="INACTIVE">{t.INACTIVE}</option>
              <option value="BLOCKED">{t.BLOCKED}</option>
            </select>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: dimText }}>
              ⏳ {t.loading}
            </div>
          )}

          {/* Customer Table */}
          {!loading && (
            <>
              {customers.length === 0 ? (
                <p style={{ color: dimText, textAlign: 'center', padding: 40 }}>
                  {t.noCustomers}
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr>
                        {[t.name, t.type, t.city, t.phone, t.email, t.status].map((h) => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((c) => (
                        <tr
                          key={c.id}
                          onClick={() => fetchDetail(c.id)}
                          style={{ cursor: 'pointer', transition: 'background .15s' }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLElement).style.background = isDark
                              ? 'rgba(255,255,255,.04)'
                              : 'rgba(0,0,0,.02)')
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLElement).style.background = 'transparent')
                          }
                        >
                          <td style={{ ...tdStyle, color: th.text, fontWeight: 600 }}>
                            {c.name}
                          </td>
                          <td style={tdStyle}>
                            {TYPE_ICONS[c.customer_type] || ''} {t[c.customer_type] || c.customer_type}
                          </td>
                          <td style={tdStyle}>{c.city || '–'}</td>
                          <td style={tdStyle}>{c.phone || '–'}</td>
                          <td style={tdStyle}>{c.email || '–'}</td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${th.border}` }}>
                            <span
                              style={{
                                display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                                fontSize: 12, fontWeight: 600,
                                background: `${STATUS_COLORS[c.status] || '#95a5a6'}22`,
                                color: STATUS_COLORS[c.status] || '#95a5a6',
                              }}
                            >
                              {t[c.status] || c.status}
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
                <div
                  style={{
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    gap: 12, marginTop: 16,
                  }}
                >
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    style={paginationBtn(page <= 1)}
                  >
                    {t.prev}
                  </button>
                  <span style={{ color: dimText, fontSize: 14 }}>
                    {t.page} {page} {t.of} {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
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
          <button onClick={closeDetail} style={btnBack}>
            {t.back}
          </button>

          <div
            style={{
              padding: 24, borderRadius: 14,
              background: panelBg,
              border: `1px solid ${th.border}`,
            }}
          >
            {/* Detail header */}
            <div
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 16, flexWrap: 'wrap', gap: 8,
              }}
            >
              <h2 style={{ margin: 0, color: th.text }}>
                {editing
                  ? (form.name || (selected ? selected.name : t.add))
                  : (selected?.name || '')}
              </h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selected && !editing && canEdit && (
                  <>
                    <button
                      onClick={() => {
                        setForm(customerToForm(selected));
                        setEditing(true);
                      }}
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
                          <button onClick={deleteCustomer} style={btnDanger}>
                            {t.yes}
                          </button>
                          <button onClick={() => setConfirmDelete(false)} style={btnSecondary}>
                            {t.no}
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelete(true)} style={btnDanger}>
                          {t.delete}
                        </button>
                      )
                    )}
                  </>
                )}
                {editing && (
                  <>
                    <button onClick={saveCustomer} style={btnPrimary}>
                      {t.save}
                    </button>
                    <button
                      onClick={() => {
                        if (selected) {
                          setForm(customerToForm(selected));
                          setEditing(false);
                        } else {
                          closeDetail();
                        }
                      }}
                      style={btnSecondary}
                    >
                      {t.cancel}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Status badge (view mode) */}
            {selected && !editing && (
              <div style={{ marginBottom: 16 }}>
                <span
                  style={{
                    display: 'inline-block', padding: '4px 12px', borderRadius: 20,
                    fontSize: 12, fontWeight: 600,
                    background: `${STATUS_COLORS[selected.status] || '#95a5a6'}22`,
                    color: STATUS_COLORS[selected.status] || '#95a5a6',
                  }}
                >
                  {t[selected.status] || selected.status}
                </span>
                <span style={{ marginLeft: 12, fontSize: 13, color: dimText }}>
                  {TYPE_ICONS[selected.customer_type] || ''} {t[selected.customer_type] || selected.customer_type}
                </span>
              </div>
            )}

            {/* Stats row (view mode) */}
            {selected && !editing && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                {[
                  { label: t.tasks, value: selected.tasks_count ?? 0 },
                  { label: t.activeTasks, value: selected.active_tasks_count ?? 0 },
                  { label: t.totalHours, value: formatCurrency(selected.total_hours) },
                  {
                    label: t.memberSince,
                    value: selected.created_at
                      ? new Date(selected.created_at).toLocaleDateString(locale)
                      : '–',
                  },
                ].map((s) => (
                  <div key={s.label} style={statCard}>
                    <div style={{ fontSize: 12, color: dimText }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: th.text }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${th.border}` }}>
              {(['general', 'contacts', 'billing', 'notes'] as const).map((tb) => (
                <button key={tb} onClick={() => setTab(tb)} style={tabBtnStyle(tab === tb)}>
                  {t[tb === 'notes' ? 'notesTab' : tb]}
                </button>
              ))}
            </div>

            {/* ── General Tab ── */}
            {tab === 'general' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {([
                  ['name', t.name],
                  ['customer_type', t.type],
                  ['company_name', t.company],
                  ['street', t.street],
                  ['postal_code', t.postalCode],
                  ['city', t.city],
                  ['canton', t.canton],
                  ['phone', t.phone],
                  ['email', t.email],
                  ['website', t.website],
                  ['status', t.status],
                  ['language', t.language],
                ] as [string, string][]).map(([key, label]) => (
                  <div key={key}>
                    <label style={labelStyle}>{label}</label>
                    {editing ? (
                      key === 'customer_type' ? (
                        <select
                          value={(form as any)[key] || ''}
                          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                          style={selectStyle}
                        >
                          <option value="PRIVATE">{t.PRIVATE}</option>
                          <option value="COMPANY">{t.COMPANY}</option>
                        </select>
                      ) : key === 'status' ? (
                        <select
                          value={(form as any)[key] || ''}
                          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                          style={selectStyle}
                        >
                          <option value="ACTIVE">{t.ACTIVE}</option>
                          <option value="INACTIVE">{t.INACTIVE}</option>
                          <option value="BLOCKED">{t.BLOCKED}</option>
                        </select>
                      ) : key === 'language' ? (
                        <select
                          value={(form as any)[key] || 'de'}
                          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                          style={selectStyle}
                        >
                          <option value="de">Deutsch</option>
                          <option value="en">English</option>
                          <option value="fr">Français</option>
                          <option value="pt">Português</option>
                        </select>
                      ) : (
                        <input
                          value={(form as any)[key] || ''}
                          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                          style={inputStyle}
                        />
                      )
                    ) : (
                      <p style={{ margin: '4px 0 0', color: th.text, fontSize: 14 }}>
                        {key === 'customer_type'
                          ? `${TYPE_ICONS[(selected as any)?.[key]] || ''} ${t[(selected as any)?.[key]] || (selected as any)?.[key] || '–'}`
                          : key === 'status'
                            ? t[(selected as any)?.[key]] || (selected as any)?.[key] || '–'
                            : key === 'language'
                              ? ({ de: 'Deutsch', en: 'English', fr: 'Français', pt: 'Português' } as any)[(selected as any)?.[key]] || (selected as any)?.[key] || '–'
                              : (selected as any)?.[key] || '–'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Contacts Tab ── */}
            {tab === 'contacts' && (
              <div>
                {contacts.length === 0 && !canEdit && (
                  <p style={{ color: dimText, textAlign: 'center', padding: 20 }}>—</p>
                )}
                {contacts.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 0', borderBottom: `1px solid ${th.border}`,
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: th.text }}>
                        {c.first_name} {c.last_name}
                      </span>
                      {c.is_primary && (
                        <span
                          style={{
                            marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 20,
                            background: isDark ? 'rgba(78,205,196,.15)' : 'rgba(78,205,196,.12)',
                            color: '#4ecdc4', fontWeight: 600,
                          }}
                        >
                          {t.primary}
                        </span>
                      )}
                      <div style={{ fontSize: 13, color: dimText, marginTop: 2 }}>
                        {c.role ? `${c.role} · ` : ''}
                        {c.email ? `${c.email} ` : ''}
                        {c.phone || ''}
                      </div>
                    </div>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => {
                            setContactForm({ ...c });
                            setEditingContact(c.id);
                          }}
                          style={contactBtnSmall(th.gold)}
                        >
                          {t.edit}
                        </button>
                        <button
                          onClick={() => deleteContact(c.id)}
                          style={contactBtnSmall('#e74c3c')}
                        >
                          {t.delete}
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Contact add/edit form */}
                {canEdit && (
                  <div style={{
                    marginTop: 20, padding: 16, borderRadius: 10,
                    background: isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)',
                  }}>
                    <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: th.text }}>
                      {editingContact ? t.edit : t.addContact}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>{t.firstName}</label>
                        <input
                          value={contactForm.first_name || ''}
                          onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>{t.lastName}</label>
                        <input
                          value={contactForm.last_name || ''}
                          onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>{t.email}</label>
                        <input
                          value={contactForm.email || ''}
                          onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>{t.phone}</label>
                        <input
                          value={contactForm.phone || ''}
                          onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>{t.role}</label>
                        <input
                          value={contactForm.role || ''}
                          onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'end', gap: 10 }}>
                        <button onClick={saveContact} style={btnPrimary}>
                          {editingContact ? t.save : t.addContact}
                        </button>
                        {editingContact && (
                          <button
                            onClick={() => { setContactForm({}); setEditingContact(null); }}
                            style={btnSecondary}
                          >
                            {t.cancel}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Billing Tab ── */}
            {tab === 'billing' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>{t.paymentTerms}</label>
                  {editing ? (
                    <input
                      type="number"
                      value={form.payment_terms ?? ''}
                      onChange={(e) =>
                        setForm({ ...form, payment_terms: parseInt(e.target.value, 10) || undefined })
                      }
                      style={inputStyle}
                    />
                  ) : (
                    <p style={{ margin: '4px 0 0', color: th.text, fontSize: 14 }}>
                      {selected?.payment_terms != null
                        ? `${selected.payment_terms} ${t.paymentTerms.match(/\((.+)\)/)?.[1] || 'days'}`
                        : '–'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Notes Tab ── */}
            {tab === 'notes' && (
              <div>
                {editing ? (
                  <textarea
                    value={form.notes || ''}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={6}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                ) : (
                  <p style={{ color: th.text, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>
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
