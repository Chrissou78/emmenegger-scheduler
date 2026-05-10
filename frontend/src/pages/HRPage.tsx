// src/pages/HRPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTheme } from "../contexts/themeContext";
import { useAuthStore } from "../contexts/authStore";
import { useRolesStore } from "../store/rolesStore";
import { resolvePermissions, type Role, type Permission,} from "../../../shared/constants/roles";
import { getTranslations, type LangCode } from '../i18n';

const API = import.meta.env.VITE_API_URL ?? "";

function normalizeRole(raw: string): Role {
  const upper = (raw || "").toUpperCase();
  switch (upper) {
    case "GLOBAL_MANAGER": return "ADMIN";
    case "LOCAL_MANAGER":  return "MANAGER";
    case "ARBEITER":       return "EMPLOYEE";
    default:               return (upper as Role) || "EMPLOYEE";
  }
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface HRProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  department: string;
  entry_date: string;
  exit_date: string;
  contract_type: string;
  work_pensum: number;
  salary_type: string;
  salary_amount: number;
  hours_per_week: number;
  ahv_number: string;
  iban: string;
  nationality: string;
  permit_type: string;
  marital_status: string;
  children_count: number;
  canton: string;
  bvg_code: string;
  notes: string;
  /* ── Hierarchy ── */
  team_leader_id: string | null;
  executive_id: string | null;
}

interface PayslipLine {
  label: string;
  employer: number;
  employee: number;
}

/* helper: minimal user record for dropdowns */
interface UserSummary {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

/* ------------------------------------------------------------------ */
/*  Swiss social charges engine (2026 official rates)                   */
/* ------------------------------------------------------------------ */
const CH_RATES = {
  AHV_IV_EO_TOTAL: 0.106,
  ALV_TOTAL: 0.022,
  ALV_CEILING: 148200,
  ALV_SOLIDARITY: 0.01,
  UVG_BU: 0.0079,
  UVG_NBU: 0.0131,
  UVG_CEILING: 148200,
  KTG_TOTAL: 0.01,
  FAK_DEFAULT: 0.022,
  BVG_ENTRY_THRESHOLD: 22680,
  BVG_COORDINATION_DEDUCTION: 26460,
  BVG_MIN_COORDINATED: 3780,
  BVG_MAX_COORDINATED: 64260,
  BVG_MAX_SALARY: 90720,
  CHILD_ALLOWANCE: 215,
  EDUCATION_ALLOWANCE: 268,
};

const FAK_BY_CANTON: Record<string, number> = {
  ZH: 0.021, BE: 0.021, LU: 0.020, UR: 0.018, SZ: 0.019,
  OW: 0.018, NW: 0.018, GL: 0.023, ZG: 0.017, FR: 0.0224,
  SO: 0.022, BS: 0.021, BL: 0.019, SH: 0.020, AR: 0.020,
  AI: 0.020, SG: 0.022, GR: 0.022, AG: 0.021, TG: 0.020,
  TI: 0.022, VD: 0.0228, VS: 0.0225, NE: 0.0236, GE: 0.0245,
  JU: 0.023,
};

function getBvgRate(age: number): number {
  if (age < 25) return 0;
  if (age <= 34) return 0.07;
  if (age <= 44) return 0.10;
  if (age <= 54) return 0.15;
  return 0.18;
}

function computePayslip(
  annualGross: number,
  age: number,
  canton: string,
): { lines: PayslipLine[]; totalEmployer: number; totalEmployee: number; net: number } {
  const monthly = annualGross / 12;
  const lines: PayslipLine[] = [];

  const ahvEach = annualGross * (CH_RATES.AHV_IV_EO_TOTAL / 2) / 12;
  lines.push({ label: "AHV/IV/EO", employer: ahvEach, employee: ahvEach });

  const alvBase = Math.min(annualGross, CH_RATES.ALV_CEILING);
  const alvEach = alvBase * (CH_RATES.ALV_TOTAL / 2) / 12;
  lines.push({ label: "ALV", employer: alvEach, employee: alvEach });

  if (annualGross > CH_RATES.ALV_CEILING) {
    const excess = annualGross - CH_RATES.ALV_CEILING;
    const solEach = excess * (CH_RATES.ALV_SOLIDARITY / 2) / 12;
    lines.push({ label: "ALV Solidarität", employer: solEach, employee: solEach });
  }

  if (annualGross >= CH_RATES.BVG_ENTRY_THRESHOLD) {
    const cappedSalary = Math.min(annualGross, CH_RATES.BVG_MAX_SALARY);
    const coordSalary = Math.max(
      CH_RATES.BVG_MIN_COORDINATED,
      Math.min(cappedSalary - CH_RATES.BVG_COORDINATION_DEDUCTION, CH_RATES.BVG_MAX_COORDINATED)
    );
    const bvgRate = getBvgRate(age);
    const bvgEach = (coordSalary * bvgRate / 2) / 12;
    lines.push({ label: "BVG", employer: bvgEach, employee: bvgEach });
  }

  const uvgBuBase = Math.min(annualGross, CH_RATES.UVG_CEILING);
  const uvgBu = uvgBuBase * CH_RATES.UVG_BU / 12;
  lines.push({ label: "UVG BU", employer: uvgBu, employee: 0 });

  const uvgNbu = uvgBuBase * CH_RATES.UVG_NBU / 12;
  lines.push({ label: "UVG NBU", employer: 0, employee: uvgNbu });

  const ktgEach = annualGross * (CH_RATES.KTG_TOTAL / 2) / 12;
  lines.push({ label: "KTG", employer: ktgEach, employee: ktgEach });

  const fakRate = FAK_BY_CANTON[canton] ?? CH_RATES.FAK_DEFAULT;
  const fak = annualGross * fakRate / 12;
  lines.push({ label: "FAK", employer: fak, employee: 0 });

  const totalEmployer = lines.reduce((s, l) => s + l.employer, 0);
  const totalEmployee = lines.reduce((s, l) => s + l.employee, 0);
  const net = monthly - totalEmployee;

  return { lines, totalEmployer, totalEmployee, net };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function HRPage() {
  const { th, isDark, lang } = useTheme();
  const { token, user } = useAuthStore();
  const L = getTranslations(lang as LangCode);
  const gold = th.gold;
  const dimText = isDark ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.4)";
  const inputBg = isDark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.04)";

  /* ---- permissions ---- */
  const { permissionMap } = useRolesStore();
  const perms = useMemo(() => {
    const role = normalizeRole(user?.role || "");
    return resolvePermissions(role, user?.custom_permissions, permissionMap);
  }, [user, permissionMap]);

  const canView = perms.has("hr.view" as Permission);
  const canEdit = perms.has("hr.edit" as Permission);
  const canPayroll = perms.has("hr.payroll" as Permission);

  /* ---- styles ---- */
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", borderRadius: 8,
    border: `1px solid ${th.border}`, background: inputBg,
    color: th.text, fontSize: 14,
  };
  const selectStyle: React.CSSProperties = { ...inputStyle };
  const btnPrimary: React.CSSProperties = {
    padding: "8px 18px", borderRadius: 8, border: "none",
    background: gold, color: "#000", fontWeight: 600, cursor: "pointer",
  };
  const btnSecondary: React.CSSProperties = {
    padding: "8px 18px", borderRadius: 8,
    border: `1px solid ${th.border}`,
    background: isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)",
    color: th.text, fontWeight: 600, cursor: "pointer",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", marginBottom: 4, fontSize: 12, color: dimText,
  };
  const thStyle: React.CSSProperties = {
    textAlign: "left", padding: "10px 12px", fontSize: 13,
    color: dimText, borderBottom: `1px solid ${th.border}`,
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 12px", fontSize: 14,
    borderBottom: `1px solid ${th.border}`,
  };
  const cardStyle: React.CSSProperties = {
    background: isDark ? "#1e1e3a" : "#fff",
    borderRadius: 14, border: `1px solid ${th.border}`, padding: 24,
  };

  /* ---- state ---- */
  const [profiles, setProfiles] = useState<HRProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterContract, setFilterContract] = useState("");

  const [selected, setSelected] = useState<HRProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<HRProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"general" | "contract" | "social">("general");
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  /* ---- payroll month state ---- */
  const now = new Date();
  const [payrollMonth, setPayrollMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [actualHours, setActualHours] = useState(0);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [overtimeRate, setOvertimeRate] = useState(125);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const headers = useCallback(
    (): HeadersInit => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  );

  /* ---- data fetching ---- */
  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (filterDept) params.append("department", filterDept);
      if (filterContract) params.append("contract_type", filterContract);
      const res = await fetch(`${API}/api/v1/users?${params}`, {
        headers: headers(),
      });
      const json = await res.json();
      setProfiles(json.data ?? json.items ?? json ?? []);
    } catch {
      showToast("Fetch error", "err");
    } finally {
      setLoading(false);
    }
  }, [search, filterDept, filterContract, headers]);

  /* Fetch all users (lightweight) for hierarchy dropdowns */
  const fetchAllUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/users?limit=500`, { headers: headers() });
      const json = await res.json();
      const list: UserSummary[] = (json.data ?? json.items ?? json ?? []).map(
        (u: Record<string, unknown>) => ({
          id: u.id as string,
          first_name: u.first_name as string,
          last_name: u.last_name as string,
          role: u.role as string,
        })
      );
      setAllUsers(list);
    } catch { /* ignore */ }
  }, [headers]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);
  useEffect(() => { fetchAllUsers(); }, [fetchAllUsers]);

  const fetchDetail = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/v1/users/${id}`, { headers: headers() });
      const json = await res.json();
      const p = json.data ?? json;
      setSelected(p);
      setTab("general");
      setActualHours(0);
      setOvertimeHours(0);
    } catch {
      showToast("Detail error", "err");
    }
  };

  /* ---- save ---- */
  const saveProfile = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const url = `${API}/api/v1/users/${form.id}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const saved = json.data ?? json;
      setSelected(saved);
      setProfiles((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setEditing(false);
      setForm(null);
      showToast(`${saved.first_name} ${saved.last_name} saved`);
      fetchProfiles();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save error";
      showToast(msg, "err");
    } finally {
      setSaving(false);
    }
  };

  /* ---- helpers ---- */
  const closeDetail = () => {
    setSelected(null);
    setEditing(false);
    setForm(null);
    setTab("general");
  };
  const startEdit = () => {
    if (!selected) return;
    setForm({ ...selected });
    setEditing(true);
  };
  const cancelEdit = () => {
    setEditing(false);
    setForm(null);
  };
  const setField = (key: keyof HRProfile, value: string | number | null) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const fmtCHF = (v: number) =>
    new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(v);

  const panelOpen = selected !== null;

  const departments = useMemo(
    () => [...new Set(profiles.map((p) => p.department).filter(Boolean))].sort(),
    [profiles]
  );

  /* ---- hierarchy helpers ---- */
  const teamLeaders = useMemo(
    () => allUsers.filter((u) => {
      const r = u.role?.toUpperCase();
      return r === "MANAGER" || r === "LOCAL_MANAGER" || r === "ADMIN" || r === "GLOBAL_MANAGER";
    }),
    [allUsers]
  );
  const executives = useMemo(
    () => allUsers.filter((u) => {
      const r = u.role?.toUpperCase();
      return r === "ADMIN" || r === "GLOBAL_MANAGER";
    }),
    [allUsers]
  );

  const getUserName = (id: string | null): string => {
    if (!id) return "—";
    const u = allUsers.find((u) => u.id === id);
    return u ? `${u.first_name} ${u.last_name}` : id;
  };

  /* ---- monthly payslip computation ---- */
  const payslipMonthly = useMemo(() => {
    const src = editing ? form : selected;
    if (!src || !src.salary_amount) return null;

    const pensum = (src.work_pensum || 100) / 100;
    const hpw = src.hours_per_week || 42;

    let basePay: number;
    let overtimePay = 0;

    if (src.salary_type === "HOURLY") {
      const hours = actualHours > 0 ? actualHours : hpw * 4.33 * pensum;
      basePay = src.salary_amount * hours;
      overtimePay = overtimeHours * src.salary_amount * (overtimeRate / 100);
    } else {
      basePay = src.salary_amount * pensum;
      if (overtimeHours > 0) {
        const hourlyRate = (src.salary_amount * pensum) / (hpw * 4.33);
        overtimePay = overtimeHours * hourlyRate * (overtimeRate / 100);
      }
    }

    const monthlyGross = basePay + overtimePay;
    const annualGross = monthlyGross * 12;

    const today = new Date();
    const age = src.entry_date
      ? Math.max(18, today.getFullYear() - new Date(src.entry_date).getFullYear() + 25)
      : 35;

    const result = computePayslip(annualGross, age, src.canton || "ZH");

    const childCount = src.children_count || 0;
    const familyAllowance = childCount * CH_RATES.CHILD_ALLOWANCE;

    return {
      ...result,
      basePay,
      overtimePay,
      monthlyGross,
      familyAllowance,
      netPayout: result.net + familyAllowance,
    };
  }, [selected, form, editing, actualHours, overtimeHours, overtimeRate]);

  const contractLabel = (c: string) => L[c] ?? c;
  const salaryLabel = (s: string) =>
    s === "HOURLY" ? L.HOURLY_PAY : L.MONTHLY;

  const availableTabs: ("general" | "contract" | "social")[] = useMemo(() => {
    const tabs: ("general" | "contract" | "social")[] = ["general", "contract"];
    if (canPayroll) tabs.push("social");
    return tabs;
  }, [canPayroll]);

  /* ================================================================ */
  /*  ACCESS GUARD                                                     */
  /* ================================================================ */
  if (!canView) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: th.text }}>
        <h2>{L.accessDenied}</h2>
      </div>
    );
  }

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div style={{ padding: 24, color: th.text, fontFamily: "inherit" }}>
      {/* toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 9999,
          padding: "12px 24px", borderRadius: 10,
          background: toast.type === "ok" ? "#2ecc71" : "#e74c3c",
          color: "#fff", fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,.25)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* ---- LIST VIEW ---- */}
      {!panelOpen && (
        <>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12,
          }}>
            <h1 style={{ margin: 0, fontSize: 26, color: gold }}>{L.title}</h1>
            <div style={{
              padding: "10px 20px", borderRadius: 10,
              background: isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{profiles.length}</div>
              <div style={{ fontSize: 11, color: dimText }}>{L.employees}</div>
            </div>
          </div>

          {/* filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <input
              style={{ ...inputStyle, maxWidth: 260 }}
              placeholder={L.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              style={{ ...selectStyle, maxWidth: 180 }}
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
            >
              <option value="">{L.allDepts}</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              style={{ ...selectStyle, maxWidth: 180 }}
              value={filterContract}
              onChange={(e) => setFilterContract(e.target.value)}
            >
              <option value="">{L.allContracts}</option>
              <option value="PERMANENT">{L.PERMANENT}</option>
              <option value="FIXED_TERM">{L.FIXED_TERM}</option>
              <option value="HOURLY">{L.HOURLY}</option>
              <option value="APPRENTICE">{L.APPRENTICE}</option>
            </select>
          </div>

          {loading && (
            <div style={{ textAlign: "center", padding: 40, color: dimText }}>
              {L.loading}
            </div>
          )}

          {!loading && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>{L.name}</th>
                    <th style={thStyle}>{L.role}</th>
                    <th style={thStyle}>{L.department}</th>
                    <th style={thStyle}>{L.teamLeader}</th>
                    <th style={thStyle}>{L.contractType}</th>
                    <th style={thStyle}>{L.salary}</th>
                    <th style={thStyle}>{L.workPensum}</th>
                    <th style={thStyle}>{L.entryDate}</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: 30, color: dimText }}>
                        {L.noResults}
                      </td>
                    </tr>
                  )}
                  {profiles.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => fetchDetail(p.id)}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = isDark
                          ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <td style={tdStyle}>{p.first_name} {p.last_name}</td>
                      <td style={tdStyle}>{p.role}</td>
                      <td style={tdStyle}>{p.department}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, color: p.team_leader_id ? th.text : dimText }}>
                          {getUserName(p.team_leader_id)}
                        </span>
                      </td>
                      <td style={tdStyle}>{contractLabel(p.contract_type)}</td>
                      <td style={tdStyle}>
                        {fmtCHF(p.salary_amount)}{" "}
                        <span style={{ fontSize: 11, color: dimText }}>
                          {p.salary_type === "HOURLY" ? "/h" : "/Mt"}
                        </span>
                      </td>
                      <td style={tdStyle}>{p.work_pensum}%</td>
                      <td style={tdStyle}>{p.entry_date?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ---- DETAIL / EDIT PANEL ---- */}
      {panelOpen && selected && (
        <div>
          {/* toolbar */}
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10,
          }}>
            <button style={btnSecondary} onClick={closeDetail}>
              ◀ {L.back}
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              {editing ? (
                <>
                  <button style={btnPrimary} onClick={saveProfile} disabled={saving}>
                    {saving ? "…" : L.save}
                  </button>
                  <button style={btnSecondary} onClick={cancelEdit}>
                    {L.cancel}
                  </button>
                </>
              ) : (
                canEdit && (
                  <button style={btnPrimary} onClick={startEdit}>
                    {L.edit}
                  </button>
                )
              )}
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={{ margin: "0 0 18px", color: gold }}>
              {selected.first_name} {selected.last_name}
            </h2>

            {/* tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
              {availableTabs.map((k) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  style={{
                    padding: "6px 16px", borderRadius: 8,
                    border: tab === k ? `2px solid ${gold}` : `1px solid ${th.border}`,
                    background: tab === k
                      ? gold + "22"
                      : isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.03)",
                    color: tab === k ? gold : th.text,
                    fontWeight: tab === k ? 700 : 500,
                    cursor: "pointer", fontSize: 13,
                  }}
                >
                  {L[k]}
                </button>
              ))}
            </div>

            {/* ============ GENERAL TAB ============ */}
            {tab === "general" && !editing && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {([
                    ["first_name", L.name],
                    ["last_name", L.name + " (2)"],
                    ["email", "Email"],
                    ["role", L.role],
                    ["department", L.department],
                    ["nationality", L.nationality],
                    ["permit_type", L.permitType],
                    ["marital_status", L.maritalStatus],
                    ["children_count", L.children],
                    ["canton", L.canton],
                    ["ahv_number", L.ahvNumber],
                    ["iban", L.iban],
                  ] as [keyof HRProfile, string][]).map(([key, label]) => (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: dimText }}>{label}</div>
                      <div style={{ fontSize: 14, marginTop: 2 }}>
                        {String(selected[key] ?? "") || "—"}
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Hierarchy section (read-only) ── */}
                <div style={{
                  marginTop: 24, padding: 16, borderRadius: 10,
                  background: isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)",
                  border: `1px solid ${th.border}`,
                }}>
                  <h4 style={{ margin: "0 0 12px", color: gold, fontSize: 14 }}>
                    🏗️ {L.hierarchy}
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, color: dimText }}>{L.teamLeader}</div>
                      <div style={{ fontSize: 14, marginTop: 2 }}>
                        {selected.team_leader_id
                          ? getUserName(selected.team_leader_id)
                          : <span style={{ color: dimText, fontStyle: "italic" }}>{L.noTeamLeader}</span>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: dimText }}>{L.executive}</div>
                      <div style={{ fontSize: 14, marginTop: 2 }}>
                        {selected.executive_id
                          ? getUserName(selected.executive_id)
                          : <span style={{ color: dimText, fontStyle: "italic" }}>{L.noExecutive}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "general" && editing && form && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>{L.name}</label>
                    <input style={inputStyle} value={form.first_name}
                      onChange={(e) => setField("first_name", e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>{L.name} (2)</label>
                    <input style={inputStyle} value={form.last_name}
                      onChange={(e) => setField("last_name", e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>{L.nationality}</label>
                    <input style={inputStyle} value={form.nationality}
                      onChange={(e) => setField("nationality", e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>{L.permitType}</label>
                    <select style={selectStyle} value={form.permit_type}
                      onChange={(e) => setField("permit_type", e.target.value)}>
                      <option value="">—</option>
                      <option value="CH">CH</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="G">G (Grenzgänger)</option>
                      <option value="L">L</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>{L.maritalStatus}</label>
                    <input style={inputStyle} value={form.marital_status}
                      onChange={(e) => setField("marital_status", e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>{L.children}</label>
                    <input style={inputStyle} type="number" min={0} value={form.children_count}
                      onChange={(e) => setField("children_count", Number(e.target.value))} />
                  </div>
                  <div>
                    <label style={labelStyle}>{L.canton}</label>
                    <input style={inputStyle} value={form.canton}
                      onChange={(e) => setField("canton", e.target.value.toUpperCase())} />
                  </div>
                  <div>
                    <label style={labelStyle}>{L.ahvNumber}</label>
                    <input style={inputStyle} value={form.ahv_number}
                      onChange={(e) => setField("ahv_number", e.target.value)} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>{L.iban}</label>
                    <input style={inputStyle} value={form.iban}
                      onChange={(e) => setField("iban", e.target.value)} />
                  </div>
                </div>

                {/* ── Hierarchy section (edit mode) ── */}
                <div style={{
                  marginTop: 24, padding: 16, borderRadius: 10,
                  background: isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)",
                  border: `1px solid ${th.border}`,
                }}>
                  <h4 style={{ margin: "0 0 12px", color: gold, fontSize: 14 }}>
                    🏗️ {L.hierarchy}
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <label style={labelStyle}>{L.teamLeader}</label>
                      <select
                        style={selectStyle}
                        value={form.team_leader_id ?? ""}
                        onChange={(e) => setField("team_leader_id", e.target.value || null)}
                      >
                        <option value="">{L.none}</option>
                        {teamLeaders
                          .filter((tl) => tl.id !== form.id)
                          .map((tl) => (
                            <option key={tl.id} value={tl.id}>
                              {tl.first_name} {tl.last_name} ({tl.role})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>{L.executive}</label>
                      <select
                        style={selectStyle}
                        value={form.executive_id ?? ""}
                        onChange={(e) => setField("executive_id", e.target.value || null)}
                      >
                        <option value="">{L.none}</option>
                        {executives
                          .filter((ex) => ex.id !== form.id)
                          .map((ex) => (
                            <option key={ex.id} value={ex.id}>
                              {ex.first_name} {ex.last_name} ({ex.role})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============ CONTRACT TAB ============ */}
            {tab === "contract" && !editing && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {([
                  ["entry_date", L.entryDate],
                  ["exit_date", L.exitDate],
                  ["contract_type", L.contractType],
                  ["salary_type", L.salaryType],
                  ["salary_amount", L.salary],
                  ["work_pensum", L.workPensum],
                  ["hours_per_week", L.hoursPerWeek],
                  ["bvg_code", L.bvgCode],
                ] as [keyof HRProfile, string][]).map(([key, label]) => {
                  let display = String(selected[key] ?? "") || "—";
                  if (key === "contract_type") display = contractLabel(selected.contract_type);
                  if (key === "salary_type") display = salaryLabel(selected.salary_type);
                  if (key === "salary_amount") display = fmtCHF(selected.salary_amount) +
                    (selected.salary_type === "HOURLY" ? " /h" : " /Mt");
                  if (key === "work_pensum") display = `${selected.work_pensum}%`;
                  return (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: dimText }}>{label}</div>
                      <div style={{ fontSize: 14, marginTop: 2 }}>{display}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "contract" && editing && form && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={labelStyle}>{L.entryDate}</label>
                  <input style={inputStyle} type="date" value={form.entry_date?.slice(0, 10)}
                    onChange={(e) => setField("entry_date", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{L.exitDate}</label>
                  <input style={inputStyle} type="date" value={form.exit_date?.slice(0, 10) ?? ""}
                    onChange={(e) => setField("exit_date", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{L.contractType}</label>
                  <select style={selectStyle} value={form.contract_type}
                    onChange={(e) => setField("contract_type", e.target.value)}>
                    <option value="PERMANENT">{L.PERMANENT}</option>
                    <option value="FIXED_TERM">{L.FIXED_TERM}</option>
                    <option value="HOURLY">{L.HOURLY}</option>
                    <option value="APPRENTICE">{L.APPRENTICE}</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{L.salaryType}</label>
                  <select style={selectStyle} value={form.salary_type}
                    onChange={(e) => setField("salary_type", e.target.value)}>
                    <option value="MONTHLY">{L.MONTHLY}</option>
                    <option value="HOURLY">{L.HOURLY_PAY}</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>
                    {L.salary} ({form.salary_type === "HOURLY" ? "CHF/h" : "CHF/Mt"})
                  </label>
                  <input style={inputStyle} type="number" step="0.05" min={0}
                    value={form.salary_amount}
                    onChange={(e) => setField("salary_amount", Number(e.target.value))} />
                </div>
                <div>
                  <label style={labelStyle}>{L.workPensum} (%)</label>
                  <input style={inputStyle} type="number" min={0} max={100}
                    value={form.work_pensum}
                    onChange={(e) => setField("work_pensum", Number(e.target.value))} />
                </div>
                <div>
                  <label style={labelStyle}>{L.hoursPerWeek}</label>
                  <input style={inputStyle} type="number" step="0.5" min={0}
                    value={form.hours_per_week}
                    onChange={(e) => setField("hours_per_week", Number(e.target.value))} />
                </div>
                <div>
                  <label style={labelStyle}>{L.bvgCode}</label>
                  <input style={inputStyle} value={form.bvg_code}
                    onChange={(e) => setField("bvg_code", e.target.value)} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>{L.notes}</label>
                  <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                    value={form.notes}
                    onChange={(e) => setField("notes", e.target.value)} />
                </div>
              </div>
            )}

            {/* ============ SOCIAL / PAYROLL TAB ============ */}
            {tab === "social" && canPayroll && (
              <div>
                <h3 style={{ margin: "0 0 16px", color: gold }}>{L.simulate}</h3>

                {/* Month picker + hours inputs */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <div>
                    <label style={labelStyle}>{L.payrollMonth}</label>
                    <input style={inputStyle} type="month"
                      value={payrollMonth}
                      onChange={(e) => setPayrollMonth(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>{L.actualHours}</label>
                    <input style={inputStyle} type="number" step="0.5" min={0}
                      value={actualHours}
                      onChange={(e) => setActualHours(Number(e.target.value))}
                      placeholder="0 = auto" />
                  </div>
                  <div>
                    <label style={labelStyle}>{L.overtimeHours}</label>
                    <input style={inputStyle} type="number" step="0.5" min={0}
                      value={overtimeHours}
                      onChange={(e) => setOvertimeHours(Number(e.target.value))} />
                  </div>
                  <div>
                    <label style={labelStyle}>{L.overtimeRate} (%)</label>
                    <input style={inputStyle} type="number" step="5" min={100} max={200}
                      value={overtimeRate}
                      onChange={(e) => setOvertimeRate(Number(e.target.value))} />
                  </div>
                </div>

                {payslipMonthly && (
                  <>
                    {/* Summary cards */}
                    <div style={{
                      display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14,
                      marginBottom: 20,
                    }}>
                      <div style={{
                        padding: "14px 16px", borderRadius: 10,
                        background: isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)",
                        textAlign: "center",
                      }}>
                        <div style={{ fontSize: 11, color: dimText }}>{L.baseSalary}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                          {fmtCHF(payslipMonthly.basePay)}
                        </div>
                      </div>
                      <div style={{
                        padding: "14px 16px", borderRadius: 10,
                        background: overtimeHours > 0
                          ? (isDark ? "rgba(243,156,18,.12)" : "rgba(243,156,18,.08)")
                          : (isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"),
                        textAlign: "center",
                      }}>
                        <div style={{ fontSize: 11, color: overtimeHours > 0 ? "#f39c12" : dimText }}>{L.overtime}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: overtimeHours > 0 ? "#f39c12" : th.text }}>
                          {fmtCHF(payslipMonthly.overtimePay)}
                        </div>
                      </div>
                      <div style={{
                        padding: "14px 16px", borderRadius: 10,
                        background: isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)",
                        textAlign: "center",
                      }}>
                        <div style={{ fontSize: 11, color: dimText }}>{L.grossSalary}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                          {fmtCHF(payslipMonthly.monthlyGross)}
                        </div>
                      </div>
                      <div style={{
                        padding: "14px 16px", borderRadius: 10,
                        background: "#2ecc7122", textAlign: "center",
                      }}>
                        <div style={{ fontSize: 11, color: "#2ecc71" }}>{L.netPayout}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#2ecc71", marginTop: 4 }}>
                          {fmtCHF(payslipMonthly.netPayout)}
                        </div>
                      </div>
                    </div>

                    {/* Family allowances */}
                    {payslipMonthly.familyAllowance > 0 && (
                      <div style={{
                        padding: "12px 16px", borderRadius: 10, marginBottom: 16,
                        background: isDark ? "rgba(78,205,196,.08)" : "rgba(78,205,196,.06)",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}>
                        <span style={{ fontSize: 13, color: "#4ecdc4", fontWeight: 600 }}>
                          {L.familyAllowance} ({selected?.children_count} × CHF {CH_RATES.CHILD_ALLOWANCE})
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "#4ecdc4" }}>
                          + {fmtCHF(payslipMonthly.familyAllowance)}
                        </span>
                      </div>
                    )}

                    {/* Breakdown table */}
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>{L.contribution}</th>
                          <th style={{ ...thStyle, textAlign: "right" }}>{L.employerShare}</th>
                          <th style={{ ...thStyle, textAlign: "right" }}>{L.employeeShare}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payslipMonthly.lines.map((line, i) => (
                          <tr key={i}>
                            <td style={tdStyle}>{line.label}</td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              {line.employer > 0 ? fmtCHF(line.employer) : "—"}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              {line.employee > 0 ? fmtCHF(line.employee) : "—"}
                            </td>
                          </tr>
                        ))}
                        <tr style={{ fontWeight: 700 }}>
                          <td style={tdStyle}>{L.totalDeductions}</td>
                          <td style={{ ...tdStyle, textAlign: "right", color: gold }}>
                            {fmtCHF(payslipMonthly.totalEmployer)}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", color: "#e74c3c" }}>
                            {fmtCHF(payslipMonthly.totalEmployee)}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Employer total cost */}
                    <div style={{
                      marginTop: 16, padding: 14, borderRadius: 10,
                      background: gold + "18",
                      display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 12,
                    }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: gold }}>{L.totalEmployerCost} ({L.monthly})</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: gold }}>
                          {fmtCHF(payslipMonthly.monthlyGross + payslipMonthly.totalEmployer)}
                        </div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: dimText }}>{L.annual} — {L.grossSalary}</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>
                          {fmtCHF(payslipMonthly.monthlyGross * 12)}
                        </div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "#2ecc71" }}>{L.annual} — {L.netPayout}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#2ecc71" }}>
                          {fmtCHF(payslipMonthly.netPayout * 12)}
                        </div>
                      </div>
                    </div>

                    {/* Print button */}
                    <div style={{ marginTop: 20, textAlign: "right" }}>
                      <button style={btnPrimary} onClick={() => window.print()}>
                        🖨️ {L.printPayslip}
                      </button>
                    </div>
                  </>
                )}

                {!payslipMonthly && (
                  <p style={{ color: dimText }}>
                    {L.salary}: —
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
