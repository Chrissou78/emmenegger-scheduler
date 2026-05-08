import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTheme } from '../contexts/themeContext';
import { useAuthStore } from '../contexts/authStore';

const API = import.meta.env.VITE_API_URL || '';

/* ─── Types ─── */
interface Contact {
  id: string;
  customer_id: string;
  first_name: string;
  last_name: string;
  role?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  is_primary: boolean;
  notes?: string;
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
  country?: string;
  address?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
  status: string;
  tags?: string[];
  language?: string;
  payment_terms?: number;
  vat_number?: string;
  discount_percent?: number;
  total_revenue?: number;
  total_outstanding?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  contacts?: Contact[];
  stats?: {
    taskCount: number;
    quoteCount: number;
    quoteTotal: number;
    invoiceCount: number;
    totalRevenue: number;
    totalOutstanding: number;
  };
}

/* ─── Translations ─── */
const T: Record<string, Record<string, string>> = {
  de: {
    title: 'Kundenverwaltung', search: 'Suchen...', newCustomer: 'Neuer Kunde',
    name: 'Name', type: 'Typ', city: 'Ort', status: 'Status', contact: 'Kontakt',
    tasks: 'Aufträge', quotes: 'Offerten', invoices: 'Rechnungen', revenue: 'Umsatz',
    outstanding: 'Ausstehend', all: 'Alle', active: 'Aktiv', inactive: 'Inaktiv',
    lead: 'Lead', prospect: 'Interessent', blocked: 'Gesperrt',
    privat: 'Privat', firma: 'Firma', gemeinde: 'Gemeinde', verwaltung: 'Verwaltung', verein: 'Verein',
    save: 'Speichern', cancel: 'Abbrechen', delete: 'Löschen', edit: 'Bearbeiten',
    generalInfo: 'Allgemein', address: 'Adresse', contactInfo: 'Kontaktdaten',
    billing: 'Abrechnung', notes: 'Notizen', contacts: 'Kontakte',
    street: 'Strasse', postalCode: 'PLZ', canton: 'Kanton', country: 'Land',
    phone: 'Telefon', email: 'E-Mail', website: 'Website', mobile: 'Mobile',
    paymentTerms: 'Zahlungsfrist (Tage)', vatNumber: 'MwSt-Nr.',
    discount: 'Rabatt %', language: 'Sprache', companyName: 'Firmenname',
    firstName: 'Vorname', lastName: 'Nachname', role: 'Funktion', primary: 'Hauptkontakt',
    addContact: 'Kontakt hinzufügen', noContacts: 'Keine Kontakte',
    confirmDelete: 'Wirklich löschen?', totalCustomers: 'Kunden gesamt',
    saved: 'Gespeichert', deleted: 'Gelöscht', error: 'Fehler',
  },
  en: {
    title: 'Customer Management', search: 'Search...', newCustomer: 'New Customer',
    name: 'Name', type: 'Type', city: 'City', status: 'Status', contact: 'Contact',
    tasks: 'Tasks', quotes: 'Quotes', invoices: 'Invoices', revenue: 'Revenue',
    outstanding: 'Outstanding', all: 'All', active: 'Active', inactive: 'Inactive',
    lead: 'Lead', prospect: 'Prospect', blocked: 'Blocked',
    privat: 'Private', firma: 'Company', gemeinde: 'Municipality', verwaltung: 'Administration', verein: 'Association',
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit',
    generalInfo: 'General', address: 'Address', contactInfo: 'Contact Info',
    billing: 'Billing', notes: 'Notes', contacts: 'Contacts',
    street: 'Street', postalCode: 'ZIP', canton: 'Canton', country: 'Country',
    phone: 'Phone', email: 'Email', website: 'Website', mobile: 'Mobile',
    paymentTerms: 'Payment Terms (Days)', vatNumber: 'VAT Number',
    discount: 'Discount %', language: 'Language', companyName: 'Company Name',
    firstName: 'First Name', lastName: 'Last Name', role: 'Role', primary: 'Primary',
    addContact: 'Add Contact', noContacts: 'No contacts',
    confirmDelete: 'Really delete?', totalCustomers: 'Total Customers',
    saved: 'Saved', deleted: 'Deleted', error: 'Error',
  },
  fr: {
    title: 'Gestion des clients', search: 'Rechercher...', newCustomer: 'Nouveau client',
    name: 'Nom', type: 'Type', city: 'Ville', status: 'Statut', contact: 'Contact',
    tasks: 'Tâches', quotes: 'Devis', invoices: 'Factures', revenue: 'Chiffre d\'affaires',
    outstanding: 'En cours', all: 'Tous', active: 'Actif', inactive: 'Inactif',
    lead: 'Lead', prospect: 'Prospect', blocked: 'Bloqué',
    privat: 'Privé', firma: 'Entreprise', gemeinde: 'Commune', verwaltung: 'Administration', verein: 'Association',
    save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer', edit: 'Modifier',
    generalInfo: 'Général', address: 'Adresse', contactInfo: 'Coordonnées',
    billing: 'Facturation', notes: 'Notes', contacts: 'Contacts',
    street: 'Rue', postalCode: 'NPA', canton: 'Canton', country: 'Pays',
    phone: 'Téléphone', email: 'E-mail', website: 'Site web', mobile: 'Mobile',
    paymentTerms: 'Délai de paiement (jours)', vatNumber: 'N° TVA',
    discount: 'Remise %', language: 'Langue', companyName: 'Raison sociale',
    firstName: 'Prénom', lastName: 'Nom', role: 'Fonction', primary: 'Principal',
    addContact: 'Ajouter un contact', noContacts: 'Aucun contact',
    confirmDelete: 'Vraiment supprimer?', totalCustomers: 'Total clients',
    saved: 'Enregistré', deleted: 'Supprimé', error: 'Erreur',
  },
  pt: {
    title: 'Gestão de Clientes', search: 'Pesquisar...', newCustomer: 'Novo Cliente',
    name: 'Nome', type: 'Tipo', city: 'Cidade', status: 'Estado', contact: 'Contacto',
    tasks: 'Tarefas', quotes: 'Orçamentos', invoices: 'Faturas', revenue: 'Receita',
    outstanding: 'Pendente', all: 'Todos', active: 'Ativo', inactive: 'Inativo',
    lead: 'Lead', prospect: 'Prospeto', blocked: 'Bloqueado',
    privat: 'Privado', firma: 'Empresa', gemeinde: 'Município', verwaltung: 'Administração', verein: 'Associação',
    save: 'Salvar', cancel: 'Cancelar', delete: 'Excluir', edit: 'Editar',
    generalInfo: 'Geral', address: 'Endereço', contactInfo: 'Dados de Contacto',
    billing: 'Faturação', notes: 'Notas', contacts: 'Contactos',
    street: 'Rua', postalCode: 'Código Postal', canton: 'Cantão', country: 'País',
    phone: 'Telefone', email: 'E-mail', website: 'Site', mobile: 'Telemóvel',
    paymentTerms: 'Prazo de pagamento (dias)', vatNumber: 'NIF',
    discount: 'Desconto %', language: 'Idioma', companyName: 'Nome da Empresa',
    firstName: 'Nome', lastName: 'Apelido', role: 'Função', primary: 'Principal',
    addContact: 'Adicionar contacto', noContacts: 'Sem contactos',
    confirmDelete: 'Realmente excluir?', totalCustomers: 'Total Clientes',
    saved: 'Salvo', deleted: 'Excluído', error: 'Erro',
  },
};

const STATUS_COLORS: Record<string, string> = {
  LEAD: '#6366f1', PROSPECT: '#f59e0b', ACTIVE: '#22c55e', INACTIVE: '#6b7280', BLOCKED: '#ef4444',
};

const TYPE_ICONS: Record<string, string> = {
  PRIVAT: '👤', FIRMA: '🏢', GEMEINDE: '🏛️', VERWALTUNG: '📋', VEREIN: '🤝',
};

export function CustomersPage() {
  const { th, isDark, lang } = useTheme();
  const { token } = useAuthStore();
  const t = T[lang] || T.de;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Detail/Edit state
  const [selected, setSelected] = useState<Customer | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Customer>>({});
  const [activeTab, setActiveTab] = useState<'general' | 'contacts' | 'billing' | 'notes'>('general');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactForm, setContactForm] = useState<Partial<Contact> | null>(null);

  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = (msg: string, err = false) => {
    setToast({ msg, err });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  /* ─── Fetch customers ─── */
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterStatus !== 'ALL') params.set('status', filterStatus);
      if (filterType !== 'ALL') params.set('customer_type', filterType);
      params.set('limit', String(pageSize));
      params.set('offset', String(page * pageSize));
      params.set('includeInactive', 'true');

      const res = await fetch(`${API}/api/v1/customers?${params}`, { headers: headers() });
      const json = await res.json();
      setCustomers(json.data || []);
      setTotal(json.meta?.total || 0);
    } catch { showToast(t.error, true); }
    setLoading(false);
  }, [search, filterStatus, filterType, page, headers, t.error]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  /* ─── Fetch single customer detail ─── */
  const fetchDetail = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/v1/customers/${id}`, { headers: headers() });
      const json = await res.json();
      setSelected(json.data);
      setContacts(json.data?.contacts || []);
      setForm(json.data || {});
      setActiveTab('general');
      setEditing(false);
      setContactForm(null);
    } catch { showToast(t.error, true); }
  };

  /* ─── Save customer ─── */
  const saveCustomer = async () => {
    try {
      const isNew = !form.id;
      const url = isNew ? `${API}/api/v1/customers` : `${API}/api/v1/customers/${form.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(form) });
      if (!res.ok) throw new Error();

      const json = await res.json();
      showToast(t.saved);
      if (isNew) {
        setSelected(json.data);
        setForm(json.data);
        setEditing(false);
      } else {
        fetchDetail(form.id!);
      }
      fetchCustomers();
    } catch { showToast(t.error, true); }
  };

  /* ─── Delete customer ─── */
  const deleteCustomer = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    try {
      await fetch(`${API}/api/v1/customers/${id}`, { method: 'DELETE', headers: headers() });
      showToast(t.deleted);
      setSelected(null);
      fetchCustomers();
    } catch { showToast(t.error, true); }
  };

  /* ─── Contact CRUD ─── */
  const saveContact = async () => {
    if (!contactForm) return;
    try {
      const isNew = !contactForm.id;
      const url = isNew ? `${API}/api/v1/contacts` : `${API}/api/v1/contacts/${contactForm.id}`;
      const body = { ...contactForm, customer_id: selected?.id };
      const res = await fetch(url, { method: isNew ? 'POST' : 'PUT', headers: headers(), body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      showToast(t.saved);
      setContactForm(null);
      if (selected) fetchDetail(selected.id);
    } catch { showToast(t.error, true); }
  };

  const deleteContact = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    try {
      await fetch(`${API}/api/v1/contacts/${id}`, { method: 'DELETE', headers: headers() });
      showToast(t.deleted);
      if (selected) fetchDetail(selected.id);
    } catch { showToast(t.error, true); }
  };

  /* ─── Helpers ─── */
  const chf = (n?: number) => n != null ? `CHF ${n.toLocaleString('de-CH', { minimumFractionDigits: 2 })}` : '–';
  const statusLabel = (s: string) => t[s.toLowerCase()] || s;
  const typeLabel = (ty: string) => t[ty.toLowerCase()] || ty;

  const inp = (overrides?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 13,
    border: `1px solid ${th.border}`, background: th.bg, color: th.text,
    outline: 'none', fontFamily: "'Inter',sans-serif", ...overrides,
  });

  const btn = (primary = false): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    border: primary ? 'none' : `1px solid ${th.border}`,
    background: primary ? th.gold : 'transparent',
    color: primary ? '#fff' : th.text, cursor: 'pointer',
    fontFamily: "'Inter',sans-serif",
  });

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: '6px 6px 0 0', fontSize: 12, fontWeight: 600,
    border: 'none', borderBottom: active ? `2px solid ${th.gold}` : '2px solid transparent',
    background: active ? (isDark ? 'rgba(200,169,110,.12)' : 'rgba(200,169,110,.08)') : 'transparent',
    color: active ? th.gold : th.textMuted, cursor: 'pointer',
    fontFamily: "'Inter',sans-serif",
  });

  /* ─── Stats ─── */
  const stats = useMemo(() => ({
    total,
    active: customers.filter(c => c.status === 'ACTIVE').length,
    leads: customers.filter(c => c.status === 'LEAD').length,
  }), [customers, total]);

  return (
    <div style={{ padding: 24, fontFamily: "'Inter','Segoe UI',sans-serif", color: th.text, minHeight: '100vh' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 24px', borderRadius: 8,
          background: toast.err ? th.toastErrBg : th.toastBg, color: toast.err ? th.toastErrText : th.toastText,
          border: `1px solid ${toast.err ? th.toastErrBorder : th.toastBorder}`, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,.3)',
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 300, letterSpacing: 2, color: th.gold, margin: 0 }}>{t.title}</h1>
          <div style={{ fontSize: 12, color: th.textDim, marginTop: 4 }}>
            {stats.total} {t.totalCustomers} · {stats.active} {t.active}
          </div>
        </div>
        <button style={btn(true)} onClick={() => {
          setSelected(null);
          setForm({ customer_type: 'PRIVAT', status: 'ACTIVE', language: 'de', country: 'CH', payment_terms: 30 });
          setEditing(true);
          setContacts([]);
          setActiveTab('general');
        }}>{t.newCustomer}</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" placeholder={t.search} value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          style={inp({ maxWidth: 280 })}
        />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
          style={inp({ maxWidth: 150 })}>
          <option value="ALL">{t.all} {t.status}</option>
          <option value="ACTIVE">{t.active}</option>
          <option value="LEAD">{t.lead}</option>
          <option value="PROSPECT">{t.prospect}</option>
          <option value="INACTIVE">{t.inactive}</option>
          <option value="BLOCKED">{t.blocked}</option>
        </select>
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0); }}
          style={inp({ maxWidth: 150 })}>
          <option value="ALL">{t.all} {t.type}</option>
          <option value="PRIVAT">{t.privat}</option>
          <option value="FIRMA">{t.firma}</option>
          <option value="GEMEINDE">{t.gemeinde}</option>
          <option value="VERWALTUNG">{t.verwaltung}</option>
          <option value="VEREIN">{t.verein}</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* ─── Customer List ─── */}
        <div style={{ flex: selected || editing ? '0 0 420px' : 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: th.textDim }}>⏳</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: th.bgHeader, borderBottom: `1px solid ${th.border}` }}>
                  {[t.name, t.type, t.city, t.status, t.contact].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: th.textMuted, fontSize: 11, letterSpacing: .5, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}
                    onClick={() => fetchDetail(c.id)}
                    style={{
                      cursor: 'pointer', borderBottom: `1px solid ${th.borderFaint}`,
                      background: selected?.id === c.id ? (isDark ? 'rgba(200,169,110,.08)' : 'rgba(200,169,110,.06)') : 'transparent',
                    }}
                    onMouseEnter={e => { if (selected?.id !== c.id) e.currentTarget.style.background = th.rowHover; }}
                    onMouseLeave={e => { if (selected?.id !== c.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span>{TYPE_ICONS[c.customer_type] || ''} {typeLabel(c.customer_type || 'PRIVAT')}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: th.textMuted }}>{c.city || '–'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                        background: `${STATUS_COLORS[c.status] || '#6b7280'}22`,
                        color: STATUS_COLORS[c.status] || '#6b7280',
                      }}>{statusLabel(c.status || 'ACTIVE')}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: th.textDim, fontSize: 12 }}>
                      {c.contact_name || c.email || '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {total > pageSize && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                style={{ ...btn(), opacity: page === 0 ? .4 : 1 }}>←</button>
              <span style={{ fontSize: 12, color: th.textMuted, padding: '8px 12px' }}>
                {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} / {total}
              </span>
              <button disabled={(page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)}
                style={{ ...btn(), opacity: (page + 1) * pageSize >= total ? .4 : 1 }}>→</button>
            </div>
          )}
        </div>

        {/* ─── Detail / Edit Panel ─── */}
        {(selected || editing) && (
          <div style={{
            flex: 1, background: th.bgCard, borderRadius: 12, border: `1px solid ${th.border}`,
            padding: 24, overflow: 'auto', maxHeight: 'calc(100vh - 140px)',
          }}>
            {/* Panel header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: th.gold }}>
                {editing && !form.id ? t.newCustomer : form.name || ''}
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {!editing && selected && (
                  <>
                    <button style={btn(true)} onClick={() => { setForm({ ...selected }); setEditing(true); }}>{t.edit}</button>
                    <button style={{ ...btn(), color: '#ef4444' }} onClick={() => deleteCustomer(selected.id)}>{t.delete}</button>
                  </>
                )}
                <button style={btn()} onClick={() => { setSelected(null); setEditing(false); }}>✕</button>
              </div>
            </div>

            {/* Stats bar (only for existing customer) */}
            {selected?.stats && !editing && (
              <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                  { label: t.tasks, value: selected.stats.taskCount },
                  { label: t.quotes, value: selected.stats.quoteCount },
                  { label: t.invoices, value: selected.stats.invoiceCount },
                  { label: t.revenue, value: chf(selected.stats.totalRevenue) },
                  { label: t.outstanding, value: chf(selected.stats.totalOutstanding) },
                ].map(s => (
                  <div key={s.label} style={{
                    padding: '8px 16px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)',
                    border: `1px solid ${th.borderFaint}`,
                  }}>
                    <div style={{ fontSize: 10, color: th.textDim, textTransform: 'uppercase', letterSpacing: .5 }}>{s.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: th.gold }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${th.border}`, marginBottom: 20 }}>
              {(['general', 'contacts', 'billing', 'notes'] as const).map(tab => (
                <button key={tab} style={tabStyle(activeTab === tab)} onClick={() => setActiveTab(tab)}>
                  {{ general: t.generalInfo, contacts: t.contacts, billing: t.billing, notes: t.notes }[tab]}
                </button>
              ))}
            </div>

            {/* ─── General Tab ─── */}
            {activeTab === 'general' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.name} *</label>
                  {editing ? (
                    <input style={inp()} value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
                  ) : <div style={{ padding: '8px 0', fontSize: 14 }}>{selected?.name || '–'}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.type}</label>
                  {editing ? (
                    <select style={inp()} value={form.customer_type || 'PRIVAT'} onChange={e => setForm({ ...form, customer_type: e.target.value })}>
                      {['PRIVAT', 'FIRMA', 'GEMEINDE', 'VERWALTUNG', 'VEREIN'].map(ty => (
                        <option key={ty} value={ty}>{typeLabel(ty)}</option>
                      ))}
                    </select>
                  ) : <div style={{ padding: '8px 0', fontSize: 14 }}>{TYPE_ICONS[selected?.customer_type || ''] || ''} {typeLabel(selected?.customer_type || 'PRIVAT')}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.companyName}</label>
                  {editing ? (
                    <input style={inp()} value={form.company_name || ''} onChange={e => setForm({ ...form, company_name: e.target.value })} />
                  ) : <div style={{ padding: '8px 0', fontSize: 14 }}>{selected?.company_name || '–'}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.status}</label>
                  {editing ? (
                    <select style={inp()} value={form.status || 'ACTIVE'} onChange={e => setForm({ ...form, status: e.target.value })}>
                      {['LEAD', 'PROSPECT', 'ACTIVE', 'INACTIVE', 'BLOCKED'].map(s => (
                        <option key={s} value={s}>{statusLabel(s)}</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ padding: '8px 0' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                        background: `${STATUS_COLORS[selected?.status || ''] || '#6b7280'}22`,
                        color: STATUS_COLORS[selected?.status || ''] || '#6b7280',
                      }}>{statusLabel(selected?.status || 'ACTIVE')}</span>
                    </div>
                  )}
                </div>

                {/* Address section */}
                <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: th.textMuted, marginBottom: 8 }}>{t.address}</div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.street}</label>
                  {editing ? (
                    <input style={inp()} value={form.street || ''} onChange={e => setForm({ ...form, street: e.target.value })} />
                  ) : <div style={{ padding: '8px 0', fontSize: 14 }}>{selected?.street || '–'}</div>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.postalCode}</label>
                    {editing ? (
                      <input style={inp()} value={form.postal_code || ''} onChange={e => setForm({ ...form, postal_code: e.target.value })} />
                    ) : <div style={{ padding: '8px 0', fontSize: 14 }}>{selected?.postal_code || '–'}</div>}
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.city}</label>
                    {editing ? (
                      <input style={inp()} value={form.city || ''} onChange={e => setForm({ ...form, city: e.target.value })} />
                    ) : <div style={{ padding: '8px 0', fontSize: 14 }}>{selected?.city || '–'}</div>}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.canton}</label>
                  {editing ? (
                    <input style={inp()} maxLength={2} value={form.canton || ''} onChange={e => setForm({ ...form, canton: e.target.value })} />
                  ) : <div style={{ padding: '8px 0', fontSize: 14 }}>{selected?.canton || '–'}</div>}
                </div>

                {/* Contact section */}
                <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: th.textMuted, marginBottom: 8 }}>{t.contactInfo}</div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.phone}</label>
                  {editing ? (
                    <input style={inp()} value={form.phone || form.contact_phone || ''} onChange={e => setForm({ ...form, phone: e.target.value, contact_phone: e.target.value })} />
                  ) : <div style={{ padding: '8px 0', fontSize: 14 }}>{selected?.phone || selected?.contact_phone || '–'}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.email}</label>
                  {editing ? (
                    <input style={inp()} value={form.email || form.contact_email || ''} onChange={e => setForm({ ...form, email: e.target.value, contact_email: e.target.value })} />
                  ) : <div style={{ padding: '8px 0', fontSize: 14 }}>{selected?.email || selected?.contact_email || '–'}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.website}</label>
                  {editing ? (
                    <input style={inp()} value={form.website || ''} onChange={e => setForm({ ...form, website: e.target.value })} />
                  ) : <div style={{ padding: '8px 0', fontSize: 14 }}>{selected?.website || '–'}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.language}</label>
                  {editing ? (
                    <select style={inp()} value={form.language || 'de'} onChange={e => setForm({ ...form, language: e.target.value })}>
                      {['de', 'en', 'fr', 'pt'].map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                    </select>
                  ) : <div style={{ padding: '8px 0', fontSize: 14 }}>{(selected?.language || 'de').toUpperCase()}</div>}
                </div>

                {editing && (
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                    <button style={btn()} onClick={() => { if (selected) { setForm({ ...selected }); setEditing(false); } else { setSelected(null); setEditing(false); } }}>{t.cancel}</button>
                    <button style={btn(true)} onClick={saveCustomer}>{t.save}</button>
                  </div>
                )}
              </div>
            )}

            {/* ─── Contacts Tab ─── */}
            {activeTab === 'contacts' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: th.textMuted }}>{contacts.length} {t.contacts}</div>
                  {selected && (
                    <button style={btn(true)} onClick={() => setContactForm({ is_primary: false })}>{t.addContact}</button>
                  )}
                </div>

                {contacts.length === 0 && !contactForm && (
                  <div style={{ textAlign: 'center', padding: 40, color: th.textDim }}>{t.noContacts}</div>
                )}

                {contacts.map(ct => (
                  <div key={ct.id} style={{
                    padding: 16, borderRadius: 8, border: `1px solid ${th.borderFaint}`,
                    marginBottom: 8, background: ct.is_primary ? (isDark ? 'rgba(200,169,110,.06)' : 'rgba(200,169,110,.04)') : 'transparent',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{ct.first_name} {ct.last_name}</span>
                        {ct.is_primary && <span style={{ marginLeft: 8, padding: '2px 6px', borderRadius: 6, fontSize: 10, background: `${th.gold}22`, color: th.gold, fontWeight: 700 }}>★ {t.primary}</span>}
                        {ct.role && <span style={{ marginLeft: 8, color: th.textDim, fontSize: 12 }}>{ct.role}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={{ ...btn(), fontSize: 11, padding: '4px 8px' }} onClick={() => setContactForm(ct)}>{t.edit}</button>
                        <button style={{ ...btn(), fontSize: 11, padding: '4px 8px', color: '#ef4444' }} onClick={() => deleteContact(ct.id)}>{t.delete}</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: th.textMuted }}>
                      {ct.phone && <span>📞 {ct.phone}</span>}
                      {ct.mobile && <span>📱 {ct.mobile}</span>}
                      {ct.email && <span>✉️ {ct.email}</span>}
                    </div>
                  </div>
                ))}

                {/* Contact form */}
                {contactForm && (
                  <div style={{ padding: 16, borderRadius: 8, border: `1px solid ${th.gold}33`, background: isDark ? 'rgba(200,169,110,.04)' : 'rgba(200,169,110,.02)', marginTop: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.firstName}</label>
                        <input style={inp()} value={contactForm.first_name || ''} onChange={e => setContactForm({ ...contactForm, first_name: e.target.value })} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.lastName}</label>
                        <input style={inp()} value={contactForm.last_name || ''} onChange={e => setContactForm({ ...contactForm, last_name: e.target.value })} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.role}</label>
                        <input style={inp()} value={contactForm.role || ''} onChange={e => setContactForm({ ...contactForm, role: e.target.value })} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.phone}</label>
                        <input style={inp()} value={contactForm.phone || ''} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.mobile}</label>
                        <input style={inp()} value={contactForm.mobile || ''} onChange={e => setContactForm({ ...contactForm, mobile: e.target.value })} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.email}</label>
                        <input style={inp()} value={contactForm.email || ''} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={contactForm.is_primary || false} onChange={e => setContactForm({ ...contactForm, is_primary: e.target.checked })} />
                        <label style={{ fontSize: 12, color: th.textMuted }}>{t.primary}</label>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                      <button style={btn()} onClick={() => setContactForm(null)}>{t.cancel}</button>
                      <button style={btn(true)} onClick={saveContact}>{t.save}</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── Billing Tab ─── */}
            {activeTab === 'billing' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.paymentTerms}</label>
                  {editing ? (
                    <input type="number" style={inp()} value={form.payment_terms ?? 30} onChange={e => setForm({ ...form, payment_terms: parseInt(e.target.value) || 30 })} />
                  ) : <div style={{ padding: '8px 0', fontSize: 14 }}>{selected?.payment_terms || 30} {t.language === 'de' ? 'Tage' : 'days'}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.vatNumber}</label>
                  {editing ? (
                    <input style={inp()} value={form.vat_number || ''} onChange={e => setForm({ ...form, vat_number: e.target.value })} />
                  ) : <div style={{ padding: '8px 0', fontSize: 14 }}>{selected?.vat_number || '–'}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.discount}</label>
                  {editing ? (
                    <input type="number" step="0.1" style={inp()} value={form.discount_percent ?? 0} onChange={e => setForm({ ...form, discount_percent: parseFloat(e.target.value) || 0 })} />
                  ) : <div style={{ padding: '8px 0', fontSize: 14 }}>{selected?.discount_percent || 0}%</div>}
                </div>

                {selected?.stats && !editing && (
                  <>
                    <div style={{ gridColumn: '1 / -1', marginTop: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: th.textMuted, marginBottom: 8 }}>Finanzen</div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: th.textDim }}>{t.revenue}</label>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{chf(selected.stats.totalRevenue)}</div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: th.textDim }}>{t.outstanding}</label>
                      <div style={{ fontSize: 20, fontWeight: 700, color: selected.stats.totalOutstanding > 0 ? '#f59e0b' : th.textDim }}>{chf(selected.stats.totalOutstanding)}</div>
                    </div>
                  </>
                )}

                {editing && (
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                    <button style={btn()} onClick={() => { if (selected) { setForm({ ...selected }); setEditing(false); } else { setSelected(null); setEditing(false); } }}>{t.cancel}</button>
                    <button style={btn(true)} onClick={saveCustomer}>{t.save}</button>
                  </div>
                )}
              </div>
            )}

            {/* ─── Notes Tab ─── */}
            {activeTab === 'notes' && (
              <div>
                <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.notes}</label>
                {editing ? (
                  <textarea style={{ ...inp(), minHeight: 200, resize: 'vertical' }} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
                ) : (
                  <div style={{ padding: '8px 0', fontSize: 14, whiteSpace: 'pre-wrap' }}>{selected?.notes || '–'}</div>
                )}
                {editing && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                    <button style={btn()} onClick={() => { if (selected) { setForm({ ...selected }); setEditing(false); } else { setSelected(null); setEditing(false); } }}>{t.cancel}</button>
                    <button style={btn(true)} onClick={saveCustomer}>{t.save}</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
