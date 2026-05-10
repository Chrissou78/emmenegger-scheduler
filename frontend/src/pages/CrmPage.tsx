import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from '../contexts/themeContext';
import { useAuthStore } from '../contexts/authStore';
import { getTranslations, type LangCode } from '../i18n';

const API = import.meta.env.VITE_API_URL ?? '';

/* ── Types ── */
interface CrmCustomer {
  id: string;
  name: string;
  city?: string;
  email?: string;
  phone?: string;
  sales?: { id: string; first_name: string; last_name: string } | null;
  team_leader?: { id: string; first_name: string; last_name: string } | null;
  sales_id?: string;
  team_leader_id?: string;
}

interface Activity {
  id: string;
  customer_id: string;
  user_id: string;
  type: string;
  subject: string;
  description?: string;
  activity_date: string;
  duration_minutes?: number;
  outcome?: string;
  next_action?: string;
  next_action_date?: string;
  is_completed: boolean;
  customers?: { id: string; name: string };
}

interface Opportunity {
  id: string;
  customer_id: string;
  sales_id: string;
  title: string;
  description?: string;
  stage: string;
  estimated_value: number;
  probability: number;
  expected_close_date?: string;
  actual_close_date?: string;
  lost_reason?: string;
  customers?: { id: string; name: string };
}

interface Dashboard {
  customerCount: number;
  openOpportunities: number;
  pipelineValue: number;
  weightedValue: number;
  wonThisMonth: number;
  upcomingFollowUps: Activity[];
}

interface Performance {
  period_month: string;
  revenue: number;
  hours_worked: number;
  tasks_completed: number;
  tasks_total: number;
  margin_percent: number | null;
}

type CrmTab = 'dashboard' | 'customers' | 'activities' | 'pipeline' | 'performance';

const ACTIVITY_TYPES = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'VISIT', 'OFFER_SENT', 'FOLLOW_UP'];
const OUTCOMES = ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'NO_ANSWER', 'CALLBACK'];
const STAGES = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
const STAGE_COLORS: Record<string, string> = {
  LEAD: '#6b7280', QUALIFIED: '#3b82f6', PROPOSAL: '#f59e0b',
  NEGOTIATION: '#8b5cf6', WON: '#22c55e', LOST: '#ef4444',
};

export default function CrmPage() {
  const { th, isDark, lang } = useTheme();
  const { token, user } = useAuthStore();
  const t: any = getTranslations(lang as LangCode);
  const gold = th.gold;
  const dimText = isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.4)';

  const [tab, setTab] = useState<CrmTab>('dashboard');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const hasFetched = useRef(false);

  // Data
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  // Performance
  const [perfCustomerId, setPerfCustomerId] = useState<string | null>(null);
  const [perfData, setPerfData] = useState<Performance[]>([]);
  const [perfOpps, setPerfOpps] = useState<any>(null);

  // Modals
  const [activityModal, setActivityModal] = useState(false);
  const [oppModal, setOppModal] = useState(false);
  const [assignModal, setAssignModal] = useState<string | null>(null);
  const [actForm, setActForm] = useState<any>({});
  const [oppForm, setOppForm] = useState<any>({});
  const [assignForm, setAssignForm] = useState<{ sales_id: string; team_leader_id: string }>({ sales_id: '', team_leader_id: '',});

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const hdrs = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  /* ── Fetchers ── */
  const fetchDashboard = async () => {
    try {
      const r = await fetch(`${API}/api/v1/crm/dashboard`, { headers: hdrs() });
      if (!r.ok) return;
      setDashboard(await r.json());
    } catch { /* */ }
  };

  const fetchCustomers = async () => {
    try {
      const r = await fetch(`${API}/api/v1/crm/customers${search ? `?search=${search}` : ''}`, { headers: hdrs() });
      if (!r.ok) return;
      const j = await r.json();
      setCustomers(j.data ?? j ?? []);
    } catch { /* */ }
  };

  const fetchActivities = async (customerId?: string) => {
    try {
      const params = customerId ? `?customer_id=${customerId}` : '';
      const r = await fetch(`${API}/api/v1/crm/activities${params}`, { headers: hdrs() });
      if (!r.ok) return;
      const j = await r.json();
      setActivities(j.data ?? j ?? []);
    } catch { /* */ }
  };

  const fetchOpportunities = async () => {
    try {
      const r = await fetch(`${API}/api/v1/crm/opportunities`, { headers: hdrs() });
      if (!r.ok) return;
      const j = await r.json();
      setOpportunities(j.data ?? j ?? []);
    } catch { /* */ }
  };

  const fetchPerformance = async (customerId: string) => {
    try {
      const r = await fetch(`${API}/api/v1/crm/performance/${customerId}`, { headers: hdrs() });
      if (!r.ok) return;
      const j = await r.json();
      setPerfData(j.performance ?? []);
      setPerfOpps(j.opportunities ?? null);
    } catch { /* */ }
  };

  const fetchUsers = async () => {
    try {
      const r = await fetch(`${API}/api/v1/users?limit=500`, { headers: hdrs() });
      if (!r.ok) return;
      const j = await r.json();
      setAllUsers(j.data ?? j.items ?? j ?? []);
    } catch { /* */ }
  };

  // Mount once
  useEffect(() => {
    if (!token) return; 
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchDashboard();
    fetchCustomers();
    fetchActivities();
    fetchOpportunities();
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Re-fetch customers on search change (debounced)
  useEffect(() => {
    if (!token) return; 
    const t = setTimeout(() => fetchCustomers(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  /* ── Sales & TL lists ── */
  const salesUsers = useMemo(() =>
    allUsers.filter(u => (u.role || '').toUpperCase() === 'SALES'),
    [allUsers]
  );
  const teamLeaders = useMemo(() =>
    allUsers.filter(u => ['MANAGER', 'LOCAL_MANAGER'].includes((u.role || '').toUpperCase())),
    [allUsers]
  );

  /* ── Save handlers ── */
  const saveActivity = async () => {
    try {
      const method = actForm.id ? 'PUT' : 'POST';
      const url = actForm.id
        ? `${API}/api/v1/crm/activities/${actForm.id}`
        : `${API}/api/v1/crm/activities`;
      const r = await fetch(url, { method, headers: hdrs(), body: JSON.stringify(actForm) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      showToast(t.saved ?? 'Saved');
      setActivityModal(false);
      fetchActivities();
      fetchDashboard();
    } catch (e: any) {
      showToast(e.message, false);
    }
  };

  const saveOpportunity = async () => {
    try {
      const method = oppForm.id ? 'PUT' : 'POST';
      const url = oppForm.id
        ? `${API}/api/v1/crm/opportunities/${oppForm.id}`
        : `${API}/api/v1/crm/opportunities`;
      const r = await fetch(url, { method, headers: hdrs(), body: JSON.stringify(oppForm) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      showToast(t.saved ?? 'Saved');
      setOppModal(false);
      fetchOpportunities();
      fetchDashboard();
    } catch (e: any) {
      showToast(e.message, false);
    }
  };

  const saveAssignment = async () => {
    if (!assignModal) return;
    try {
      const r = await fetch(`${API}/api/v1/crm/customers/${assignModal}/assign`, {
        method: 'PUT', headers: hdrs(), body: JSON.stringify(assignForm),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      showToast(t.saved ?? 'Saved');
      setAssignModal(null);
      fetchCustomers();
    } catch (e: any) {
      showToast(e.message, false);
    }
  };

  /* ── Styles ── */
  const sTab = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px', borderRadius: '10px 10px 0 0', cursor: 'pointer',
    fontWeight: 600, fontSize: 14, border: 'none',
    background: active ? gold : 'transparent', color: active ? '#fff' : th.text,
  });
  const sCard: React.CSSProperties = {
    background: isDark ? '#1e1e3a' : '#fff', borderRadius: 14,
    border: `1px solid ${th.border}`, padding: 20, marginBottom: 16,
  };
  const sKpi: React.CSSProperties = {
    ...sCard, textAlign: 'center', flex: 1, minWidth: 160,
  };
  const sBtn = (bg: string): React.CSSProperties => ({
    padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontWeight: 600, color: '#fff', background: bg, fontSize: 14,
  });
  const sInput: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${th.border}`, background: isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.04)',
    color: th.text, fontSize: 14, boxSizing: 'border-box',
  };
  const sOverlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const sModal: React.CSSProperties = {
    background: isDark ? '#1e1e3a' : '#fff', color: th.text, borderRadius: 12,
    padding: 24, width: '90%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto',
    border: `1px solid ${th.border}`,
  };
  const sTh: React.CSSProperties = {
    textAlign: 'left', padding: '10px 12px', fontSize: 12, color: dimText,
    borderBottom: `2px solid ${th.border}`, fontWeight: 700,
  };
  const sTd: React.CSSProperties = {
    padding: '8px 12px', fontSize: 14, borderBottom: `1px solid ${th.border}`,
  };

  const fmt = (n: number) => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(n);

  /* ════════════════════════════════════════════════════════════════ */
  /*  RENDER                                                         */
  /* ════════════════════════════════════════════════════════════════ */

  return (
    <div style={{ padding: 24, color: th.text, minHeight: '100vh' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 2000, padding: '12px 24px',
          borderRadius: 8, color: '#fff', background: toast.ok ? '#22c55e' : '#ef4444', fontWeight: 600,
        }}>{toast.msg}</div>
      )}

      <h1 style={{ margin: '0 0 20px', color: gold }}>CRM</h1>

      <div style={{ display: 'flex', gap: 4, marginBottom: 0, flexWrap: 'wrap' }}>
        {([
          ['dashboard', t.crmDashboard ?? 'Dashboard'],
          ['customers', t.crmMyCustomers ?? 'My Customers'],
          ['activities', t.crmActivities ?? 'Activities'],
          ['pipeline', t.crmPipeline ?? 'Pipeline'],
          ['performance', t.crmPerformance ?? 'Performance'],
        ] as [CrmTab, string][]).map(([k, label]) => (
          <button key={k} style={sTab(tab === k)} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      <div style={{ borderTop: `2px solid ${gold}`, paddingTop: 20 }}>

        {/* ─── DASHBOARD ─── */}
        {tab === 'dashboard' && dashboard && (
          <>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
              <div style={sKpi}>
                <div style={{ fontSize: 28, fontWeight: 800, color: gold }}>{dashboard.customerCount}</div>
                <div style={{ fontSize: 13, color: dimText }}>{t.crmCustomers ?? 'Customers'}</div>
              </div>
              <div style={sKpi}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#3b82f6' }}>{dashboard.openOpportunities}</div>
                <div style={{ fontSize: 13, color: dimText }}>{t.crmOpenOpps ?? 'Open Opportunities'}</div>
              </div>
              <div style={sKpi}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#8b5cf6' }}>{fmt(dashboard.pipelineValue)}</div>
                <div style={{ fontSize: 13, color: dimText }}>{t.crmPipelineValue ?? 'Pipeline Value'}</div>
              </div>
              <div style={sKpi}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>{fmt(dashboard.weightedValue)}</div>
                <div style={{ fontSize: 13, color: dimText }}>{t.crmWeighted ?? 'Weighted Value'}</div>
              </div>
              <div style={sKpi}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#22c55e' }}>{fmt(dashboard.wonThisMonth)}</div>
                <div style={{ fontSize: 13, color: dimText }}>{t.crmWonThisMonth ?? 'Won This Month'}</div>
              </div>
            </div>

            {/* Follow-ups */}
            <div style={sCard}>
              <h3 style={{ margin: '0 0 12px', color: gold }}>{t.crmUpcomingFollowUps ?? 'Upcoming Follow-Ups'}</h3>
              {dashboard.upcomingFollowUps.length === 0 && (
                <p style={{ color: dimText }}>{t.crmNoFollowUps ?? 'No upcoming follow-ups'}</p>
              )}
              {dashboard.upcomingFollowUps.map(a => (
                <div key={a.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: `1px solid ${th.border}`,
                }}>
                  <div>
                    <strong>{a.customers?.name}</strong> — {a.subject}
                    {a.next_action && <span style={{ color: dimText, marginLeft: 8 }}>→ {a.next_action}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: dimText, whiteSpace: 'nowrap' }}>
                    {a.next_action_date}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ─── CUSTOMERS ─── */}
        {tab === 'customers' && (
          <>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                style={{ ...sInput, maxWidth: 300 }}
                placeholder={t.search ?? 'Search...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={sTh}>{t.customerName ?? 'Customer'}</th>
                  <th style={sTh}>{t.city ?? 'City'}</th>
                  <th style={sTh}>{t.salesRep ?? 'Sales Rep'}</th>
                  <th style={sTh}>{t.teamLeader ?? 'Team Leader'}</th>
                  <th style={sTh}></th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 && (
                  <tr><td colSpan={5} style={{ ...sTd, textAlign: 'center', color: dimText }}>
                    {t.noResults ?? 'No results'}
                  </td></tr>
                )}
                {customers.map(c => (
                  <tr key={c.id}>
                    <td style={{ ...sTd, fontWeight: 700 }}>{c.name}</td>
                    <td style={sTd}>{c.city || '—'}</td>
                    <td style={sTd}>
                      {c.sales ? `${c.sales.first_name} ${c.sales.last_name}` : <span style={{ color: dimText }}>—</span>}
                    </td>
                    <td style={sTd}>
                      {c.team_leader ? `${c.team_leader.first_name} ${c.team_leader.last_name}` : <span style={{ color: dimText }}>—</span>}
                    </td>
                    <td style={{ ...sTd, display: 'flex', gap: 6 }}>
                      <button style={{ ...sBtn(gold), padding: '4px 12px', fontSize: 12 }}
                        onClick={() => {
                          setAssignForm({
                            sales_id: c.sales_id || c.sales?.id || '',
                            team_leader_id: c.team_leader_id || c.team_leader?.id || '',
                          });
                          setAssignModal(c.id);
                        }}>
                        {t.assign ?? 'Assign'}
                      </button>
                      <button style={{ ...sBtn('#3b82f6'), padding: '4px 12px', fontSize: 12 }}
                        onClick={() => {
                          setPerfCustomerId(c.id);
                          fetchPerformance(c.id);
                          setTab('performance');
                        }}>
                        {t.crmPerformance ?? 'Performance'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ─── ACTIVITIES ─── */}
        {tab === 'activities' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ margin: 0, color: gold }}>{t.crmActivities ?? 'Activities'}</h2>
              <button style={sBtn(gold)} onClick={() => {
                setActForm({ customer_id: '', type: 'CALL', subject: '', description: '', activity_date: new Date().toISOString().slice(0, 16) });
                setActivityModal(true);
              }}>+ {t.crmNewActivity ?? 'New Activity'}</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={sTh}>{t.date ?? 'Date'}</th>
                  <th style={sTh}>{t.type ?? 'Type'}</th>
                  <th style={sTh}>{t.customer ?? 'Customer'}</th>
                  <th style={sTh}>{t.subject ?? 'Subject'}</th>
                  <th style={sTh}>{t.outcome ?? 'Outcome'}</th>
                  <th style={sTh}>{t.nextAction ?? 'Next Action'}</th>
                  <th style={sTh}></th>
                </tr>
              </thead>
              <tbody>
                {activities.map(a => (
                  <tr key={a.id}>
                    <td style={sTd}>{new Date(a.activity_date).toLocaleDateString('de-CH')}</td>
                    <td style={sTd}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                        background: gold + '22', color: gold,
                      }}>{a.type}</span>
                    </td>
                    <td style={sTd}>{a.customers?.name || '—'}</td>
                    <td style={sTd}>{a.subject}</td>
                    <td style={sTd}>{a.outcome || '—'}</td>
                    <td style={sTd}>
                      {a.next_action && <span>{a.next_action} {a.next_action_date && `(${a.next_action_date})`}</span>}
                    </td>
                    <td style={sTd}>
                      <button style={{ ...sBtn('#3b82f6'), padding: '4px 10px', fontSize: 12 }}
                        onClick={() => { setActForm(a); setActivityModal(true); }}>
                        {t.edit ?? 'Edit'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ─── PIPELINE ─── */}
        {tab === 'pipeline' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ margin: 0, color: gold }}>{t.crmPipeline ?? 'Pipeline'}</h2>
              <button style={sBtn(gold)} onClick={() => {
                setOppForm({ customer_id: '', title: '', stage: 'LEAD', estimated_value: 0, probability: 10 });
                setOppModal(true);
              }}>+ {t.crmNewOpp ?? 'New Opportunity'}</button>
            </div>
            {/* Kanban-style stage columns */}
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
              {STAGES.map(stage => {
                const stageOpps = opportunities.filter(o => o.stage === stage);
                const stageTotal = stageOpps.reduce((s, o) => s + Number(o.estimated_value || 0), 0);
                return (
                  <div key={stage} style={{
                    minWidth: 220, flex: 1, background: isDark ? '#1a1a35' : '#f9fafb',
                    borderRadius: 12, padding: 12, border: `1px solid ${th.border}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                        background: STAGE_COLORS[stage] + '22', color: STAGE_COLORS[stage],
                      }}>{stage}</span>
                      <span style={{ fontSize: 12, color: dimText }}>{fmt(stageTotal)}</span>
                    </div>
                    {stageOpps.map(o => (
                      <div key={o.id} style={{
                        ...sCard, padding: 12, marginBottom: 8, cursor: 'pointer',
                      }} onClick={() => { setOppForm(o); setOppModal(true); }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{o.title}</div>
                        <div style={{ fontSize: 12, color: dimText }}>{o.customers?.name}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                          <span style={{ fontWeight: 700, color: gold }}>{fmt(o.estimated_value)}</span>
                          <span style={{ fontSize: 12, color: dimText }}>{o.probability}%</span>
                        </div>
                      </div>
                    ))}
                    {stageOpps.length === 0 && (
                      <p style={{ fontSize: 12, color: dimText, textAlign: 'center' }}>—</p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ─── PERFORMANCE ─── */}
        {tab === 'performance' && (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, color: gold }}>{t.crmPerformance ?? 'Customer Performance'}</h2>
              <select style={{ ...sInput, maxWidth: 300 }} value={perfCustomerId || ''}
                onChange={e => {
                  setPerfCustomerId(e.target.value);
                  if (e.target.value) fetchPerformance(e.target.value);
                }}>
                <option value="">{t.selectCustomer ?? 'Select customer...'}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {perfCustomerId && perfOpps && (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div style={sKpi}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#22c55e' }}>{perfOpps.won}</div>
                  <div style={{ fontSize: 12, color: dimText }}>{t.crmWon ?? 'Won'}</div>
                </div>
                <div style={sKpi}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444' }}>{perfOpps.lost}</div>
                  <div style={{ fontSize: 12, color: dimText }}>{t.crmLost ?? 'Lost'}</div>
                </div>
                <div style={sKpi}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6' }}>{perfOpps.open}</div>
                  <div style={{ fontSize: 12, color: dimText }}>{t.crmOpen ?? 'Open'}</div>
                </div>
                <div style={sKpi}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: gold }}>{fmt(perfOpps.wonValue)}</div>
                  <div style={{ fontSize: 12, color: dimText }}>{t.crmTotalRevenue ?? 'Total Revenue'}</div>
                </div>
              </div>
            )}

            {perfData.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={sTh}>{t.month ?? 'Month'}</th>
                    <th style={sTh}>{t.revenue ?? 'Revenue'}</th>
                    <th style={sTh}>{t.hours ?? 'Hours'}</th>
                    <th style={sTh}>{t.tasksCompleted ?? 'Tasks'}</th>
                    <th style={sTh}>{t.margin ?? 'Margin %'}</th>
                  </tr>
                </thead>
                <tbody>
                  {perfData.map(p => (
                    <tr key={p.period_month}>
                      <td style={sTd}>{new Date(p.period_month).toLocaleDateString('de-CH', { year: 'numeric', month: 'short' })}</td>
                      <td style={sTd}>{fmt(p.revenue)}</td>
                      <td style={sTd}>{p.hours_worked}</td>
                      <td style={sTd}>{p.tasks_completed}/{p.tasks_total}</td>
                      <td style={sTd}>{p.margin_percent != null ? `${p.margin_percent}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {perfCustomerId && perfData.length === 0 && (
              <p style={{ color: dimText }}>{t.crmNoPerformanceData ?? 'No performance data yet'}</p>
            )}
          </>
        )}
      </div>

      {/* ═══════ ACTIVITY MODAL ═══════ */}
      {activityModal && (
        <div style={sOverlay} onClick={() => setActivityModal(false)}>
          <div style={sModal} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: gold, margin: '0 0 16px' }}>
              {actForm.id ? t.editActivity ?? 'Edit Activity' : t.crmNewActivity ?? 'New Activity'}
            </h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <select style={sInput} value={actForm.customer_id || ''} onChange={e => setActForm({ ...actForm, customer_id: e.target.value })}>
                <option value="">{t.selectCustomer ?? 'Select customer...'}</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select style={sInput} value={actForm.type || 'CALL'} onChange={e => setActForm({ ...actForm, type: e.target.value })}>
                {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input style={sInput} placeholder={t.subject ?? 'Subject'} value={actForm.subject || ''} onChange={e => setActForm({ ...actForm, subject: e.target.value })} />
              <textarea style={{ ...sInput, minHeight: 80 }} placeholder={t.description ?? 'Description'} value={actForm.description || ''} onChange={e => setActForm({ ...actForm, description: e.target.value })} />
              <input style={sInput} type="datetime-local" value={actForm.activity_date?.slice(0, 16) || ''} onChange={e => setActForm({ ...actForm, activity_date: e.target.value })} />
              <select style={sInput} value={actForm.outcome || ''} onChange={e => setActForm({ ...actForm, outcome: e.target.value })}>
                <option value="">{t.selectOutcome ?? 'Outcome...'}</option>
                {OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <input style={sInput} placeholder={t.nextAction ?? 'Next action...'} value={actForm.next_action || ''} onChange={e => setActForm({ ...actForm, next_action: e.target.value })} />
              <input style={sInput} type="date" value={actForm.next_action_date || ''} onChange={e => setActForm({ ...actForm, next_action_date: e.target.value })} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={actForm.is_completed || false} onChange={e => setActForm({ ...actForm, is_completed: e.target.checked })} />
                {t.completed ?? 'Completed'}
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={{ ...sBtn('transparent'), color: th.text, border: `1px solid ${th.border}` }} onClick={() => setActivityModal(false)}>{t.cancel ?? 'Cancel'}</button>
              <button style={sBtn(gold)} onClick={saveActivity}>{t.save ?? 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ OPPORTUNITY MODAL ═══════ */}
      {oppModal && (
        <div style={sOverlay} onClick={() => setOppModal(false)}>
          <div style={sModal} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: gold, margin: '0 0 16px' }}>
              {oppForm.id ? t.editOpportunity ?? 'Edit Opportunity' : t.crmNewOpp ?? 'New Opportunity'}
            </h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <select style={sInput} value={oppForm.customer_id || ''} onChange={e => setOppForm({ ...oppForm, customer_id: e.target.value })}>
                <option value="">{t.selectCustomer ?? 'Select customer...'}</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input style={sInput} placeholder={t.title ?? 'Title'} value={oppForm.title || ''} onChange={e => setOppForm({ ...oppForm, title: e.target.value })} />
              <textarea style={{ ...sInput, minHeight: 60 }} placeholder={t.description ?? 'Description'} value={oppForm.description || ''} onChange={e => setOppForm({ ...oppForm, description: e.target.value })} />
              <select style={sInput} value={oppForm.stage || 'LEAD'} onChange={e => setOppForm({ ...oppForm, stage: e.target.value })}>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: dimText }}>{t.estimatedValue ?? 'Value (CHF)'}</label>
                  <input style={sInput} type="number" value={oppForm.estimated_value || 0} onChange={e => setOppForm({ ...oppForm, estimated_value: Number(e.target.value) })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: dimText }}>{t.probability ?? 'Probability %'}</label>
                  <input style={sInput} type="number" min={0} max={100} value={oppForm.probability || 0} onChange={e => setOppForm({ ...oppForm, probability: Number(e.target.value) })} />
                </div>
              </div>
              <input style={sInput} type="date" value={oppForm.expected_close_date || ''} onChange={e => setOppForm({ ...oppForm, expected_close_date: e.target.value })} />
              {oppForm.stage === 'LOST' && (
                <textarea style={{ ...sInput, minHeight: 60 }} placeholder={t.lostReason ?? 'Lost reason...'} value={oppForm.lost_reason || ''} onChange={e => setOppForm({ ...oppForm, lost_reason: e.target.value })} />
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={{ ...sBtn('transparent'), color: th.text, border: `1px solid ${th.border}` }} onClick={() => setOppModal(false)}>{t.cancel ?? 'Cancel'}</button>
              <button style={sBtn(gold)} onClick={saveOpportunity}>{t.save ?? 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ ASSIGN MODAL ═══════ */}
      {assignModal && (
        <div style={sOverlay} onClick={() => setAssignModal(null)}>
          <div style={{ ...sModal, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: gold, margin: '0 0 16px' }}>{t.assignCustomer ?? 'Assign Customer'}</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: dimText }}>{t.salesRep ?? 'Sales Rep'}</label>
                <select style={sInput} value={assignForm.sales_id} onChange={e => setAssignForm({ ...assignForm, sales_id: e.target.value })}>
                  <option value="">— {t.none ?? 'None'} —</option>
                  {salesUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: dimText }}>{t.teamLeader ?? 'Team Leader'}</label>
                <select style={sInput} value={assignForm.team_leader_id} onChange={e => setAssignForm({ ...assignForm, team_leader_id: e.target.value })}>
                  <option value="">— {t.none ?? 'None'} —</option>
                  {teamLeaders.map(u => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={{ ...sBtn('transparent'), color: th.text, border: `1px solid ${th.border}` }} onClick={() => setAssignModal(null)}>{t.cancel ?? 'Cancel'}</button>
              <button style={sBtn(gold)} onClick={saveAssignment}>{t.save ?? 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
