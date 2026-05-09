// src/components/RolePermissionMatrix.tsx
import React, { useState, useEffect } from "react";
import { useTheme } from "../contexts/themeContext";
import {
  BUILT_IN_ROLES,
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  type Role,
  type Permission,
} from "../../../shared/constants/roles";

interface Props {
  /** user being edited — if provided, shows per-user overrides column */
  userId?: string;
  userRole?: Role;
  userCustomAdd?: Permission[];
  userCustomRemove?: Permission[];
  onChangeCustom?: (add: Permission[], remove: Permission[]) => void;
  readOnly?: boolean;
}

const PERM_GROUPS: Record<string, Permission[]> = {
  Schedule: ["schedule.view", "schedule.edit"],
  Customers: ["customers.view", "customers.edit", "customers.delete"],
  Machines: ["machines.view", "machines.edit", "machines.delete"],
  Tasks: ["tasks.view", "tasks.edit", "tasks.delete"],
  Quotations: ["quotations.view", "quotations.edit", "quotations.delete"],
  Invoices: ["invoices.view", "invoices.edit", "invoices.delete"],
  HR: ["hr.view", "hr.edit", "hr.payroll"],
  Finance: ["finance.view", "finance.reports"],
  Admin: ["admin.users", "admin.roles"],
  Reports: ["reports.own", "reports.team", "reports.all"],
};

export function RolePermissionMatrix({
  userId,
  userRole,
  userCustomAdd = [],
  userCustomRemove = [],
  onChangeCustom,
  readOnly = false,
}: Props) {
  const { th, isDark } = useTheme();
  const gold = th.gold;
  const dimText = isDark ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.4)";

  const [localAdd, setLocalAdd] = useState<Permission[]>(userCustomAdd);
  const [localRemove, setLocalRemove] = useState<Permission[]>(userCustomRemove);

  useEffect(() => {
    setLocalAdd(userCustomAdd);
    setLocalRemove(userCustomRemove);
  }, [userCustomAdd, userCustomRemove]);

  const toggleUserPerm = (perm: Permission) => {
    if (readOnly || !userRole) return;
    const roleHas = DEFAULT_ROLE_PERMISSIONS[userRole]?.includes(perm);

    let newAdd = [...localAdd];
    let newRemove = [...localRemove];

    if (roleHas) {
      // role gives it by default — toggle means remove override
      if (newRemove.includes(perm)) {
        newRemove = newRemove.filter((p) => p !== perm);
      } else {
        newRemove.push(perm);
        newAdd = newAdd.filter((p) => p !== perm);
      }
    } else {
      // role doesn't give it — toggle means add override
      if (newAdd.includes(perm)) {
        newAdd = newAdd.filter((p) => p !== perm);
      } else {
        newAdd.push(perm);
        newRemove = newRemove.filter((p) => p !== perm);
      }
    }

    setLocalAdd(newAdd);
    setLocalRemove(newRemove);
    onChangeCustom?.(newAdd, newRemove);
  };

  const cellStyle: React.CSSProperties = {
    padding: "4px 8px",
    textAlign: "center",
    borderBottom: `1px solid ${th.border}`,
    fontSize: 13,
  };
  const headerCell: React.CSSProperties = {
    ...cellStyle,
    fontWeight: 700,
    fontSize: 11,
    color: dimText,
    whiteSpace: "nowrap",
  };

  const isEffectivelyOn = (perm: Permission): boolean => {
    if (!userRole) return false;
    const roleHas = DEFAULT_ROLE_PERMISSIONS[userRole]?.includes(perm);
    if (localRemove.includes(perm)) return false;
    if (localAdd.includes(perm)) return true;
    return !!roleHas;
  };

  const isOverridden = (perm: Permission): boolean =>
    localAdd.includes(perm) || localRemove.includes(perm);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ ...headerCell, textAlign: "left", minWidth: 160 }}>Permission</th>
            {BUILT_IN_ROLES.map((r) => (
              <th key={r} style={headerCell}>{r}</th>
            ))}
            {userId && userRole && (
              <th style={{ ...headerCell, color: gold }}>
                User Override
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {Object.entries(PERM_GROUPS).map(([group, perms]) => (
            <React.Fragment key={group}>
              {/* group header */}
              <tr>
                <td
                  colSpan={BUILT_IN_ROLES.length + 1 + (userId ? 1 : 0)}
                  style={{
                    padding: "8px 8px 4px",
                    fontWeight: 700,
                    fontSize: 12,
                    color: gold,
                    borderBottom: `1px solid ${th.border}`,
                  }}
                >
                  {group}
                </td>
              </tr>
              {perms.map((perm) => (
                <tr key={perm}>
                  <td style={{ ...cellStyle, textAlign: "left", color: th.text }}>
                    {perm.split(".")[1]}
                  </td>
                  {BUILT_IN_ROLES.map((r) => {
                    const has = DEFAULT_ROLE_PERMISSIONS[r]?.includes(perm);
                    return (
                      <td key={r} style={cellStyle}>
                        <span style={{
                          display: "inline-block",
                          width: 18, height: 18, borderRadius: 4,
                          background: has ? "#2ecc71" : isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)",
                          color: has ? "#fff" : "transparent",
                          fontSize: 12, lineHeight: "18px", textAlign: "center",
                        }}>
                          ✓
                        </span>
                      </td>
                    );
                  })}
                  {userId && userRole && (
                    <td style={cellStyle}>
                      <button
                        onClick={() => toggleUserPerm(perm)}
                        disabled={readOnly}
                        style={{
                          width: 22, height: 22, borderRadius: 4,
                          border: isOverridden(perm)
                            ? `2px solid ${gold}`
                            : `1px solid ${th.border}`,
                          background: isEffectivelyOn(perm)
                            ? "#2ecc71"
                            : isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)",
                          color: isEffectivelyOn(perm) ? "#fff" : "transparent",
                          cursor: readOnly ? "default" : "pointer",
                          fontSize: 12, lineHeight: "20px",
                        }}
                      >
                        ✓
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}