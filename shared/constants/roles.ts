// shared/constants/roles.ts

/* ------------------------------------------------------------------ */
/*  Built-in roles (used as DB seed + fallback)                        */
/* ------------------------------------------------------------------ */
export const BUILT_IN_ROLES = [
  "ADMIN", "MANAGER", "HR", "FINANCE", "SALES", "EMPLOYEE",
] as const;

export type BuiltInRole = (typeof BUILT_IN_ROLES)[number];

/** Runtime role = any string. Built-in ones are type-safe, custom ones are dynamic. */
export type Role = BuiltInRole | (string & {});

export const ROLE_LABELS: Record<string, Record<string, string>> = {
  de: {
    ADMIN:    "Geschäftsführer",
    MANAGER:  "Teamleiter",
    HR:       "Personal (HR)",
    FINANCE:  "Finanzen",
    SALES:    "Verkauf",
    EMPLOYEE: "Mitarbeiter",
  },
  en: {
    ADMIN:    "Executive",
    MANAGER:  "Team Leader",
    HR:       "Human Resources",
    FINANCE:  "Finance",
    SALES:    "Sales",
    EMPLOYEE: "Employee",
  },
  fr: {
    ADMIN:    "Direction",
    MANAGER:  "Chef d'équipe",
    HR:       "Ressources humaines",
    FINANCE:  "Finances",
    SALES:    "Ventes",
    EMPLOYEE: "Employé",
  },
  pt: {
    ADMIN:    "Diretor",
    MANAGER:  "Líder de equipa",
    HR:       "Recursos Humanos",
    FINANCE:  "Finanças",
    SALES:    "Vendas",
    EMPLOYEE: "Funcionário",
  },
};

/* ------------------------------------------------------------------ */
/*  Permissions — every action in the system                           */
/* ------------------------------------------------------------------ */
export const PERMISSIONS = [
  "schedule.view", "schedule.edit",
  "customers.view", "customers.edit", "customers.delete",
  "machines.view", "machines.edit", "machines.delete",
  "tasks.view", "tasks.edit", "tasks.delete",
  "quotations.view", "quotations.edit", "quotations.delete",
  "invoices.view", "invoices.edit", "invoices.delete",
  "hr.view", "hr.edit", "hr.payroll",
  "finance.view", "finance.reports",
  "admin.view", "admin.users", "admin.roles",
  "admin.customers", "admin.machines", "admin.tasks",
  "reports.own", "reports.team", "reports.all",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/* ------------------------------------------------------------------ */
/*  Default permission matrix — seed values for built-in roles         */
/*  At runtime, the actual matrix comes from the DB via                */
/*  GET /api/v1/settings/roles                                         */
/* ------------------------------------------------------------------ */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: [...PERMISSIONS],

  MANAGER: [
    "schedule.view", "schedule.edit",
    "customers.view", "customers.edit",
    "machines.view", "machines.edit",
    "tasks.view", "tasks.edit",
    "quotations.view", "quotations.edit",
    "invoices.view",
    "hr.view",
    "admin.view",
    "reports.own", "reports.team",
  ],

  HR: [
    "schedule.view",
    "customers.view",
    "hr.view", "hr.edit", "hr.payroll",
    "reports.own", "reports.team", "reports.all",
    "admin.view", "admin.users",
  ],

  FINANCE: [
    "customers.view",
    "quotations.view",
    "invoices.view", "invoices.edit",
    "finance.view", "finance.reports",
    "hr.view", "hr.payroll",
    "reports.own", "reports.all",
  ],

  SALES: [
    "schedule.view",
    "customers.view", "customers.edit",
    "tasks.view",
    "quotations.view", "quotations.edit",
    "invoices.view", "invoices.edit",
    "reports.own",
  ],

  EMPLOYEE: [
    "schedule.view",
    "tasks.view",
    "machines.view",
    "reports.own",
  ],
};

/* ------------------------------------------------------------------ */
/*  Resolve effective permissions for a user                           */
/*  rolePermissions = live map from DB (falls back to defaults)        */
/* ------------------------------------------------------------------ */
export function resolvePermissions(
  role: Role,
  customPermissions?: { add?: Permission[]; remove?: Permission[] } | null,
  /** Pass the live role→permissions map from the DB when available */
  liveRolePermissions?: Record<string, Permission[]>,
): Set<Permission> {
  const source = liveRolePermissions ?? DEFAULT_ROLE_PERMISSIONS;
  const base = new Set<Permission>(source[role] ?? []);
  if (customPermissions?.add) {
    for (const p of customPermissions.add) base.add(p);
  }
  if (customPermissions?.remove) {
    for (const p of customPermissions.remove) base.delete(p);
  }
  return base;
}
