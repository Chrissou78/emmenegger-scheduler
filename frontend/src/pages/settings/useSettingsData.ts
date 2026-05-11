// frontend/src/pages/settings/useSettingsData.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '../../contexts/authStore';
import { useTheme } from '../../contexts/themeContext';
import type { LangCode } from '../../i18n';
import type {
  RoleConfig, ConfigItem, CompanyInfo, VatRate, CrossBorderCountry,
  HierarchyUser, HierarchyEdit, ConfigCategory,
} from './types';
import { EMPTY_COMPANY } from './types';

const API = import.meta.env.VITE_API_URL ?? '';

export function useSettingsData() {
  const { token } = useAuthStore();
  const {
    enabledLangs, setEnabledLangs,
    defaultLang, setDefaultLang, setLanguage, lang,
  } = useTheme();

  /* ── Toast ── */
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const hdrs = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  /* ── Roles ── */
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const fetchRoles = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/settings/roles`, { headers: hdrs() });
      if (!r.ok) return;
      const j = await r.json();
      setRoles(j.data ?? j ?? []);
    } catch { /* ignore */ }
  }, [hdrs]);

  /* ── Config ── */
  const [configItems, setConfigItems] = useState<ConfigItem[]>([]);
  const [configCategory, setConfigCategory] = useState<ConfigCategory>('contract_types');

  const fetchConfigItems = useCallback(async (cat?: ConfigCategory) => {
    const category = cat ?? configCategory;
    try {
      const r = await fetch(`${API}/api/v1/settings/config/${category}`, { headers: hdrs() });
      if (!r.ok) return;
      const j = await r.json();
      setConfigItems(j.data ?? j ?? []);
    } catch { /* ignore */ }
  }, [hdrs, configCategory]);

  /* ── Company ── */
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(EMPTY_COMPANY);
  const [companyForm, setCompanyForm] = useState<CompanyInfo>(EMPTY_COMPANY);

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/settings/company`, { headers: hdrs() });
      if (!r.ok) return;
      const j = await r.json();
      const data = j.data ?? j;
      setCompanyInfo(data);
      setCompanyForm(data);
    } catch { /* ignore */ }
  }, [hdrs]);

  /* ── VAT ── */
  const [vatRates, setVatRates] = useState<VatRate[]>([]);
  const fetchVatRates = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/settings/vat-rates`, { headers: hdrs() });
      if (!r.ok) return;
      const j = await r.json();
      setVatRates(j.data ?? j ?? []);
    } catch { /* ignore */ }
  }, [hdrs]);

  /* ── Cross-Border ── */
  const [crossBorderCountries, setCrossBorderCountries] = useState<CrossBorderCountry[]>([]);
  const fetchCrossBorderCountries = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/settings/cross-border`, { headers: hdrs() });
      if (!r.ok) return;
      const j = await r.json();
      setCrossBorderCountries(j.data ?? j ?? []);
    } catch { /* ignore */ }
  }, [hdrs]);

  /* ── Hierarchy ── */
  const [hUsers, setHUsers] = useState<HierarchyUser[]>([]);
  const [hLoading, setHLoading] = useState(false);
  const [hEditMap, setHEditMap] = useState<Record<string, HierarchyEdit>>({});
  const [hDirty, setHDirty] = useState(false);

  const fetchHierarchyUsers = useCallback(async () => {
    setHLoading(true);
    try {
      const r = await fetch(`${API}/api/v1/users?limit=500`, { headers: hdrs() });
      if (!r.ok) { setHLoading(false); return; }
      const j = await r.json();
      const list: HierarchyUser[] = (j.data ?? j.items ?? j ?? []).map(
        (u: Record<string, unknown>) => ({
          id: u.id as string,
          first_name: u.first_name as string,
          last_name: u.last_name as string,
          email: u.email as string,
          role: u.role as string,
          departments: (u.departments as string[]) ?? [],
          team_leader_id: (u.team_leader_id as string | null) ?? null,
          executive_id: (u.executive_id as string | null) ?? null,
          ceo_id: (u.ceo_id as string | null) ?? null,
        })
      );
      setHUsers(list);
      const map: Record<string, HierarchyEdit> = {};
      list.forEach(u => {
        map[u.id] = {
          team_leader_id: u.team_leader_id,
          executive_id: u.executive_id,
          ceo_id: u.ceo_id,
          departments: [...u.departments],
        };
      });
      setHEditMap(map);
      setHDirty(false);
    } catch { /* ignore */ }
    finally { setHLoading(false); }
  }, [hdrs]);

  /* ── Hierarchy save — ★ NOW INCLUDES departments ── */
  const saveHierarchy = useCallback(async (t: Record<string, string>) => {
    setSaving(true);
    try {
      const updates = hUsers
        .filter(u => {
          const e = hEditMap[u.id];
          if (!e) return false;
          return (
            e.team_leader_id !== u.team_leader_id ||
            e.executive_id !== u.executive_id ||
            e.ceo_id !== u.ceo_id ||
            JSON.stringify(e.departments ?? []) !== JSON.stringify(u.departments)
          );
        })
        .map(u => ({ id: u.id, ...hEditMap[u.id] }));

      for (const upd of updates) {
        const body: Record<string, unknown> = {
          team_leader_id: upd.team_leader_id,
          executive_id: upd.executive_id,
          ceo_id: upd.ceo_id,
        };
        if (upd.departments !== undefined) {
          body.departments = upd.departments;
        }
        const r = await fetch(`${API}/api/v1/users/${upd.id}`, {
          method: 'PUT', headers: hdrs(), body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status} for user ${upd.id}`);
      }
      showToast(`${t.saved ?? 'Saved'} (${updates.length})`);
      await fetchHierarchyUsers();
    } catch (e) {
      showToast((t.error ?? 'Error') + ': ' + (e instanceof Error ? e.message : ''), false);
    } finally { setSaving(false); }
  }, [hUsers, hEditMap, hdrs, showToast, fetchHierarchyUsers]);

  /* ── Remove user from a specific department ── ★ FIX for the Unterhalt bug */
  const removeFromDepartment = useCallback(async (userId: string, department: string, t: Record<string, string>) => {
    const usr = hUsers.find(u => u.id === userId);
    if (!usr) return;
    const newDepts = (usr.departments || []).filter(d => d !== department);
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/v1/users/${userId}`, {
        method: 'PUT', headers: hdrs(),
        body: JSON.stringify({ departments: newDepts, team_leader_id: null }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      showToast(t.saved ?? 'Removed');
      await fetchHierarchyUsers();
    } catch (e) {
      showToast((t.error ?? 'Error') + ': ' + (e instanceof Error ? e.message : ''), false);
    } finally { setSaving(false); }
  }, [hUsers, hdrs, showToast, fetchHierarchyUsers]);

  const setHierarchyField = useCallback((
    userId: string,
    field: keyof HierarchyEdit,
    value: string | null | string[],
  ) => {
    setHEditMap(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value },
    }));
    setHDirty(true);
  }, []);

  /* ── Language settings ── */
  const [langDraft, setLangDraft] = useState<LangCode[]>([...enabledLangs]);
  const [langDefault, setLangDefault] = useState<LangCode>(defaultLang);
  const [langEditing, setLangEditing] = useState(false);

  const fetchLanguageSettings = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/settings/languages`, { headers: hdrs() });
      if (!r.ok) return;
      const j = await r.json();
      const data = j.data ?? j;
      if (data.enabled_languages?.length) {
        setEnabledLangs(data.enabled_languages);
        setLangDraft(data.enabled_languages);
      }
      if (data.default_language) {
        setDefaultLang(data.default_language);
        setLangDefault(data.default_language);
      }
    } catch { /* silently use defaults */ }
  }, [hdrs, setEnabledLangs, setDefaultLang]);

  const saveLanguageSettings = useCallback(async (t: Record<string, string>) => {
    if (langDraft.length === 0) { showToast(t.atLeastOneLang ?? 'Enable at least one language', false); return; }
    if (!langDraft.includes(langDefault)) { showToast(t.cannotDisableDefault ?? 'Cannot disable the default language', false); return; }
    setSaving(true);
    try {
      await fetch(`${API}/api/v1/settings/languages`, {
        method: 'PUT', headers: hdrs(),
        body: JSON.stringify({ enabled_languages: langDraft, default_language: langDefault }),
      });
      setEnabledLangs(langDraft);
      setDefaultLang(langDefault);
      if (!langDraft.includes(lang as LangCode)) setLanguage(langDefault);
      setLangEditing(false);
      showToast(t.languageSaved ?? 'Language settings saved');
    } catch { showToast(t.error ?? 'Error', false); }
    finally { setSaving(false); }
  }, [langDraft, langDefault, hdrs, showToast, setEnabledLangs, setDefaultLang, setLanguage, lang]);

  const toggleLangEnabled = useCallback((code: LangCode) => {
    setLangDraft(prev => {
      if (prev.includes(code)) {
        if (code === langDefault) return prev;
        return prev.filter(c => c !== code);
      }
      return [...prev, code];
    });
  }, [langDefault]);

  /* ── Delete confirm ── */
  const [confirmDel, setConfirmDel] = useState<{ type: string; id: string } | null>(null);

  const deleteItem = useCallback(async (t: Record<string, string>) => {
    if (!confirmDel) return;
    try {
      const r = await fetch(
        `${API}/api/v1/settings/${confirmDel.type}/${confirmDel.id}`,
        { method: 'DELETE', headers: hdrs() }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      showToast(t.deleted ?? 'Deleted');
      if (confirmDel.type.startsWith('roles')) fetchRoles();
      else if (confirmDel.type.startsWith('config')) fetchConfigItems();
      else if (confirmDel.type.startsWith('vat')) fetchVatRates();
      else if (confirmDel.type.startsWith('cross')) fetchCrossBorderCountries();
    } catch (e) {
      showToast((t.error ?? 'Error') + ': ' + (e instanceof Error ? e.message : ''), false);
    } finally { setConfirmDel(null); }
  }, [confirmDel, hdrs, showToast, fetchRoles, fetchConfigItems, fetchVatRates, fetchCrossBorderCountries]);

  /* ── Mount ── */
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    fetchRoles();
    fetchCompanyInfo();
    fetchVatRates();
    fetchCrossBorderCountries();
    fetchHierarchyUsers();
    fetchLanguageSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const prevCategory = useRef(configCategory);
  useEffect(() => {
    if (prevCategory.current !== configCategory) {
      prevCategory.current = configCategory;
      fetchConfigItems(configCategory);
    }
  }, [configCategory, fetchConfigItems]);

  return {
    toast, saving, setSaving, loading, setLoading,
    roles, configItems, configCategory, setConfigCategory,
    companyInfo, setCompanyInfo, companyForm, setCompanyForm,
    vatRates, crossBorderCountries,
    hUsers, hLoading, hEditMap, hDirty, setHDirty,
    langDraft, setLangDraft, langDefault, setLangDefault, langEditing, setLangEditing,
    confirmDel, setConfirmDel,
    showToast, hdrs,
    fetchRoles, fetchConfigItems, fetchCompanyInfo,
    fetchVatRates, fetchCrossBorderCountries,
    fetchHierarchyUsers, saveHierarchy, removeFromDepartment, setHierarchyField,
    saveLanguageSettings, toggleLangEnabled, deleteItem,
  };
}

export type SettingsData = ReturnType<typeof useSettingsData>;
