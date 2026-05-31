// frontend/src/pages/logistics/hooks/useLogisticsData.ts
import { useState, useCallback, useEffect, useMemo } from 'react';
import type { SparePart, Transaction, Alert, Stats, MarginRule, Section, Machine, Task } from '../types';

const API = import.meta.env.VITE_API_URL || '';

export function useLogisticsData(token: string | null) {
  const [section, setSection] = useState<Section>('dashboard');
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState<SparePart[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [marginRules, setMarginRules] = useState<MarginRule[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Detail state
  const [selectedPart, setSelectedPart] = useState<SparePart | null>(null);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState<string>('CONSUME');

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  /* ── Fetch helpers ── */

  const fetchParts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (categoryFilter) params.set('category', categoryFilter);
      if (stockFilter === 'low') params.set('low_stock', 'true');
      const res = await fetch(`${API}/api/v1/logistics/parts?${params}`, { headers: headers() });
      const json = await res.json();
      setParts(json.data || []);
    } catch { /* */ }
  }, [search, categoryFilter, stockFilter, headers]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/logistics/stats`, { headers: headers() });
      const json = await res.json();
      setStats(json);
    } catch { /* */ }
  }, [headers]);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/logistics/alerts`, { headers: headers() });
      const json = await res.json();
      setAlerts(json.data || []);
    } catch { /* */ }
  }, [headers]);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/logistics/transactions?limit=200`, { headers: headers() });
      const json = await res.json();
      setTransactions(json.data || []);
    } catch { /* */ }
  }, [headers]);

  const fetchRefData = useCallback(async () => {
    try {
      const [mRes, tRes] = await Promise.all([
        fetch(`${API}/api/v1/machines`, { headers: headers() }),
        fetch(`${API}/api/v1/tasks`, { headers: headers() }),
      ]);
      const mJson = await mRes.json();
      const tJson = await tRes.json();
      setMachines(mJson.data || mJson || []);
      setTasks(tJson.data || tJson || []);
    } catch { /* */ }
  }, [headers]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchParts(), fetchStats(), fetchAlerts(), fetchTransactions(), fetchRefData()]);
    setLoading(false);
  }, [fetchParts, fetchStats, fetchAlerts, fetchTransactions, fetchRefData]);

  useEffect(() => { if (token) fetchAll(); }, [token]); // eslint-disable-line

  /* ── Derived ── */
  const maintenanceParts = useMemo(() => parts.filter(p => p.part_type === 'MAINTENANCE'), [parts]);
  const consumableParts = useMemo(() => parts.filter(p => p.part_type === 'CONSUMABLE'), [parts]);

  /* ── CRUD ── */

  const savePart = useCallback(async (id: string | null, body: Record<string, unknown>) => {
    const url = id ? `${API}/api/v1/logistics/parts/${id}` : `${API}/api/v1/logistics/parts`;
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Save failed'); }
    await Promise.all([fetchParts(), fetchStats()]);
    return res.json();
  }, [headers, fetchParts, fetchStats]);

  const deletePart = useCallback(async (id: string) => {
    const res = await fetch(`${API}/api/v1/logistics/parts/${id}`, { method: 'DELETE', headers: headers() });
    if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Delete failed'); }
    setSelectedPart(null);
    await Promise.all([fetchParts(), fetchStats()]);
  }, [headers, fetchParts, fetchStats]);

  const submitTransaction = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(`${API}/api/v1/logistics/transactions`, {
      method: 'POST', headers: headers(), body: JSON.stringify(body),
    });
    if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Transaction failed'); }
    await Promise.all([fetchParts(), fetchStats(), fetchTransactions()]);
    return res.json();
  }, [headers, fetchParts, fetchStats, fetchTransactions]);

  const updateAlert = useCallback(async (id: string, status: string) => {
    await fetch(`${API}/api/v1/logistics/alerts/${id}`, {
      method: 'PUT', headers: headers(), body: JSON.stringify({ status }),
    });
    await fetchAlerts();
  }, [headers, fetchAlerts]);

  const importParts = useCallback(async (rows: Record<string, unknown>[]) => {
    const res = await fetch(`${API}/api/v1/logistics/parts/import`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ rows }),
    });
    if (!res.ok) throw new Error('Import failed');
    await fetchAll();
    return res.json();
  }, [headers, fetchAll]);

  return {
    section, setSection, loading,
    parts, maintenanceParts, consumableParts,
    transactions, alerts, stats, marginRules, machines, tasks,
    search, setSearch, categoryFilter, setCategoryFilter,
    stockFilter, setStockFilter, page, setPage, pageSize,
    selectedPart, setSelectedPart,
    txModalOpen, setTxModalOpen, txModalType, setTxModalType,
    toast, showToast,
    savePart, deletePart, submitTransaction, updateAlert, importParts,
    fetchParts, fetchAll,
  };
}

export type LogisticsData = ReturnType<typeof useLogisticsData>;