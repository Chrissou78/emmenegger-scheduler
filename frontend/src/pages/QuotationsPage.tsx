import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../contexts/themeContext';
import { useAuthStore } from '../contexts/authStore';

const API = import.meta.env.VITE_API_URL || '';

interface QuoteItem {
  id?: string;
  sort_order: number;
  description: string;
  detail?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  vat_rate: number;
  total: number;
  task_id?: string;
}

interface Quotation {
  id: string;
  quote_number: string;
  customer_id: string;
  contact_id?: string;
  title: string;
  description?: string;
  status: string;
  quote_date: string;
  valid_until?: string;
  sent_date?: string;
  accepted_date?: string;
  subtotal: number;
  vat_amount: number;
  discount_amount: number;
  total_gross: number;
  currency: string;
  payment_terms: number;
  notes?: string;
  customer?: { id: string; name: string; city?: string };
  contact?: { id: string; first_name: string; last_name: string };
  items?: QuoteItem[];
  created_at: string;
}

interface Customer { id: string; name: string; city?: string; }
interface Contact { id: string; first_name: string; last_name: string; }

const T: Record<string, Record<string, string>> = {
  de: {
    title: 'Offerten', search: 'Suchen...', newQuote: 'Neue Offerte',
    number: 'Nr.', customer: 'Kunde', quoteTitle: 'Titel', date: 'Datum',
    status: 'Status', total: 'Total', all: 'Alle',
    draft: 'Entwurf', sent: 'Gesendet', accepted: 'Angenommen',
    rejected: 'Abgelehnt', expired: 'Abgelaufen', invoiced: 'Verrechnet',
    save: 'Speichern', cancel: 'Abbrechen', delete: 'Löschen',
    addItem: 'Position hinzufügen', description: 'Beschreibung',
    quantity: 'Menge', unit: 'Einheit', price: 'Preis', discount: 'Rabatt',
    vat: 'MwSt', lineTotal: 'Total', subtotal: 'Zwischensumme',
    vatTotal: 'MwSt', grandTotal: 'Gesamttotal', validUntil: 'Gültig bis',
    notes: 'Notizen', convertToInvoice: 'In Rechnung umwandeln',
    saved: 'Gespeichert', deleted: 'Gelöscht', error: 'Fehler',
    converted: 'In Rechnung umgewandelt', detail: 'Detail',
    selectCustomer: 'Kunde wählen', paymentTerms: 'Zahlungsfrist',
  },
  en: {
    title: 'Quotations', search: 'Search...', newQuote: 'New Quote',
    number: 'No.', customer: 'Customer', quoteTitle: 'Title', date: 'Date',
    status: 'Status', total: 'Total', all: 'All',
    draft: 'Draft', sent: 'Sent', accepted: 'Accepted',
    rejected: 'Rejected', expired: 'Expired', invoiced: 'Invoiced',
    save: 'Save', cancel: 'Cancel', delete: 'Delete',
    addItem: 'Add Item', description: 'Description',
    quantity: 'Qty', unit: 'Unit', price: 'Price', discount: 'Discount',
    vat: 'VAT', lineTotal: 'Total', subtotal: 'Subtotal',
    vatTotal: 'VAT', grandTotal: 'Grand Total', validUntil: 'Valid Until',
    notes: 'Notes', convertToInvoice: 'Convert to Invoice',
    saved: 'Saved', deleted: 'Deleted', error: 'Error',
    converted: 'Converted to Invoice', detail: 'Detail',
    selectCustomer: 'Select Customer', paymentTerms: 'Payment Terms',
  },
  fr: {
    title: 'Devis', search: 'Rechercher...', newQuote: 'Nouveau devis',
    number: 'N°', customer: 'Client', quoteTitle: 'Titre', date: 'Date',
    status: 'Statut', total: 'Total', all: 'Tous',
    draft: 'Brouillon', sent: 'Envoyé', accepted: 'Accepté',
    rejected: 'Refusé', expired: 'Expiré', invoiced: 'Facturé',
    save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer',
    addItem: 'Ajouter une ligne', description: 'Description',
    quantity: 'Qté', unit: 'Unité', price: 'Prix', discount: 'Remise',
    vat: 'TVA', lineTotal: 'Total', subtotal: 'Sous-total',
    vatTotal: 'TVA', grandTotal: 'Total TTC', validUntil: 'Valide jusqu\'au',
    notes: 'Notes', convertToInvoice: 'Convertir en facture',
    saved: 'Enregistré', deleted: 'Supprimé', error: 'Erreur',
    converted: 'Converti en facture', detail: 'Détail',
    selectCustomer: 'Choisir un client', paymentTerms: 'Délai de paiement',
  },
  pt: {
    title: 'Orçamentos', search: 'Pesquisar...', newQuote: 'Novo Orçamento',
    number: 'Nº', customer: 'Cliente', quoteTitle: 'Título', date: 'Data',
    status: 'Estado', total: 'Total', all: 'Todos',
    draft: 'Rascunho', sent: 'Enviado', accepted: 'Aceite',
    rejected: 'Rejeitado', expired: 'Expirado', invoiced: 'Faturado',
    save: 'Salvar', cancel: 'Cancelar', delete: 'Excluir',
    addItem: 'Adicionar item', description: 'Descrição',
    quantity: 'Qtd', unit: 'Unidade', price: 'Preço', discount: 'Desconto',
    vat: 'IVA', lineTotal: 'Total', subtotal: 'Subtotal',
    vatTotal: 'IVA', grandTotal: 'Total Geral', validUntil: 'Válido até',
    notes: 'Notas', convertToInvoice: 'Converter em fatura',
    saved: 'Salvo', deleted: 'Excluído', error: 'Erro',
    converted: 'Convertido em fatura', detail: 'Detalhe',
    selectCustomer: 'Selecionar cliente', paymentTerms: 'Prazo de pagamento',
  },
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6b7280', SENT: '#3b82f6', ACCEPTED: '#22c55e',
  REJECTED: '#ef4444', EXPIRED: '#f59e0b', INVOICED: '#8b5cf6',
};

export function QuotationsPage() {
  const { th, isDark, lang } = useTheme();
  const { token } = useAuthStore();
  const t = T[lang] || T.de;

  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Editor
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [form, setForm] = useState<Partial<Quotation>>({});
  const [items, setItems] = useState<QuoteItem[]>([]);

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

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterStatus !== 'ALL') params.set('status', filterStatus);
      params.set('limit', '100');

      const res = await fetch(`${API}/api/v1/quotations?${params}`, { headers: headers() });
      const json = await res.json();
      setQuotes(json.data || []);
      setTotal(json.meta?.total || 0);
    } catch { showToast(t.error, true); }
    setLoading(false);
  }, [search, filterStatus, headers, t.error]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/customers?limit=200`, { headers: headers() });
      const json = await res.json();
      setCustomers(json.data || []);
    } catch {}
  }, [headers]);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);
  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // Fetch contacts when customer changes in form
  useEffect(() => {
    if (!form.customer_id) { setContacts([]); return; }
    fetch(`${API}/api/v1/contacts?customer_id=${form.customer_id}`, { headers: headers() })
      .then(r => r.json())
      .then(j => setContacts(j.data || []))
      .catch(() => {});
  }, [form.customer_id, headers]);

  const openNew = () => {
    setEditing(null);
    setForm({
      status: 'DRAFT', currency: 'CHF', payment_terms: 30,
      quote_date: new Date().toISOString().split('T')[0],
    });
    setItems([{ sort_order: 1, description: '', quantity: 1, unit: 'Std', unit_price: 0, discount_percent: 0, vat_rate: 8.1, total: 0 }]);
  };

  const openEdit = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/v1/quotations/${id}`, { headers: headers() });
      const json = await res.json();
      const q = json.data;
      setEditing(q);
      setForm(q);
      setItems(q.items || []);
    } catch { showToast(t.error, true); }
  };

  const calcItemTotal = (it: QuoteItem) => {
    return Math.round((it.quantity || 0) * (it.unit_price || 0) * (1 - (it.discount_percent || 0) / 100) * 100) / 100;
  };

  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    updated[idx].total = calcItemTotal(updated[idx]);
    setItems(updated);
  };

  const addItem = () => {
    setItems([...items, {
      sort_order: items.length + 1, description: '', quantity: 1,
      unit: 'Std', unit_price: 0, discount_percent: 0, vat_rate: 8.1, total: 0,
    }]);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sort_order: i + 1 })));
  };

  const subtotal = items.reduce((s, it) => s + calcItemTotal(it), 0);
  const vatTotal = items.reduce((s, it) => s + calcItemTotal(it) * (it.vat_rate || 0) / 100, 0);
  const grandTotal = subtotal + vatTotal;

  const saveQuote = async () => {
    try {
      const body = { ...form, items };
      const isNew = !editing;
      const url = isNew ? `${API}/api/v1/quotations` : `${API}/api/v1/quotations/${editing!.id}`;
      const res = await fetch(url, { method: isNew ? 'POST' : 'PUT', headers: headers(), body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      showToast(t.saved);
      setEditing(null);
      setForm({});
      setItems([]);
      fetchQuotes();
    } catch { showToast(t.error, true); }
  };

  const deleteQuote = async (id: string) => {
    if (!confirm('Delete?')) return;
    try {
      await fetch(`${API}/api/v1/quotations/${id}`, { method: 'DELETE', headers: headers() });
      showToast(t.deleted);
      setEditing(null);
      setForm({});
      fetchQuotes();
    } catch { showToast(t.error, true); }
  };

  const convertToInvoice = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/v1/quotations/${id}/convert-to-invoice`, { method: 'POST', headers: headers() });
      if (!res.ok) throw new Error();
      showToast(t.converted);
      fetchQuotes();
    } catch { showToast(t.error, true); }
  };

  const chf = (n?: number) => n != null ? `CHF ${n.toLocaleString('de-CH', { minimumFractionDigits: 2 })}` : '–';
  const statusLabel = (s: string) => t[s.toLowerCase()] || s;

  const inp = (ov?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 13,
    border: `1px solid ${th.border}`, background: th.bg, color: th.text,
    outline: 'none', fontFamily: "'Inter',sans-serif", ...ov,
  });

  const btn = (primary = false): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    border: primary ? 'none' : `1px solid ${th.border}`,
    background: primary ? th.gold : 'transparent',
    color: primary ? '#fff' : th.text, cursor: 'pointer',
    fontFamily: "'Inter',sans-serif",
  });

  const isEditorOpen = editing !== null || (form.status !== undefined);

  return (
    <div style={{ padding: 24, fontFamily: "'Inter','Segoe UI',sans-serif", color: th.text, minHeight: '100vh' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 24px', borderRadius: 8,
          background: toast.err ? th.toastErrBg : th.toastBg, color: toast.err ? th.toastErrText : th.toastText,
          border: `1px solid ${toast.err ? th.toastErrBorder : th.toastBorder}`, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,.3)',
        }}>{toast.msg}</div>
      )}

      {!isEditorOpen ? (
        <>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 300, letterSpacing: 2, color: th.gold, margin: 0 }}>{t.title}</h1>
              <div style={{ fontSize: 12, color: th.textDim, marginTop: 4 }}>{total} {t.title}</div>
            </div>
            <button style={btn(true)} onClick={openNew}>{t.newQuote}</button>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <input type="text" placeholder={t.search} value={search} onChange={e => setSearch(e.target.value)} style={inp({ maxWidth: 280 })} />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inp({ maxWidth: 160 })}>
              <option value="ALL">{t.all}</option>
              {['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'INVOICED'].map(s => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: th.textDim }}>⏳</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: th.bgHeader, borderBottom: `1px solid ${th.border}` }}>
                  {[t.number, t.customer, t.quoteTitle, t.date, t.status, t.total].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: th.textMuted, fontSize: 11, letterSpacing: .5, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                  <th style={{ width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {quotes.map(q => (
                  <tr key={q.id} style={{ borderBottom: `1px solid ${th.borderFaint}`, cursor: 'pointer' }}
                    onClick={() => openEdit(q.id)}
                    onMouseEnter={e => e.currentTarget.style.background = th.rowHover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: th.gold }}>{q.quote_number}</td>
                    <td style={{ padding: '10px 12px' }}>{q.customer?.name || '–'}</td>
                    <td style={{ padding: '10px 12px' }}>{q.title}</td>
                    <td style={{ padding: '10px 12px', color: th.textMuted }}>{q.quote_date}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                        background: `${STATUS_COLORS[q.status] || '#6b7280'}22`,
                        color: STATUS_COLORS[q.status] || '#6b7280',
                      }}>{statusLabel(q.status)}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{chf(q.total_gross)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {q.status === 'ACCEPTED' && (
                        <button style={{ ...btn(true), fontSize: 10, padding: '4px 8px' }}
                          onClick={e => { e.stopPropagation(); convertToInvoice(q.id); }}>
                          → {t.convertToInvoice}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : (
        /* ─── Quote Editor ─── */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 300, color: th.gold, margin: 0 }}>
              {editing ? `${editing.quote_number} – ${editing.title}` : t.newQuote}
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              {editing && <button style={{ ...btn(), color: '#ef4444' }} onClick={() => deleteQuote(editing.id)}>{t.delete}</button>}
              <button style={btn()} onClick={() => { setEditing(null); setForm({}); setItems([]); }}>{t.cancel}</button>
              <button style={btn(true)} onClick={saveQuote}>{t.save}</button>
            </div>
          </div>

          {/* Meta fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 24, background: th.bgCard, padding: 20, borderRadius: 12, border: `1px solid ${th.border}` }}>
            <div>
              <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.customer} *</label>
              <select style={inp()} value={form.customer_id || ''} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">{t.selectCustomer}</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.quoteTitle}</label>
              <input style={inp()} value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.status}</label>
              <select style={inp()} value={form.status || 'DRAFT'} onChange={e => setForm({ ...form, status: e.target.value })}>
                {['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'].map(s => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.validUntil}</label>
              <input type="date" style={inp()} value={form.valid_until || ''} onChange={e => setForm({ ...form, valid_until: e.target.value })} />
            </div>
          </div>

          {/* Line Items */}
          <div style={{ background: th.bgCard, padding: 20, borderRadius: 12, border: `1px solid ${th.border}`, marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${th.border}` }}>
                  <th style={{ textAlign: 'left', padding: 8, color: th.textMuted, fontSize: 10, width: '30%' }}>{t.description}</th>
                  <th style={{ textAlign: 'right', padding: 8, color: th.textMuted, fontSize: 10, width: 70 }}>{t.quantity}</th>
                  <th style={{ textAlign: 'center', padding: 8, color: th.textMuted, fontSize: 10, width: 60 }}>{t.unit}</th>
                  <th style={{ textAlign: 'right', padding: 8, color: th.textMuted, fontSize: 10, width: 90 }}>{t.price}</th>
                  <th style={{ textAlign: 'right', padding: 8, color: th.textMuted, fontSize: 10, width: 60 }}>{t.discount}</th>
                  <th style={{ textAlign: 'right', padding: 8, color: th.textMuted, fontSize: 10, width: 60 }}>{t.vat}</th>
                  <th style={{ textAlign: 'right', padding: 8, color: th.textMuted, fontSize: 10, width: 100 }}>{t.lineTotal}</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px solid ${th.borderFaint}` }}>
                    <td style={{ padding: 4 }}>
                      <input style={inp({ fontSize: 12 })} value={it.description} onChange={e => updateItem(idx, 'description', e.target.value)} />
                    </td>
                    <td style={{ padding: 4 }}>
                      <input type="number" step="0.5" style={inp({ textAlign: 'right', fontSize: 12 })} value={it.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td style={{ padding: 4 }}>
                      <select style={inp({ fontSize: 12, textAlign: 'center' })} value={it.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}>
                        {['Std', 'Stk', 'm²', 'm³', 'lfm', 'kg', 'Pauschal'].map(u => <option key={u}>{u}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: 4 }}>
                      <input type="number" step="0.05" style={inp({ textAlign: 'right', fontSize: 12 })} value={it.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td style={{ padding: 4 }}>
                      <input type="number" step="0.5" style={inp({ textAlign: 'right', fontSize: 12 })} value={it.discount_percent} onChange={e => updateItem(idx, 'discount_percent', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td style={{ padding: 4 }}>
                      <input type="number" step="0.1" style={inp({ textAlign: 'right', fontSize: 12 })} value={it.vat_rate} onChange={e => updateItem(idx, 'vat_rate', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>{chf(calcItemTotal(it))}</td>
                    <td style={{ padding: 4, textAlign: 'center' }}>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16 }}
                        onClick={() => removeItem(idx)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button style={{ ...btn(), marginTop: 12 }} onClick={addItem}>{t.addItem}</button>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <div style={{ width: 260 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                  <span style={{ color: th.textMuted }}>{t.subtotal}</span>
                  <span>{chf(Math.round(subtotal * 100) / 100)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                  <span style={{ color: th.textMuted }}>{t.vatTotal}</span>
                  <span>{chf(Math.round(vatTotal * 100) / 100)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 16, fontWeight: 700, borderTop: `2px solid ${th.gold}`, marginTop: 4 }}>
                  <span>{t.grandTotal}</span>
                  <span style={{ color: th.gold }}>{chf(Math.round(grandTotal * 100) / 100)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div style={{ background: th.bgCard, padding: 20, borderRadius: 12, border: `1px solid ${th.border}` }}>
            <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.notes}</label>
            <textarea style={{ ...inp(), minHeight: 80, resize: 'vertical' }} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      )}
    </div>
  );
}
