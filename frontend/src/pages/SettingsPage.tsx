// src/pages/SettingsPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTheme } from "../contexts/themeContext";
import { useAuthStore } from "../contexts/authStore";
import { useRolesStore } from "../store/rolesStore";
import { getTranslations, type LangCode, ALL_LANG_CODES, LANG_META, getLangName, getLangFlag,} from '../i18n';
import { PERMISSIONS, resolvePermissions, type Role, type Permission,} from "../../../shared/constants/roles";

const API = import.meta.env.VITE_API_URL ?? "";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface ConfigItem {
  id: string;
  key: string;
  label: string;
  is_active: boolean;
  sort_order: number;
  meta?: Record<string, unknown>;
}

interface RoleConfig {
  id: string;
  name: string;
  label_de: string;
  label_en: string;
  label_fr: string;
  label_pt: string;
  permissions: Permission[];
  is_system: boolean;
  is_active: boolean;
}

interface VatRate {
  id: string;
  country_code: string;
  country_name: string;
  rate_type: string;
  rate_percent: number;
  description: string;
  is_active: boolean;
}

interface CrossBorderCountry {
  id: string;
  country_code: string;
  country_name: string;
  currency: string;
  vat_registered: boolean;
  vat_number: string;
  reverse_charge: boolean;
  notes: string;
  is_active: boolean;
}

interface CompanyInfo {
  company_name: string;
  legal_form: string;
  uid_number: string;
  vat_number: string;
  commercial_register: string;
  street: string;
  postal_code: string;
  city: string;
  canton: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  bank_name: string;
  bank_iban: string;
  bank_bic: string;
  vat_method: string;
  vat_period: string;
  vat_standard_rate: number;
  vat_reduced_rate: number;
  vat_special_rate: number;
  fiscal_year_start: string;
  logo_url: string;
}

/* ── Hierarchy ── */
interface HierarchyUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  department: string;
  team_leader_id: string | null;
  executive_id: string | null;
  ceo_id: string | null;
}

type ConfigCategory =
  | "contract_types"
  | "salary_types"
  | "schedule_types"
  | "absence_types"
  | "absence_codes"
  | "machine_categories"
  | "machine_operators";

interface ConfigForm {
  key: string;
  label: string;
  sort_order: number;
  meta: string;
}

/* ================================================================== */
/*  Permission group labels for the role editor                        */
/* ================================================================== */

const PERM_GROUPS: Record<string, Permission[]> = {
  Schedule: ["schedule.view", "schedule.edit"],
  Customers: ["customers.view", "customers.edit", "customers.delete"],
  Machines: ["machines.view", "machines.edit", "machines.delete"],
  Tasks: ["tasks.view", "tasks.edit", "tasks.delete"],
  Quotations: ["quotations.view", "quotations.edit", "quotations.delete"],
  Invoices: ["invoices.view", "invoices.edit", "invoices.delete"],
  HR: ["hr.view", "hr.edit", "hr.payroll"],
  Finance: ["finance.view", "finance.reports"],
  Admin: ["admin.view", "admin.users", "admin.roles", "admin.customers", "admin.machines", "admin.tasks"],
  Reports: ["reports.own", "reports.team", "reports.all"],
};

/* ================================================================== */
/*  Empty form defaults                                                */
/* ================================================================== */

const EMPTY_COMPANY: CompanyInfo = {
  company_name: "", legal_form: "GmbH", uid_number: "", vat_number: "",
  commercial_register: "", street: "", postal_code: "", city: "", canton: "",
  country: "CH", phone: "", email: "", website: "",
  bank_name: "", bank_iban: "", bank_bic: "",
  vat_method: "EFFECTIVE", vat_period: "QUARTERLY",
  vat_standard_rate: 8.1, vat_reduced_rate: 2.6, vat_special_rate: 3.8,
  fiscal_year_start: "01-01", logo_url: "",
};

const EMPTY_ROLE: Omit<RoleConfig, "id"> = {
  name: "", label_de: "", label_en: "", label_fr: "", label_pt: "",
  permissions: [], is_system: false, is_active: true,
};

const EMPTY_CONFIG_FORM: ConfigForm = {
  key: "", label: "", sort_order: 0, meta: "{}",
};

const EMPTY_VAT_RATE: Omit<VatRate, "id"> = {
  country_code: "CH", country_name: "Schweiz", rate_type: "STANDARD",
  rate_percent: 8.1, description: "", is_active: true,
};

const EMPTY_CROSS_BORDER: Omit<CrossBorderCountry, "id"> = {
  country_code: "", country_name: "", currency: "EUR",
  vat_registered: false, vat_number: "", reverse_charge: true,
  notes: "", is_active: true,
};

const CONFIG_CATEGORIES: { key: ConfigCategory; labelKey: string }[] = [
  { key: "contract_types", labelKey: "contractTypes" },
  { key: "salary_types", labelKey: "salaryTypes" },
  { key: "schedule_types", labelKey: "scheduleTypes" },
  { key: "absence_types", labelKey: "absenceTypes" },
  { key: "absence_codes", labelKey: "absenceCodes" },
  { key: "machine_categories", labelKey: "machineCategories" },
  { key: "machine_operators", labelKey: "machineOperators" },
];

const SWISS_CANTONS = [
  "AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU",
  "NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH",
];

const LEGAL_FORMS = [
  "Einzelunternehmen", "GmbH", "AG", "Kollektivgesellschaft",
  "Kommanditgesellschaft", "Genossenschaft", "Verein", "Stiftung",
];

/* ================================================================== */
/*  Helper – normalise role strings                                    */
/* ================================================================== */
function isCeoRole(role: string): boolean {
  return (role || '').toUpperCase() === 'CEO';
}
function isExecRole(role: string): boolean {
  const r = (role || '').toUpperCase();
  return r === 'ADMIN' || r === 'GLOBAL_MANAGER';
}
function isManagerRole(role: string): boolean {
  const r = (role || '').toUpperCase();
  return r === 'MANAGER' || r === 'LOCAL_MANAGER';
}
function isEmployeeRole(role: string): boolean {
  return !isCeoRole(role) && !isExecRole(role) && !isManagerRole(role);
}

function getTier(role: string): number {
  if (isCeoRole(role)) return 4;
  if (isExecRole(role)) return 3;
  if (isManagerRole(role)) return 2;
  return 1;
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

type MainTab = "roles" | "config" | "company" | "vat" | "hierarchy" | "languages";

export default function SettingsPage() {
  const { th, isDark, lang } = useTheme();
  const { token, user } = useAuthStore();
  const t = getTranslations(lang as LangCode);
  const gold = th.gold;
  const dimText = isDark ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.4)";
  const inputBg = isDark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.04)";

  /* ── Permissions ── */
  const { permissionMap } = useRolesStore();
  const perms = useMemo(() => {
    const role: Role = user?.role || "EMPLOYEE";
    return resolvePermissions(role, user?.custom_permissions, permissionMap);
  }, [user, permissionMap]);

  const isExecutive = perms.has("admin.roles" as Permission);

  /* ── Styles ── */
  const sInput: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: 8,
    border: `1px solid ${th.border}`, background: inputBg,
    color: th.text, fontSize: 14, boxSizing: "border-box",
  };
  const sSelect: React.CSSProperties = { ...sInput };
  const sLabel: React.CSSProperties = {
    display: "block", marginBottom: 4, fontWeight: 600, fontSize: 12, color: dimText,
  };
  const sBtn = (bg: string): React.CSSProperties => ({
    padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
    fontWeight: 600, color: "#fff", background: bg, fontSize: 14,
  });
  const sBtnOutline: React.CSSProperties = {
    padding: "8px 20px", borderRadius: 8, border: `1px solid ${th.border}`,
    background: "transparent", color: th.text, fontWeight: 600,
    cursor: "pointer", fontSize: 14,
  };
  const sTab = (active: boolean): React.CSSProperties => ({
    padding: "10px 20px", borderRadius: "10px 10px 0 0", cursor: "pointer",
    fontWeight: 600, fontSize: 14, border: "none",
    background: active ? gold : "transparent",
    color: active ? "#fff" : th.text,
  });
  const sCard: React.CSSProperties = {
    background: isDark ? "#1e1e3a" : "#fff", borderRadius: 14,
    border: `1px solid ${th.border}`, padding: 24, marginBottom: 20,
  };
  const sOverlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const sModal: React.CSSProperties = {
    background: isDark ? "#1e1e3a" : "#fff", color: th.text, borderRadius: 12,
    padding: 24, width: "90%", maxWidth: 700, maxHeight: "90vh", overflowY: "auto",
    boxShadow: "0 8px 32px rgba(0,0,0,0.3)", border: `1px solid ${th.border}`,
  };
  const sTh: React.CSSProperties = {
    textAlign: "left", padding: "10px 12px", fontSize: 12,
    color: dimText, borderBottom: `2px solid ${th.border}`, fontWeight: 700,
  };
  const sTd: React.CSSProperties = {
    padding: "8px 12px", fontSize: 14, borderBottom: `1px solid ${th.border}`,
  };

  /* ── State ── */
  const [mainTab, setMainTab] = useState<MainTab>("roles");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmDel, setConfirmDel] = useState<{ type: string; id: string } | null>(null);

  // Roles
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [roleModal, setRoleModal] = useState(false);
  const [roleEditId, setRoleEditId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState<Omit<RoleConfig, "id">>(EMPTY_ROLE);

  // Config lists
  const [configCategory, setConfigCategory] = useState<ConfigCategory>("contract_types");
  const [configItems, setConfigItems] = useState<ConfigItem[]>([]);
  const [configModal, setConfigModal] = useState(false);
  const [configEditId, setConfigEditId] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState<ConfigForm>(EMPTY_CONFIG_FORM);

  // Company
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(EMPTY_COMPANY);
  const [companyEditing, setCompanyEditing] = useState(false);
  const [companyForm, setCompanyForm] = useState<CompanyInfo>(EMPTY_COMPANY);

  // VAT / Cross-border
  const [vatRates, setVatRates] = useState<VatRate[]>([]);
  const [vatModal, setVatModal] = useState(false);
  const [vatEditId, setVatEditId] = useState<string | null>(null);
  const [vatForm, setVatForm] = useState<Omit<VatRate, "id">>(EMPTY_VAT_RATE);

  const [crossBorderCountries, setCrossBorderCountries] = useState<CrossBorderCountry[]>([]);
  const [cbModal, setCbModal] = useState(false);
  const [cbEditId, setCbEditId] = useState<string | null>(null);
  const [cbForm, setCbForm] = useState<Omit<CrossBorderCountry, "id">>(EMPTY_CROSS_BORDER);

  const [vatSubTab, setVatSubTab] = useState<"rates" | "countries">("rates");

  // Hierarchy
  const [hUsers, setHUsers] = useState<HierarchyUser[]>([]);
  const [hLoading, setHLoading] = useState(false);
  const [hEditMap, setHEditMap] = useState<Record<string, { team_leader_id: string | null; executive_id: string | null; ceo_id: string | null;}>>({});
  const [hDirty, setHDirty] = useState(false);
  const [hRoleFilter, setHRoleFilter] = useState("");

  /* ── Helpers ── */
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const hdrs = useCallback(
    (): HeadersInit => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  );

  const { enabledLangs, setEnabledLangs, defaultLang, setDefaultLang, setLanguage } = useTheme();

  const [langEditing, setLangEditing] = useState(false);
  const [langDraft, setLangDraft] = useState<LangCode[]>([...enabledLangs]);
  const [langDefault, setLangDefault] = useState<LangCode>(defaultLang);

  // Save language settings:
  const saveLanguageSettings = async () => {
    if (langDraft.length === 0) {
      showToast(t.atLeastOneLang, true);
      return;
    }
    if (!langDraft.includes(langDefault)) {
      showToast(t.cannotDisableDefault, true);
      return;
    }
    try {
      setSaving(true);
      await fetch(`${API}/api/v1/settings/languages`, {
        method: 'PUT',
        headers: hdrs(),
        body: JSON.stringify({
          enabled_languages: langDraft,
          default_language: langDefault,
        }),
      });
      setEnabledLangs(langDraft);
      setDefaultLang(langDefault);
      // If current lang is no longer enabled, switch to default
      if (!langDraft.includes(lang)) {
        setLanguage(langDefault);
      }
      setLangEditing(false);
      showToast(t.languageSaved);
    } catch {
      showToast(t.error, true);
    } finally {
      setSaving(false);
    }
  };

  const toggleLangEnabled = (code: LangCode) => {
    setLangDraft(prev => {
      if (prev.includes(code)) {
        // Don't allow removing the default
        if (code === langDefault) return prev;
        return prev.filter(c => c !== code);
      }
      return [...prev, code];
    });
  };

  /* ================================================================ */
  /*  FETCH FUNCTIONS                                                  */
  /* ================================================================ */

  const fetchRoles = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/settings/roles`, { headers: hdrs() });
      const j = await r.json();
      setRoles(j.data ?? j ?? []);
    } catch { /* ignore */ }
  }, [hdrs]);

  const fetchConfigItems = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/settings/config/${configCategory}`, { headers: hdrs() });
      const j = await r.json();
      setConfigItems(j.data ?? j ?? []);
    } catch { /* ignore */ }
  }, [hdrs, configCategory]);

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/settings/company`, { headers: hdrs() });
      const j = await r.json();
      const data = j.data ?? j;
      setCompanyInfo(data);
      setCompanyForm(data);
    } catch { /* ignore */ }
  }, [hdrs]);

  const fetchVatRates = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/settings/vat-rates`, { headers: hdrs() });
      const j = await r.json();
      setVatRates(j.data ?? j ?? []);
    } catch { /* ignore */ }
  }, [hdrs]);

  const fetchCrossBorderCountries = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/settings/cross-border`, { headers: hdrs() });
      const j = await r.json();
      setCrossBorderCountries(j.data ?? j ?? []);
    } catch { /* ignore */ }
  }, [hdrs]);

  const fetchHierarchyUsers = useCallback(async () => {
    setHLoading(true);
    try {
      const r = await fetch(`${API}/api/v1/users?limit=500`, { headers: hdrs() });
      const j = await r.json();
      const list: HierarchyUser[] = (j.data ?? j.items ?? j ?? []).map(
        (u: Record<string, unknown>) => ({
          id: u.id as string,
          first_name: u.first_name as string,
          last_name: u.last_name as string,
          email: u.email as string,
          role: u.role as string,
          department: (u.department as string) ?? "",
          team_leader_id: (u.team_leader_id as string | null) ?? null,
          executive_id: (u.executive_id as string | null) ?? null,
          ceo_id: (u.ceo_id as string | null) ?? null,
        })
      );
      setHUsers(list);
      const map: Record<string, {
        team_leader_id: string | null;
        executive_id: string | null;
        ceo_id: string | null;
      }> = {};
      list.forEach((u) => {
        map[u.id] = {
          team_leader_id: u.team_leader_id,
          executive_id: u.executive_id,
          ceo_id: u.ceo_id,
        };
      });
      setHEditMap(map);
      setHDirty(false);
    } catch { /* ignore */ }
    finally { setHLoading(false); }
  }, [hdrs]);

  useEffect(() => {
    fetchRoles();
    fetchCompanyInfo();
    fetchVatRates();
    fetchCrossBorderCountries();
    fetchHierarchyUsers();
  }, [fetchRoles, fetchCompanyInfo, fetchVatRates, fetchCrossBorderCountries, fetchHierarchyUsers]);

  useEffect(() => {
    fetchConfigItems();
  }, [fetchConfigItems]);

  /* ================================================================ */
  /*  SAVE / DELETE FUNCTIONS                                          */
  /* ================================================================ */

  // ── Roles ──
  const openCreateRole = () => { setRoleForm({ ...EMPTY_ROLE }); setRoleEditId(null); setRoleModal(true); };
  const openEditRole = (r: RoleConfig) => {
    setRoleForm({
      name: r.name, label_de: r.label_de, label_en: r.label_en,
      label_fr: r.label_fr, label_pt: r.label_pt,
      permissions: [...r.permissions], is_system: r.is_system, is_active: r.is_active,
    });
    setRoleEditId(r.id);
    setRoleModal(true);
  };
  const saveRole = async () => {
    setSaving(true);
    try {
      const url = roleEditId ? `${API}/api/v1/settings/roles/${roleEditId}` : `${API}/api/v1/settings/roles`;
      const r = await fetch(url, { method: roleEditId ? "PUT" : "POST", headers: hdrs(), body: JSON.stringify(roleForm) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      showToast(t.saved); setRoleModal(false); fetchRoles();
    } catch (e) { showToast(t.error + ": " + (e instanceof Error ? e.message : ""), false); }
    finally { setSaving(false); }
  };
  const toggleRolePerm = (perm: Permission) => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm) : [...prev.permissions, perm],
    }));
  };

  // ── Config lists ──
  const openCreateConfig = () => { setConfigForm({ ...EMPTY_CONFIG_FORM }); setConfigEditId(null); setConfigModal(true); };
  const openEditConfig = (item: ConfigItem) => {
    setConfigForm({ key: item.key, label: item.label, sort_order: item.sort_order, meta: item.meta ? JSON.stringify(item.meta) : "{}" });
    setConfigEditId(item.id); setConfigModal(true);
  };
  const saveConfigItem = async () => {
    setSaving(true);
    try {
      let metaParsed = {};
      try { metaParsed = JSON.parse(configForm.meta); } catch { /* keep empty */ }
      const body = { category: configCategory, key: configForm.key, label: configForm.label, sort_order: configForm.sort_order, meta: metaParsed };
      const url = configEditId ? `${API}/api/v1/settings/config/${configCategory}/${configEditId}` : `${API}/api/v1/settings/config/${configCategory}`;
      const r = await fetch(url, { method: configEditId ? "PUT" : "POST", headers: hdrs(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      showToast(t.saved); setConfigModal(false); fetchConfigItems();
    } catch (e) { showToast(t.error + ": " + (e instanceof Error ? e.message : ""), false); }
    finally { setSaving(false); }
  };

  // ── Company ──
  const saveCompanyInfo = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/v1/settings/company`, { method: "PUT", headers: hdrs(), body: JSON.stringify(companyForm) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json(); const saved = j.data ?? j;
      setCompanyInfo(saved); setCompanyForm(saved); setCompanyEditing(false); showToast(t.saved);
    } catch (e) { showToast(t.error + ": " + (e instanceof Error ? e.message : ""), false); }
    finally { setSaving(false); }
  };

  // ── VAT Rates ──
  const openCreateVat = () => { setVatForm({ ...EMPTY_VAT_RATE }); setVatEditId(null); setVatModal(true); };
  const openEditVat = (v: VatRate) => {
    setVatForm({ country_code: v.country_code, country_name: v.country_name, rate_type: v.rate_type, rate_percent: v.rate_percent, description: v.description, is_active: v.is_active });
    setVatEditId(v.id); setVatModal(true);
  };
  const saveVatRate = async () => {
    setSaving(true);
    try {
      const url = vatEditId ? `${API}/api/v1/settings/vat-rates/${vatEditId}` : `${API}/api/v1/settings/vat-rates`;
      const r = await fetch(url, { method: vatEditId ? "PUT" : "POST", headers: hdrs(), body: JSON.stringify(vatForm) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      showToast(t.saved); setVatModal(false); fetchVatRates();
    } catch (e) { showToast(t.error + ": " + (e instanceof Error ? e.message : ""), false); }
    finally { setSaving(false); }
  };

  // ── Cross-Border Countries ──
  const openCreateCB = () => { setCbForm({ ...EMPTY_CROSS_BORDER }); setCbEditId(null); setCbModal(true); };
  const openEditCB = (c: CrossBorderCountry) => {
    setCbForm({ country_code: c.country_code, country_name: c.country_name, currency: c.currency, vat_registered: c.vat_registered, vat_number: c.vat_number, reverse_charge: c.reverse_charge, notes: c.notes, is_active: c.is_active });
    setCbEditId(c.id); setCbModal(true);
  };
  const saveCrossBorder = async () => {
    setSaving(true);
    try {
      const url = cbEditId ? `${API}/api/v1/settings/cross-border/${cbEditId}` : `${API}/api/v1/settings/cross-border`;
      const r = await fetch(url, { method: cbEditId ? "PUT" : "POST", headers: hdrs(), body: JSON.stringify(cbForm) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      showToast(t.saved); setCbModal(false); fetchCrossBorderCountries();
    } catch (e) { showToast(t.error + ": " + (e instanceof Error ? e.message : ""), false); }
    finally { setSaving(false); }
  };

  // ── Generic delete ──
  const deleteItem = async () => {
    if (!confirmDel) return;
    try {
      const r = await fetch(`${API}/api/v1/settings/${confirmDel.type}/${confirmDel.id}`, { method: "DELETE", headers: hdrs() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      showToast(t.deleted);
      if (confirmDel.type.startsWith("roles")) fetchRoles();
      else if (confirmDel.type.startsWith("config")) fetchConfigItems();
      else if (confirmDel.type.startsWith("vat")) fetchVatRates();
      else if (confirmDel.type.startsWith("cross")) fetchCrossBorderCountries();
    } catch (e) { showToast(t.error + ": " + (e instanceof Error ? e.message : ""), false); }
    finally { setConfirmDel(null); }
  };

  // ── Hierarchy save ──
  const saveHierarchy = async () => {
    setSaving(true);
    try {
      const updates = hUsers
        .filter((u) => {
          const e = hEditMap[u.id];
          return e && (
            e.team_leader_id !== u.team_leader_id ||
            e.executive_id !== u.executive_id ||
            e.ceo_id !== u.ceo_id
          );
        })
        .map((u) => ({
          id: u.id,
          team_leader_id: hEditMap[u.id].team_leader_id,
          executive_id: hEditMap[u.id].executive_id,
          ceo_id: hEditMap[u.id].ceo_id,
        }));

      for (const upd of updates) {
        const r = await fetch(`${API}/api/v1/users/${upd.id}`, {
          method: "PUT", headers: hdrs(),
          body: JSON.stringify({
            team_leader_id: upd.team_leader_id,
            executive_id: upd.executive_id,
            ceo_id: upd.ceo_id,
          }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status} for user ${upd.id}`);
      }
      showToast(`${t.saved} (${updates.length})`);
      fetchHierarchyUsers();
    } catch (e) { showToast(t.error + ": " + (e instanceof Error ? e.message : ""), false); }
    finally { setSaving(false); }
  };

  const setHierarchyField = (
    userId: string,
    field: "team_leader_id" | "executive_id" | "ceo_id",
    value: string | null
  ) => {
    setHEditMap((prev) => ({ ...prev, [userId]: { ...prev[userId], [field]: value } }));
    setHDirty(true);
  };

  /* ── Hierarchy computed data ── */
  const hCeos = useMemo(() => hUsers.filter((u) => isCeoRole(u.role)), [hUsers]);
  const hExecs = useMemo(() => hUsers.filter((u) => isExecRole(u.role)), [hUsers]);
  const hManagers = useMemo(() => hUsers.filter((u) => isManagerRole(u.role)), [hUsers]);
  const hEmployees = useMemo(() => hUsers.filter((u) => isEmployeeRole(u.role)), [hUsers]);
  const hAllRoles = useMemo(() => [...new Set(hUsers.map((u) => u.role).filter(Boolean))].sort(), [hUsers]);

  const hChangeCount = useMemo(() =>
    hUsers.filter((u) => {
      const e = hEditMap[u.id];
      return e && (
        e.team_leader_id !== u.team_leader_id ||
        e.executive_id !== u.executive_id ||
        e.ceo_id !== u.ceo_id
      );
    }).length,
  [hUsers, hEditMap]);

  const getUserName = useCallback((id: string | null): string => {
    if (!id) return "—";
    const u = hUsers.find((x) => x.id === id);
    return u ? `${u.first_name} ${u.last_name}` : id;
  }, [hUsers]);

  /* ================================================================ */
  /*  ACCESS GUARD                                                     */
  /* ================================================================ */

  if (!isExecutive) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: th.text }}>
        <h2>{t.accessDenied}</h2>
      </div>
    );
  }

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div style={{ padding: 24, color: th.text, minHeight: "100vh" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 2000,
          padding: "12px 24px", borderRadius: 8, color: "#fff",
          background: toast.ok ? "#22c55e" : "#ef4444", fontWeight: 600,
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <h1 style={{ margin: "0 0 20px", color: gold }}>{t.settings}</h1>

      {/* Main Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 0, flexWrap: "wrap" }}>
        {([
          ["roles", t.roles],
          ["config", t.configLists],
          ["company", t.company],
          ["vat", t.vatCrossBorder],
          ["hierarchy", t.hierarchy],
        ] as [MainTab, string][]).map(([key, label]) => (
          <button key={key} style={sTab(mainTab === key)} onClick={() => setMainTab(key)}>
            {label}
          </button>
        ))}
        <button
          onClick={() => setMainTab("languages")}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            border: "none",
            background: mainTab === "languages" ? gold + "22" : "transparent",
            color: mainTab === "languages" ? gold : th.text,
          }}
        >
          {t.languages}
        </button>
      </div>
      <div style={{ borderTop: `2px solid ${gold}`, paddingTop: 20 }}>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  ROLES TAB                                                 */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {mainTab === "roles" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, color: gold }}>{t.roles}</h2>
              <button style={sBtn(gold)} onClick={openCreateRole}>+ {t.newRole}</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={sTh}>{t.roleName}</th>
                  <th style={sTh}>DE</th>
                  <th style={sTh}>EN</th>
                  <th style={sTh}>{t.permissions}</th>
                  <th style={sTh}>{t.systemRole}</th>
                  <th style={sTh}>{t.active}</th>
                  <th style={sTh}></th>
                </tr>
              </thead>
              <tbody>
                {roles.length === 0 && (
                  <tr><td colSpan={7} style={{ ...sTd, textAlign: "center", color: dimText }}>{t.noResults}</td></tr>
                )}
                {roles.map((r) => (
                  <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => openEditRole(r)}>
                    <td style={{ ...sTd, fontWeight: 700 }}>{r.name}</td>
                    <td style={sTd}>{r.label_de}</td>
                    <td style={sTd}>{r.label_en}</td>
                    <td style={sTd}><span style={{ fontSize: 12, color: dimText }}>{r.permissions.length} permissions</span></td>
                    <td style={sTd}>
                      {r.is_system && <span style={{ padding: "2px 8px", borderRadius: 4, background: gold + "22", color: gold, fontSize: 11, fontWeight: 600 }}>System</span>}
                    </td>
                    <td style={sTd}><span style={{ color: r.is_active ? "#22c55e" : "#6b7280" }}>●</span></td>
                    <td style={sTd}>
                      {!r.is_system && (
                        <button style={{ ...sBtn("#ef4444"), padding: "4px 10px", fontSize: 12 }}
                          onClick={(e) => { e.stopPropagation(); setConfirmDel({ type: "roles", id: r.id }); }}>
                          {t.delete}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  CONFIG LISTS TAB                                          */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {mainTab === "config" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {CONFIG_CATEGORIES.map((cat) => (
                  <button key={cat.key} onClick={() => setConfigCategory(cat.key)}
                    style={{
                      padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: "pointer", border: "none",
                      background: configCategory === cat.key ? gold + "22" : "transparent",
                      color: configCategory === cat.key ? gold : th.text,
                    }}>
                    {t[cat.labelKey]}
                  </button>
                ))}
              </div>
              <button style={sBtn(gold)} onClick={openCreateConfig}>+ {t.newItem}</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={sTh}>{t.key}</th>
                  <th style={sTh}>{t.label}</th>
                  <th style={sTh}>{t.sortOrder}</th>
                  <th style={sTh}>{t.active}</th>
                  <th style={sTh}></th>
                </tr>
              </thead>
              <tbody>
                {configItems.length === 0 && (
                  <tr><td colSpan={5} style={{ ...sTd, textAlign: "center", color: dimText }}>{t.noResults}</td></tr>
                )}
                {configItems.map((item) => (
                  <tr key={item.id} style={{ cursor: "pointer" }} onClick={() => openEditConfig(item)}>
                    <td style={{ ...sTd, fontFamily: "monospace", fontWeight: 600 }}>{item.key}</td>
                    <td style={sTd}>{item.label}</td>
                    <td style={sTd}>{item.sort_order}</td>
                    <td style={sTd}><span style={{ color: item.is_active ? "#22c55e" : "#6b7280" }}>●</span></td>
                    <td style={sTd}>
                      <button style={{ ...sBtn("#ef4444"), padding: "4px 10px", fontSize: 12 }}
                        onClick={(e) => { e.stopPropagation(); setConfirmDel({ type: `config/${configCategory}`, id: item.id }); }}>
                        {t.delete}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {/* LANGUAGES TAB */}
        {mainTab === "languages" && (
          <div style={{ background: th.bgCard, borderRadius: 12, padding: 24, border: `1px solid ${th.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, color: th.text, fontSize: 18 }}>{t.languageManagement}</h3>
                <p style={{ margin: "4px 0 0", color: dimText, fontSize: 13 }}>{t.languageManagementDesc}</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {langEditing ? (
                  <>
                    <button
                      style={{ ...sBtn("#6b7280"), padding: "8px 16px" }}
                      onClick={() => {
                        setLangDraft([...enabledLangs]);
                        setLangDefault(defaultLang);
                        setLangEditing(false);
                      }}
                    >
                      {t.cancel}
                    </button>
                    <button
                      style={{ ...sBtn(gold), padding: "8px 16px" }}
                      onClick={saveLanguageSettings}
                      disabled={saving}
                    >
                      {saving ? t.loading : t.save}
                    </button>
                  </>
                ) : (
                  <button
                    style={{ ...sBtn(gold), padding: "8px 16px" }}
                    onClick={() => setLangEditing(true)}
                  >
                    {t.edit}
                  </button>
                )}
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={sTh}>{t.language}</th>
                  <th style={sTh}>{t.roleName}</th>
                  <th style={{ ...sTh, textAlign: "center" }}>{t.status}</th>
                  <th style={{ ...sTh, textAlign: "center" }}>{t.defaultLanguage}</th>
                </tr>
              </thead>
              <tbody>
                {ALL_LANG_CODES.map((code) => {
                  const isEnabled = langDraft.includes(code);
                  const isDefault = langDefault === code;
                  const meta = LANG_META.find(m => m.code === code);
                  return (
                    <tr key={code} style={{ borderBottom: `1px solid ${th.border}` }}>
                      <td style={sTd}>
                        <span style={{ fontSize: 20, marginRight: 8 }}>{meta?.flag ?? ''}</span>
                        <span style={{ fontWeight: 600 }}>{code.toUpperCase()}</span>
                      </td>
                      <td style={sTd}>
                        <span style={{ color: th.text }}>{meta?.name ?? code}</span>
                      </td>
                      <td style={{ ...sTd, textAlign: "center" }}>
                        {langEditing ? (
                          <button
                            onClick={() => toggleLangEnabled(code)}
                            disabled={isDefault && isEnabled}
                            style={{
                              padding: "4px 12px",
                              borderRadius: 6,
                              border: "none",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: (isDefault && isEnabled) ? "not-allowed" : "pointer",
                              background: isEnabled ? "#22c55e22" : "#ef444422",
                              color: isEnabled ? "#22c55e" : "#ef4444",
                            }}
                          >
                            {isEnabled ? t.enabled : t.disabled}
                          </button>
                        ) : (
                          <span style={{ color: isEnabled ? "#22c55e" : "#6b7280" }}>
                            {isEnabled ? "●" : "○"} {isEnabled ? t.enabled : t.disabled}
                          </span>
                        )}
                      </td>
                      <td style={{ ...sTd, textAlign: "center" }}>
                        {langEditing ? (
                          <button
                            onClick={() => {
                              if (isEnabled) setLangDefault(code);
                            }}
                            disabled={!isEnabled}
                            style={{
                              padding: "4px 12px",
                              borderRadius: 6,
                              border: isDefault ? `2px solid ${gold}` : `1px solid ${th.border}`,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: isEnabled ? "pointer" : "not-allowed",
                              background: isDefault ? gold + "22" : "transparent",
                              color: isDefault ? gold : dimText,
                            }}
                          >
                            {isDefault ? "★ " + t.defaultLanguage : t.setAsDefault}
                          </button>
                        ) : (
                          isDefault && (
                            <span style={{ color: gold, fontWeight: 600, fontSize: 13 }}>
                              ★ {t.defaultLanguage}
                            </span>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Preview: currently active language */}
            <div style={{
              marginTop: 24,
              padding: 16,
              borderRadius: 8,
              background: th.bgCard,
              border: `1px solid ${th.border}`,
            }}>
              <p style={{ margin: 0, fontSize: 13, color: dimText }}>
                {t.language}: <strong style={{ color: gold }}>{getLangName(lang)} {getLangFlag(lang)}</strong>
              </p>
            </div>
          </div>
        )}
        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  COMPANY TAB                                               */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {mainTab === "company" && (
          <div style={sCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, color: gold }}>{t.company}</h2>
              {companyEditing ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={sBtn(gold)} disabled={saving} onClick={saveCompanyInfo}>
                    {saving ? "…" : t.save}
                  </button>
                  <button style={sBtnOutline} onClick={() => { setCompanyEditing(false); setCompanyForm(companyInfo); }}>
                    {t.cancel}
                  </button>
                </div>
              ) : (
                <button style={sBtn(gold)} onClick={() => setCompanyEditing(true)}>{t.edit}</button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Company identity */}
              <div>
                <label style={sLabel}>{t.companyName}</label>
                {companyEditing ? (
                  <input style={sInput} value={companyForm.company_name}
                    onChange={(e) => setCompanyForm({ ...companyForm, company_name: e.target.value })} />
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0" }}>{companyInfo.company_name || "—"}</div>
                )}
              </div>
              <div>
                <label style={sLabel}>{t.legalForm}</label>
                {companyEditing ? (
                  <select style={sSelect} value={companyForm.legal_form}
                    onChange={(e) => setCompanyForm({ ...companyForm, legal_form: e.target.value })}>
                    {LEGAL_FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0" }}>{companyInfo.legal_form || "—"}</div>
                )}
              </div>
              <div>
                <label style={sLabel}>{t.uidNumber}</label>
                {companyEditing ? (
                  <input style={sInput} value={companyForm.uid_number} placeholder="CHE-xxx.xxx.xxx"
                    onChange={(e) => setCompanyForm({ ...companyForm, uid_number: e.target.value })} />
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0", fontFamily: "monospace" }}>{companyInfo.uid_number || "—"}</div>
                )}
              </div>
              <div>
                <label style={sLabel}>{t.vatNumber}</label>
                {companyEditing ? (
                  <input style={sInput} value={companyForm.vat_number} placeholder="CHE-xxx.xxx.xxx MWST"
                    onChange={(e) => setCompanyForm({ ...companyForm, vat_number: e.target.value })} />
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0", fontFamily: "monospace" }}>{companyInfo.vat_number || "—"}</div>
                )}
              </div>
              <div>
                <label style={sLabel}>{t.commercialRegister}</label>
                {companyEditing ? (
                  <input style={sInput} value={companyForm.commercial_register}
                    onChange={(e) => setCompanyForm({ ...companyForm, commercial_register: e.target.value })} />
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0" }}>{companyInfo.commercial_register || "—"}</div>
                )}
              </div>

              {/* Address */}
              <div style={{ gridColumn: "1 / -1" }}>
                <hr style={{ border: "none", borderTop: `1px solid ${th.border}`, margin: "8px 0 16px" }} />
              </div>
              <div>
                <label style={sLabel}>{t.street}</label>
                {companyEditing ? (
                  <input style={sInput} value={companyForm.street}
                    onChange={(e) => setCompanyForm({ ...companyForm, street: e.target.value })} />
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0" }}>{companyInfo.street || "—"}</div>
                )}
              </div>
              <div>
                <label style={sLabel}>{t.postalCode} / {t.city}</label>
                {companyEditing ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input style={{ ...sInput, maxWidth: 100 }} value={companyForm.postal_code}
                      onChange={(e) => setCompanyForm({ ...companyForm, postal_code: e.target.value })} />
                    <input style={sInput} value={companyForm.city}
                      onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })} />
                  </div>
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0" }}>{companyInfo.postal_code} {companyInfo.city}</div>
                )}
              </div>
              <div>
                <label style={sLabel}>{t.canton}</label>
                {companyEditing ? (
                  <select style={sSelect} value={companyForm.canton}
                    onChange={(e) => setCompanyForm({ ...companyForm, canton: e.target.value })}>
                    <option value="">—</option>
                    {SWISS_CANTONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0" }}>{companyInfo.canton || "—"}</div>
                )}
              </div>
              <div>
                <label style={sLabel}>{t.country}</label>
                {companyEditing ? (
                  <input style={sInput} value={companyForm.country}
                    onChange={(e) => setCompanyForm({ ...companyForm, country: e.target.value })} />
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0" }}>{companyInfo.country || "—"}</div>
                )}
              </div>

              {/* Contact */}
              <div style={{ gridColumn: "1 / -1" }}>
                <hr style={{ border: "none", borderTop: `1px solid ${th.border}`, margin: "8px 0 16px" }} />
              </div>
              <div>
                <label style={sLabel}>{t.phone}</label>
                {companyEditing ? (
                  <input style={sInput} value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} />
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0" }}>{companyInfo.phone || "—"}</div>
                )}
              </div>
              <div>
                <label style={sLabel}>{t.email}</label>
                {companyEditing ? (
                  <input style={sInput} type="email" value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} />
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0" }}>{companyInfo.email || "—"}</div>
                )}
              </div>
              <div>
                <label style={sLabel}>{t.website}</label>
                {companyEditing ? (
                  <input style={sInput} value={companyForm.website}
                    onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })} />
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0" }}>{companyInfo.website || "—"}</div>
                )}
              </div>
              <div>
                <label style={sLabel}>{t.logoUrl}</label>
                {companyEditing ? (
                  <input style={sInput} value={companyForm.logo_url}
                    onChange={(e) => setCompanyForm({ ...companyForm, logo_url: e.target.value })} />
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0" }}>{companyInfo.logo_url || "—"}</div>
                )}
              </div>

              {/* Banking */}
              <div style={{ gridColumn: "1 / -1" }}>
                <hr style={{ border: "none", borderTop: `1px solid ${th.border}`, margin: "8px 0 16px" }} />
              </div>
              <div>
                <label style={sLabel}>{t.bankName}</label>
                {companyEditing ? (
                  <input style={sInput} value={companyForm.bank_name}
                    onChange={(e) => setCompanyForm({ ...companyForm, bank_name: e.target.value })} />
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0" }}>{companyInfo.bank_name || "—"}</div>
                )}
              </div>
              <div>
                <label style={sLabel}>{t.bankIban}</label>
                {companyEditing ? (
                  <input style={sInput} value={companyForm.bank_iban} placeholder="CH00 0000 0000 0000 0000 0"
                    onChange={(e) => setCompanyForm({ ...companyForm, bank_iban: e.target.value })} />
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0", fontFamily: "monospace" }}>{companyInfo.bank_iban || "—"}</div>
                )}
              </div>
              <div>
                <label style={sLabel}>{t.bankBic}</label>
                {companyEditing ? (
                  <input style={sInput} value={companyForm.bank_bic}
                    onChange={(e) => setCompanyForm({ ...companyForm, bank_bic: e.target.value })} />
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0", fontFamily: "monospace" }}>{companyInfo.bank_bic || "—"}</div>
                )}
              </div>

              {/* VAT settings */}
              <div style={{ gridColumn: "1 / -1" }}>
                <hr style={{ border: "none", borderTop: `1px solid ${th.border}`, margin: "8px 0 16px" }} />
              </div>
              <div>
                <label style={sLabel}>{t.vatMethod}</label>
                {companyEditing ? (
                  <select style={sSelect} value={companyForm.vat_method}
                    onChange={(e) => setCompanyForm({ ...companyForm, vat_method: e.target.value })}>
                    <option value="EFFECTIVE">{t.effective}</option>
                    <option value="NET_RATE">{t.netRate}</option>
                    <option value="FLAT_RATE">{t.flatRate}</option>
                  </select>
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0" }}>
                    {companyInfo.vat_method === "EFFECTIVE" ? t.effective
                      : companyInfo.vat_method === "NET_RATE" ? t.netRate : t.flatRate}
                  </div>
                )}
              </div>
              <div>
                <label style={sLabel}>{t.vatPeriod}</label>
                {companyEditing ? (
                  <select style={sSelect} value={companyForm.vat_period}
                    onChange={(e) => setCompanyForm({ ...companyForm, vat_period: e.target.value })}>
                    <option value="QUARTERLY">{t.quarterly}</option>
                    <option value="SEMI_ANNUAL">{t.semiAnnual}</option>
                    <option value="ANNUAL">{t.annual}</option>
                  </select>
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0" }}>
                    {companyInfo.vat_period === "QUARTERLY" ? t.quarterly
                      : companyInfo.vat_period === "SEMI_ANNUAL" ? t.semiAnnual : t.annual}
                  </div>
                )}
              </div>
              <div>
                <label style={sLabel}>{t.vatStandard} (%)</label>
                {companyEditing ? (
                  <input style={sInput} type="number" step="0.1" value={companyForm.vat_standard_rate}
                    onChange={(e) => setCompanyForm({ ...companyForm, vat_standard_rate: parseFloat(e.target.value) || 0 })} />
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0" }}>{companyInfo.vat_standard_rate}%</div>
                )}
              </div>
              <div>
                <label style={sLabel}>{t.vatReduced} (%)</label>
                {companyEditing ? (
                  <input style={sInput} type="number" step="0.1" value={companyForm.vat_reduced_rate}
                    onChange={(e) => setCompanyForm({ ...companyForm, vat_reduced_rate: parseFloat(e.target.value) || 0 })} />
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0" }}>{companyInfo.vat_reduced_rate}%</div>
                )}
              </div>
              <div>
                <label style={sLabel}>{t.vatSpecial} (%)</label>
                {companyEditing ? (
                  <input style={sInput} type="number" step="0.1" value={companyForm.vat_special_rate}
                    onChange={(e) => setCompanyForm({ ...companyForm, vat_special_rate: parseFloat(e.target.value) || 0 })} />
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0" }}>{companyInfo.vat_special_rate}%</div>
                )}
              </div>
              <div>
                <label style={sLabel}>{t.fiscalYearStart}</label>
                {companyEditing ? (
                  <input style={sInput} value={companyForm.fiscal_year_start} placeholder="01-01"
                    onChange={(e) => setCompanyForm({ ...companyForm, fiscal_year_start: e.target.value })} />
                ) : (
                  <div style={{ fontSize: 14, padding: "8px 0" }}>{companyInfo.fiscal_year_start || "01-01"}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  VAT & CROSS-BORDER TAB                                    */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {mainTab === "vat" && (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              <button
                style={{
                  padding: "6px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", border: "none",
                  background: vatSubTab === "rates" ? gold + "22" : "transparent",
                  color: vatSubTab === "rates" ? gold : th.text,
                }}
                onClick={() => setVatSubTab("rates")}
              >
                {t.vatRates}
              </button>
              <button
                style={{
                  padding: "6px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", border: "none",
                  background: vatSubTab === "countries" ? gold + "22" : "transparent",
                  color: vatSubTab === "countries" ? gold : th.text,
                }}
                onClick={() => setVatSubTab("countries")}
              >
                {t.crossBorderCountries}
              </button>
            </div>

            {/* VAT Rates */}
            {vatSubTab === "rates" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ margin: 0, color: gold }}>{t.vatRates}</h3>
                  <button style={sBtn(gold)} onClick={openCreateVat}>+ {t.newVatRate}</button>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={sTh}>{t.countryCode}</th>
                      <th style={sTh}>{t.countryName}</th>
                      <th style={sTh}>{t.rateType}</th>
                      <th style={sTh}>{t.ratePercent}</th>
                      <th style={sTh}>{t.description}</th>
                      <th style={sTh}>{t.active}</th>
                      <th style={sTh}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {vatRates.length === 0 && (
                      <tr><td colSpan={7} style={{ ...sTd, textAlign: "center", color: dimText }}>{t.noResults}</td></tr>
                    )}
                    {vatRates.map((v) => (
                      <tr key={v.id} style={{ cursor: "pointer" }} onClick={() => openEditVat(v)}>
                        <td style={{ ...sTd, fontFamily: "monospace", fontWeight: 700 }}>{v.country_code}</td>
                        <td style={sTd}>{v.country_name}</td>
                        <td style={sTd}>
                          <span style={{
                            padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                            background: v.rate_type === "STANDARD" ? gold + "22" : v.rate_type === "REDUCED" ? "#22c55e22" : "#3b82f622",
                            color: v.rate_type === "STANDARD" ? gold : v.rate_type === "REDUCED" ? "#22c55e" : "#3b82f6",
                          }}>
                            {v.rate_type}
                          </span>
                        </td>
                        <td style={{ ...sTd, fontWeight: 700 }}>{v.rate_percent}%</td>
                        <td style={sTd}>{v.description}</td>
                        <td style={sTd}><span style={{ color: v.is_active ? "#22c55e" : "#6b7280" }}>●</span></td>
                        <td style={sTd}>
                          <button style={{ ...sBtn("#ef4444"), padding: "4px 10px", fontSize: 12 }}
                            onClick={(e) => { e.stopPropagation(); setConfirmDel({ type: "vat-rates", id: v.id }); }}>
                            {t.delete}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Cross-Border Countries */}
            {vatSubTab === "countries" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ margin: 0, color: gold }}>{t.crossBorderCountries}</h3>
                  <button style={sBtn(gold)} onClick={openCreateCB}>+ {t.newCountry}</button>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={sTh}>{t.countryCode}</th>
                      <th style={sTh}>{t.countryName}</th>
                      <th style={sTh}>{t.currency}</th>
                      <th style={sTh}>{t.vatRegistered}</th>
                      <th style={sTh}>{t.reverseCharge}</th>
                      <th style={sTh}>{t.notes}</th>
                      <th style={sTh}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {crossBorderCountries.length === 0 && (
                      <tr><td colSpan={7} style={{ ...sTd, textAlign: "center", color: dimText }}>{t.noResults}</td></tr>
                    )}
                    {crossBorderCountries.map((c) => (
                      <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => openEditCB(c)}>
                        <td style={{ ...sTd, fontFamily: "monospace", fontWeight: 700 }}>{c.country_code}</td>
                        <td style={sTd}>{c.country_name}</td>
                        <td style={sTd}>{c.currency}</td>
                        <td style={sTd}><span style={{ color: c.vat_registered ? "#22c55e" : "#6b7280" }}>●</span></td>
                        <td style={sTd}><span style={{ color: c.reverse_charge ? "#22c55e" : "#6b7280" }}>●</span></td>
                        <td style={{ ...sTd, fontSize: 12, color: dimText }}>{c.notes?.slice(0, 50)}</td>
                        <td style={sTd}>
                          <button style={{ ...sBtn("#ef4444"), padding: "4px 10px", fontSize: 12 }}
                            onClick={(e) => { e.stopPropagation(); setConfirmDel({ type: "cross-border", id: c.id }); }}>
                            {t.delete}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  HIERARCHY TAB                                             */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {mainTab === "hierarchy" && (
          <>
            {/* Header + Save */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2 style={{ margin: 0, color: gold }}>{t.hierarchy}</h2>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: dimText }}>{t.hierarchyDesc}</p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {hDirty && (
                  <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>
                    {hChangeCount} {t.changed}
                  </span>
                )}
                <button
                  style={sBtn(hDirty ? "#22c55e" : gold)}
                  disabled={!hDirty || saving}
                  onClick={saveHierarchy}
                >
                  {saving ? "…" : t.save}
                </button>
                <button style={sBtnOutline} onClick={fetchHierarchyUsers} disabled={hLoading}>
                  ↻
                </button>
              </div>
            </div>

            {hLoading && (
              <div style={{ textAlign: "center", padding: 40, color: dimText }}>{t.loading}</div>
            )}

            {!hLoading && (
              <>
                {/* ── Org Chart: CEO → Executives → Team Leaders → Employees ── */}
                <div style={sCard}>
                  <h3 style={{ margin: "0 0 16px", color: gold }}>🏗️ {t.orgChart}</h3>

                  {hCeos.length === 0 && (
                    <div style={{ padding: 16, color: dimText, fontStyle: "italic" }}>
                      ⚠️ {t.noCeo}
                    </div>
                  )}

                  {hCeos.map((ceo) => {
                    const execsUnder = hExecs.filter(
                      (ex) => hEditMap[ex.id]?.ceo_id === ceo.id
                    );
                    return (
                      <div key={ceo.id} style={{ marginBottom: 28 }}>
                        {/* CEO node */}
                        <div style={{
                          padding: "14px 20px", borderRadius: 10,
                          background: `linear-gradient(135deg, ${gold}33, ${gold}11)`,
                          border: `2px solid ${gold}`,
                          fontWeight: 700, fontSize: 16, marginBottom: 8,
                        }}>
                          👑 {ceo.first_name} {ceo.last_name}
                          <span style={{ fontSize: 11, marginLeft: 10, padding: "2px 8px", borderRadius: 4, background: gold + "22", color: gold }}>CEO</span>
                        </div>

                        {/* Executives under this CEO */}
                        <div style={{ marginLeft: 30, borderLeft: `2px solid ${gold}44`, paddingLeft: 16 }}>
                          {execsUnder.length === 0 && (
                            <div style={{ padding: "8px 0", color: dimText, fontSize: 13, fontStyle: "italic" }}>
                              {t.noResults}
                            </div>
                          )}
                          {execsUnder.map((exec) => {
                            const tlsUnder = hManagers.filter(
                              (m) => hEditMap[m.id]?.executive_id === exec.id
                            );
                            return (
                              <div key={exec.id} style={{ marginBottom: 20 }}>
                                {/* Executive node */}
                                <div style={{
                                  padding: "12px 18px", borderRadius: 8,
                                  background: isDark ? "rgba(59,130,246,.1)" : "rgba(59,130,246,.06)",
                                  border: `1px solid rgba(59,130,246,.3)`,
                                  fontWeight: 600, fontSize: 14, marginBottom: 6,
                                }}>
                                  👔 {exec.first_name} {exec.last_name}
                                  <span style={{ fontSize: 11, marginLeft: 10, color: "#3b82f6" }}>{exec.role}</span>
                                  <span style={{ fontSize: 11, marginLeft: 6, color: dimText }}>
                                    · {tlsUnder.length} {t.teamLeaders}
                                  </span>
                                </div>

                                {/* Team Leaders under this Executive */}
                                <div style={{ marginLeft: 28, borderLeft: `2px solid ${th.border}`, paddingLeft: 14 }}>
                                  {tlsUnder.length === 0 && (
                                    <div style={{ padding: "6px 0", color: dimText, fontSize: 12, fontStyle: "italic" }}>—</div>
                                  )}
                                  {tlsUnder.map((tl) => {
                                    const empsUnder = hEmployees.filter(
                                      (e) => hEditMap[e.id]?.team_leader_id === tl.id
                                    );
                                    return (
                                      <div key={tl.id} style={{ marginBottom: 14 }}>
                                        {/* Team Leader node */}
                                        <div style={{
                                          padding: "10px 14px", borderRadius: 6,
                                          background: isDark ? "rgba(34,197,94,.08)" : "rgba(34,197,94,.05)",
                                          border: `1px solid rgba(34,197,94,.25)`,
                                          fontWeight: 600, fontSize: 13, marginBottom: 4,
                                        }}>
                                          🔧 {tl.first_name} {tl.last_name}
                                          <span style={{ fontSize: 11, marginLeft: 10, color: "#22c55e" }}>{tl.role}</span>
                                          <span style={{ fontSize: 11, marginLeft: 6, color: dimText }}>
                                            · {empsUnder.length} {t.employees}
                                          </span>
                                        </div>

                                        {/* Employees under this Team Leader */}
                                        <div style={{ marginLeft: 22, borderLeft: `1px dashed ${th.border}`, paddingLeft: 10 }}>
                                          {empsUnder.map((emp) => (
                                            <div key={emp.id} style={{
                                              padding: "5px 10px", borderRadius: 4, fontSize: 12, color: th.text,
                                              background: isDark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)",
                                              marginBottom: 3,
                                            }}>
                                              👤 {emp.first_name} {emp.last_name}
                                              <span style={{ fontSize: 10, marginLeft: 8, color: dimText }}>{emp.role}</span>
                                            </div>
                                          ))}
                                          {empsUnder.length === 0 && (
                                            <div style={{ fontSize: 11, color: dimText, fontStyle: "italic", padding: "3px 0" }}>—</div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Unassigned warnings */}
                  {(() => {
                    const unassignedExecs = hExecs.filter((ex) => !hEditMap[ex.id]?.ceo_id);
                    const unassignedTLs = hManagers.filter((m) => !hEditMap[m.id]?.executive_id);
                    const unassignedEmps = hEmployees.filter((e) => !hEditMap[e.id]?.team_leader_id);
                    if (unassignedExecs.length === 0 && unassignedTLs.length === 0 && unassignedEmps.length === 0) return null;
                    return (
                      <div style={{
                        marginTop: 20, padding: 16, borderRadius: 10,
                        background: "#ef444422", border: "1px dashed #ef4444",
                      }}>
                        <h4 style={{ margin: "0 0 10px", color: "#ef4444" }}>⚠️ {t.unassigned}</h4>
                        {unassignedExecs.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{t.executives}:</span>
                            {unassignedExecs.map((ex) => (
                              <span key={ex.id} style={{ marginLeft: 8, fontSize: 13 }}>
                                {ex.first_name} {ex.last_name}
                              </span>
                            ))}
                          </div>
                        )}
                        {unassignedTLs.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{t.teamLeaders}:</span>
                            {unassignedTLs.map((tl) => (
                              <span key={tl.id} style={{ marginLeft: 8, fontSize: 13 }}>
                                {tl.first_name} {tl.last_name}
                              </span>
                            ))}
                          </div>
                        )}
                        {unassignedEmps.length > 0 && (
                          <div>
                            <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
                              {t.employees} ({unassignedEmps.length}):
                            </span>
                            {unassignedEmps.slice(0, 10).map((e) => (
                              <span key={e.id} style={{ marginLeft: 8, fontSize: 13 }}>
                                {e.first_name} {e.last_name}
                              </span>
                            ))}
                            {unassignedEmps.length > 10 && (
                              <span style={{ marginLeft: 8, fontSize: 12, color: dimText }}>
                                +{unassignedEmps.length - 10}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* ── Assignment Table ── */}
                <div style={sCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                    <h3 style={{ margin: 0, color: gold }}>📋 {t.bulkAssign}</h3>
                    <select
                      style={{ ...sSelect, maxWidth: 200 }}
                      value={hRoleFilter}
                      onChange={(e) => setHRoleFilter(e.target.value)}
                    >
                      <option value="">{t.all}</option>
                      {hAllRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={sTh}>{t.name}</th>
                          <th style={sTh}>{t.role}</th>
                          <th style={sTh}>{t.attachedTo}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hUsers
                          .filter((u) => !hRoleFilter || u.role === hRoleFilter)
                          .sort((a, b) => getTier(b.role) - getTier(a.role))
                          .map((u) => {
                            const tier = getTier(u.role);
                            const edit = hEditMap[u.id] || { team_leader_id: null, executive_id: null, ceo_id: null };
                            const changed =
                              edit.team_leader_id !== u.team_leader_id ||
                              edit.executive_id !== u.executive_id ||
                              edit.ceo_id !== u.ceo_id;

                            // Determine which dropdown to show based on tier
                            // CEO (tier 4) → no superior
                            // Executive (tier 3) → picks a CEO
                            // Manager (tier 2) → picks an Executive
                            // Employee (tier 1) → picks a Team Leader

                            let superiorField: "ceo_id" | "executive_id" | "team_leader_id" | null = null;
                            let superiorOptions: HierarchyUser[] = [];
                            let superiorLabel = "";

                            if (tier === 3) {
                              superiorField = "ceo_id";
                              superiorOptions = hCeos;
                              superiorLabel = t.ceoRole;
                            } else if (tier === 2) {
                              superiorField = "executive_id";
                              superiorOptions = hExecs;
                              superiorLabel = t.executive;
                            } else if (tier === 1) {
                              superiorField = "team_leader_id";
                              superiorOptions = hManagers;
                              superiorLabel = t.teamLeader;
                            }

                            return (
                              <tr key={u.id} style={{
                                background: changed
                                  ? (isDark ? "rgba(34,197,94,.08)" : "rgba(34,197,94,.05)")
                                  : "transparent",
                              }}>
                                <td style={{ ...sTd, fontWeight: 600 }}>
                                  {tier === 4 && "👑 "}
                                  {tier === 3 && "👔 "}
                                  {tier === 2 && "🔧 "}
                                  {tier === 1 && "👤 "}
                                  {u.first_name} {u.last_name}
                                  {changed && <span style={{ marginLeft: 6, color: "#22c55e", fontSize: 11 }}>●</span>}
                                </td>
                                <td style={sTd}>
                                  <span style={{
                                    padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                                    background:
                                      tier === 4 ? gold + "22" :
                                      tier === 3 ? "#3b82f622" :
                                      tier === 2 ? "#22c55e22" : "transparent",
                                    color:
                                      tier === 4 ? gold :
                                      tier === 3 ? "#3b82f6" :
                                      tier === 2 ? "#22c55e" : th.text,
                                  }}>
                                    {u.role}
                                  </span>
                                </td>

                                {/* Superior dropdown */}
                                <td style={sTd}>
                                  {superiorField === null ? (
                                    <span style={{ fontSize: 12, color: gold, fontWeight: 600 }}>— {t.tier4}</span>
                                  ) : (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={{ fontSize: 10, color: dimText, whiteSpace: "nowrap" }}>{superiorLabel}:</span>
                                      <select
                                        style={{ ...sSelect, padding: "4px 8px", fontSize: 12, flex: 1 }}
                                        value={(edit as any)[superiorField] ?? ""}
                                        onChange={(e) =>
                                          setHierarchyField(u.id, superiorField!, e.target.value || null)
                                        }
                                      >
                                        <option value="">— {t.unassigned}</option>
                                        {superiorOptions
                                          .filter((s) => s.id !== u.id)
                                          .map((s) => (
                                            <option key={s.id} value={s.id}>
                                              {s.first_name} {s.last_name}
                                            </option>
                                          ))}
                                      </select>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  ROLE MODAL                                                */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {roleModal && (
        <div style={sOverlay} onClick={() => setRoleModal(false)}>
          <div style={sModal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 16px", color: gold }}>
              {roleEditId ? t.editRole : t.newRole}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={sLabel}>{t.roleName} (key) *</label>
                <input style={sInput} value={roleForm.name}
                  disabled={roleForm.is_system}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value.toUpperCase().replace(/[^A-Z_]/g, "") })} />
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginTop: 20 }}>
                  <input type="checkbox" checked={roleForm.is_active}
                    onChange={(e) => setRoleForm({ ...roleForm, is_active: e.target.checked })} />
                  {t.active}
                </label>
              </div>
              <div>
                <label style={sLabel}>Label DE</label>
                <input style={sInput} value={roleForm.label_de}
                  onChange={(e) => setRoleForm({ ...roleForm, label_de: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>Label EN</label>
                <input style={sInput} value={roleForm.label_en}
                  onChange={(e) => setRoleForm({ ...roleForm, label_en: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>Label FR</label>
                <input style={sInput} value={roleForm.label_fr}
                  onChange={(e) => setRoleForm({ ...roleForm, label_fr: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>Label PT</label>
                <input style={sInput} value={roleForm.label_pt}
                  onChange={(e) => setRoleForm({ ...roleForm, label_pt: e.target.value })} />
              </div>
            </div>

            {/* Permission matrix */}
            <h3 style={{ margin: "0 0 12px", color: gold, fontSize: 15 }}>{t.permissions}</h3>
            <div style={{ maxHeight: 400, overflowY: "auto", border: `1px solid ${th.border}`, borderRadius: 8, padding: 12 }}>
              {Object.entries(PERM_GROUPS).map(([group, permsArr]) => (
                <div key={group} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: gold, marginBottom: 6 }}>{group}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {permsArr.map((perm) => {
                      const checked = roleForm.permissions.includes(perm);
                      return (
                        <label key={perm} style={{
                          display: "flex", alignItems: "center", gap: 4, fontSize: 13,
                          padding: "4px 10px", borderRadius: 6,
                          background: checked ? "#22c55e18" : "transparent",
                          border: `1px solid ${checked ? "#22c55e" : th.border}`,
                          cursor: "pointer",
                        }}>
                          <input type="checkbox" checked={checked}
                            onChange={() => toggleRolePerm(perm)} />
                          {perm.split(".")[1]}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button style={sBtnOutline} onClick={() => setRoleModal(false)}>{t.cancel}</button>
              <button style={sBtn(gold)} disabled={saving} onClick={saveRole}>
                {saving ? "…" : t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  CONFIG ITEM MODAL                                         */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {configModal && (
        <div style={sOverlay} onClick={() => setConfigModal(false)}>
          <div style={{ ...sModal, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 16px", color: gold }}>
              {configEditId ? t.edit : t.newItem} — {t[CONFIG_CATEGORIES.find((c) => c.key === configCategory)?.labelKey ?? ""] ?? configCategory}
            </h2>

            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={sLabel}>{t.key} *</label>
                <input style={sInput} value={configForm.key}
                  onChange={(e) => setConfigForm({ ...configForm, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })} />
              </div>
              <div>
                <label style={sLabel}>{t.label} *</label>
                <input style={sInput} value={configForm.label}
                  onChange={(e) => setConfigForm({ ...configForm, label: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>{t.sortOrder}</label>
                <input style={sInput} type="number" value={configForm.sort_order}
                  onChange={(e) => setConfigForm({ ...configForm, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={sLabel}>{t.metadata}</label>
                <textarea style={{ ...sInput, minHeight: 80, fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
                  value={configForm.meta}
                  onChange={(e) => setConfigForm({ ...configForm, meta: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button style={sBtnOutline} onClick={() => setConfigModal(false)}>{t.cancel}</button>
              <button style={sBtn(gold)} disabled={saving} onClick={saveConfigItem}>
                {saving ? "…" : t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  VAT RATE MODAL                                            */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {vatModal && (
        <div style={sOverlay} onClick={() => setVatModal(false)}>
          <div style={{ ...sModal, maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 16px", color: gold }}>
              {vatEditId ? t.edit : t.newVatRate}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={sLabel}>{t.countryCode} *</label>
                <input style={sInput} value={vatForm.country_code} maxLength={2}
                  onChange={(e) => setVatForm({ ...vatForm, country_code: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label style={sLabel}>{t.countryName}</label>
                <input style={sInput} value={vatForm.country_name}
                  onChange={(e) => setVatForm({ ...vatForm, country_name: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>{t.rateType}</label>
                <select style={sSelect} value={vatForm.rate_type}
                  onChange={(e) => setVatForm({ ...vatForm, rate_type: e.target.value })}>
                  <option value="STANDARD">Standard</option>
                  <option value="REDUCED">Reduced</option>
                  <option value="SPECIAL">Special</option>
                  <option value="ZERO">Zero</option>
                </select>
              </div>
              <div>
                <label style={sLabel}>{t.ratePercent}</label>
                <input style={sInput} type="number" step="0.01" value={vatForm.rate_percent}
                  onChange={(e) => setVatForm({ ...vatForm, rate_percent: parseFloat(e.target.value) || 0 })} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={sLabel}>{t.description}</label>
                <input style={sInput} value={vatForm.description}
                  onChange={(e) => setVatForm({ ...vatForm, description: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <input type="checkbox" checked={vatForm.is_active}
                    onChange={(e) => setVatForm({ ...vatForm, is_active: e.target.checked })} />
                  {t.active}
                </label>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button style={sBtnOutline} onClick={() => setVatModal(false)}>{t.cancel}</button>
              <button style={sBtn(gold)} disabled={saving} onClick={saveVatRate}>
                {saving ? "…" : t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  CROSS-BORDER COUNTRY MODAL                                */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {cbModal && (
        <div style={sOverlay} onClick={() => setCbModal(false)}>
          <div style={{ ...sModal, maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 16px", color: gold }}>
              {cbEditId ? t.edit : t.newCountry}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={sLabel}>{t.countryCode} *</label>
                <input style={sInput} value={cbForm.country_code} maxLength={2}
                  onChange={(e) => setCbForm({ ...cbForm, country_code: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label style={sLabel}>{t.countryName} *</label>
                <input style={sInput} value={cbForm.country_name}
                  onChange={(e) => setCbForm({ ...cbForm, country_name: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>{t.currency}</label>
                <input style={sInput} value={cbForm.currency} maxLength={3}
                  onChange={(e) => setCbForm({ ...cbForm, currency: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label style={sLabel}>{t.vatNumber}</label>
                <input style={sInput} value={cbForm.vat_number}
                  onChange={(e) => setCbForm({ ...cbForm, vat_number: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <input type="checkbox" checked={cbForm.vat_registered}
                    onChange={(e) => setCbForm({ ...cbForm, vat_registered: e.target.checked })} />
                  {t.vatRegistered}
                </label>
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <input type="checkbox" checked={cbForm.reverse_charge}
                    onChange={(e) => setCbForm({ ...cbForm, reverse_charge: e.target.checked })} />
                  {t.reverseCharge}
                </label>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={sLabel}>{t.notes}</label>
                <textarea style={{ ...sInput, minHeight: 80, resize: "vertical" }}
                  value={cbForm.notes}
                  onChange={(e) => setCbForm({ ...cbForm, notes: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <input type="checkbox" checked={cbForm.is_active}
                    onChange={(e) => setCbForm({ ...cbForm, is_active: e.target.checked })} />
                  {t.active}
                </label>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button style={sBtnOutline} onClick={() => setCbModal(false)}>{t.cancel}</button>
              <button style={sBtn(gold)} disabled={saving} onClick={saveCrossBorder}>
                {saving ? "…" : t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  DELETE CONFIRMATION MODAL                                  */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {confirmDel && (
        <div style={sOverlay} onClick={() => setConfirmDel(null)}>
          <div style={{ ...sModal, maxWidth: 400, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: "#ef4444", marginBottom: 16 }}>{t.confirmDelete}</h3>
            <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
              <button style={sBtnOutline} onClick={() => setConfirmDel(null)}>{t.no}</button>
              <button style={sBtn("#ef4444")} onClick={deleteItem}>{t.yes}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
