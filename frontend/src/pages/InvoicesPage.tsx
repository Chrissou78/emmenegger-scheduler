import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../contexts/themeContext';
import { useAuthStore } from '../contexts/authStore';

const API = import.meta.env.VITE_API_URL || '';

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  title: string;
  status: string;
  invoice_date: string;
  due_date?: string;
  subtotal: number;
  vat_amount: number;
  total_gross: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  customer?: { id: string; name: string; city?: string };
  items?: any[];
  payments?: any[];
}

const T: Record<string, Record<string, string>> = {
  de: {
    title: 'Rechnungen', search: 'Suchen...', number: 'Nr.', customer: 'Kunde',
    invoiceTitle: 'Titel', date: 'Datum', status: 'Status', total: 'Total',
    paid: 'Bezahlt', due: 'Offen', all: 'Alle',
    draft: 'Entwurf', sent: 'Gesendet', partiallyPaid: 'Teilweise bezahlt',
    paidStatus: 'Bezahlt', overdue: 'Überfällig', cancelled: 'Storniert',
    addPayment: 'Zahlung erfassen', amount: 'Betrag', paymentDate: 'Datum',
    method: 'Zahlungsart', reference: 'Referenz', saved: 'Gespeichert',
    deleted: 'Gelöscht', error: 'Fehler', paymentRecorded: 'Zahlung erfasst',
    bankTransfer: 'Überweisung', cash: 'Bar', creditCard: 'Kreditkarte',
    other: 'Andere', save: 'Speichern', cancel: 'Abbrechen',
  },
  en: {
    title: 'Invoices', search: 'Search...', number: 'No.', customer: 'Customer',
    invoiceTitle: 'Title', date: 'Date', status: 'Status', total: 'Total',
    paid: 'Paid', due: 'Due', all: 'All',
    draft: 'Draft', sent: 'Sent', partiallyPaid: 'Partially Paid',
    paidStatus: 'Paid', overdue: 'Overdue', cancelled: 'Cancelled',
    addPayment: 'Record Payment', amount: 'Amount', paymentDate: 'Date',
    method: 'Method', reference: 'Reference', saved: 'Saved',
    deleted: 'Deleted', error: 'Error', paymentRecorded: 'Payment recorded',
    bankTransfer: 'Bank Transfer', cash: 'Cash', creditCard: 'Credit Card',
    other: 'Other', save: 'Save', cancel: 'Cancel',
  },
  fr: {
    title: 'Factures', search: 'Rechercher...', number: 'N°', customer: 'Client',
    invoiceTitle: 'Titre', date: 'Date', status: 'Statut', total: 'Total',
    paid: 'Payé', due: 'Dû', all: 'Tous',
    draft: 'Brouillon', sent: 'Envoyé', partiallyPaid: 'Partiellement payé',
    paidStatus: 'Payé', overdue: 'En retard', cancelled: 'Annulé',
    addPayment: 'Enregistrer un paiement', amount: 'Montant', paymentDate: 'Date',
    method: 'Méthode', reference: 'Référence', saved: 'Enregistré',
    deleted: 'Supprimé', error: 'Erreur', paymentRecorded: 'Paiement enregistré',
    bankTransfer: 'Virement', cash: 'Espèces', creditCard: 'Carte de crédit',
    other: 'Autre', save: 'Enregistrer', cancel: 'Annuler',
  },
  pt: {
    title: 'Faturas', search: 'Pesquisar...', number: 'Nº', customer: 'Cliente',
    invoiceTitle: 'Título', date: 'Data', status: 'Estado', total: 'Total',
    paid: 'Pago', due: 'Em aberto', all: 'Todos',
    draft: 'Rascunho', sent: 'Enviado', partiallyPaid: 'Parcialmente pago',
    paidStatus: 'Pago', overdue: 'Vencido', cancelled: 'Cancelado',
    addPayment: 'Registar pagamento', amount: 'Montante', paymentDate: 'Data',
    method: 'Método', reference: 'Referência', saved: 'Salvo',
    deleted: 'Excluído', error: 'Erro', paymentRecorded: 'Pagamento registado',
    bankTransfer: 'Transferência', cash: 'Dinheiro', creditCard: 'Cartão',
    other: 'Outro', save: 'Salvar', cancel: 'Cancelar',
  },
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6b7280', SENT: '#3b82f6', PARTIALLY_PAID: '#f59e0b',
  PAID: '#22c55e', OVERDUE: '#ef4444', CANCELLED: '#6b7280',
};

export function InvoicesPage() {
  const { th, isDark, lang } = useTheme();
  const { token } = useAuthStore();
  const t = T[lang] || T.de;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Payment modal
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_date: '', method: 'BANK_TRANSFER', reference: '' });

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

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterStatus !== 'ALL') params.set('status', filterStatus);
      params.set('limit', '100');

      const res = await fetch(`${API}/api/v1/invoices?${params}`, { headers: headers() });
      const json = await res.json();
      setInvoices(json.data || []);
      setTotal(json.meta?.total || 0);
    } catch { showToast(t.error, true); }
    setLoading(false);
  }, [search, filterStatus, headers, t.error]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const recordPayment = async () => {
    if (!paymentInvoice) return;
    try {
      const res = await fetch(`${API}/api/v1/invoices/${paymentInvoice.id}/payments`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({
          amount: parseFloat(paymentForm.amount),
          payment_date: paymentForm.payment_date || new Date().toISOString().split('T')[0],
          method: paymentForm.method,
          reference: paymentForm.reference,
        }),
      });
      if (!res.ok) throw new Error();
      showToast(t.paymentRecorded);
      setPaymentInvoice(null);
      setPaymentForm({ amount: '', payment_date: '', method: 'BANK_TRANSFER', reference: '' });
      fetchInvoices();
    } catch { showToast(t.error, true); }
  };

  const chf = (n?: number) => n != null ? `CHF ${n.toLocaleString('de-CH', { minimumFractionDigits: 2 })}` : '–';
  const statusLabel = (s: string) => {
    const key = s.toLowerCase().replace('_', '');
    if (s === 'PARTIALLY_PAID') return t.partiallyPaid;
    if (s === 'PAID') return t.paidStatus;
    return t[key] || s;
  };

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

  // Summary stats
  const totalAmount = invoices.reduce((s, i) => s + (i.total_gross || 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + (i.amount_paid || 0), 0);
  const totalDue = invoices.reduce((s, i) => s + (i.amount_due || 0), 0);

  return (
    <div style={{ padding: 24, fontFamily: "'Inter','Segoe UI',sans-serif", color: th.text, minHeight: '100vh' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 24px', borderRadius: 8,
          background: toast.err ? th.toastErrBg : th.toastBg, color: toast.err ? th.toastErrText : th.toastText,
          border: `1px solid ${toast.err ? th.toastErrBorder : th.toastBorder}`, fontSize: 13, fontWeight: 600,
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 300, letterSpacing: 2, color: th.gold, margin: 0 }}>{t.title}</h1>
          <div style={{ fontSize: 12, color: th.textDim, marginTop: 4 }}>{total} {t.title}</div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {[
          { label: t.total, value: chf(totalAmount), color: th.text },
          { label: t.paid, value: chf(totalPaid), color: '#22c55e' },
          { label: t.due, value: chf(totalDue), color: totalDue > 0 ? '#f59e0b' : th.textDim },
        ].map(s => (
          <div key={s.label} style={{
            padding: '12px 20px', borderRadius: 10, background: th.bgCard,
            border: `1px solid ${th.border}`, flex: 1,
          }}>
            <div style={{ fontSize: 10, color: th.textDim, textTransform: 'uppercase', letterSpacing: .5 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input type="text" placeholder={t.search} value={search} onChange={e => setSearch(e.target.value)} style={inp({ maxWidth: 280 })} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inp({ maxWidth: 160 })}>
          <option value="ALL">{t.all}</option>
          {['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'].map(s => (
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
              {[t.number, t.customer, t.invoiceTitle, t.date, t.status, t.total, t.paid, t.due].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: th.textMuted, fontSize: 11, letterSpacing: .5, textTransform: 'uppercase' }}>{h}</th>
              ))}
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} style={{ borderBottom: `1px solid ${th.borderFaint}` }}
                onMouseEnter={e => e.currentTarget.style.background = th.rowHover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 12px', fontWeight: 600, color: th.gold }}>{inv.invoice_number}</td>
                <td style={{ padding: '10px 12px' }}>{inv.customer?.name || '–'}</td>
                <td style={{ padding: '10px 12px' }}>{inv.title}</td>
                <td style={{ padding: '10px 12px', color: th.textMuted }}>{inv.invoice_date}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                    background: `${STATUS_COLORS[inv.status] || '#6b7280'}22`,
                    color: STATUS_COLORS[inv.status] || '#6b7280',
                  }}>{statusLabel(inv.status)}</span>
                </td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{chf(inv.total_gross)}</td>
                <td style={{ padding: '10px 12px', color: '#22c55e' }}>{chf(inv.amount_paid)}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: (inv.amount_due || 0) > 0 ? '#f59e0b' : th.textDim }}>{chf(inv.amount_due)}</td>
                <td style={{ padding: '10px 12px' }}>
                  {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                    <button style={{ ...btn(true), fontSize: 10, padding: '4px 8px' }}
                      onClick={() => {
                        setPaymentInvoice(inv);
                        setPaymentForm({ amount: String(inv.amount_due || 0), payment_date: new Date().toISOString().split('T')[0], method: 'BANK_TRANSFER', reference: '' });
                      }}>{t.addPayment}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Payment Modal */}
      {paymentInvoice && (
        <div style={{
          position: 'fixed', inset: 0, background: th.modalBg, display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }} onClick={() => setPaymentInvoice(null)}>
          <div style={{
            background: th.modalCard, borderRadius: 16, padding: 28, width: 420,
            border: `1px solid ${th.border}`, boxShadow: '0 20px 60px rgba(0,0,0,.4)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, color: th.gold }}>
              {t.addPayment} – {paymentInvoice.invoice_number}
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 13 }}>
              <span style={{ color: th.textMuted }}>{t.total}: {chf(paymentInvoice.total_gross)}</span>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>{t.due}: {chf(paymentInvoice.amount_due)}</span>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.amount} *</label>
                <input type="number" step="0.01" style={inp()} value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.paymentDate}</label>
                <input type="date" style={inp()} value={paymentForm.payment_date} onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.method}</label>
                <select style={inp()} value={paymentForm.method} onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}>
                  <option value="BANK_TRANSFER">{t.bankTransfer}</option>
                  <option value="CASH">{t.cash}</option>
                  <option value="CREDIT_CARD">{t.creditCard}</option>
                  <option value="OTHER">{t.other}</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: th.textDim, display: 'block', marginBottom: 4 }}>{t.reference}</label>
                <input style={inp()} value={paymentForm.reference} onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button style={btn()} onClick={() => setPaymentInvoice(null)}>{t.cancel}</button>
              <button style={btn(true)} onClick={recordPayment}>{t.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
