// shared/constants/roles.ts

/* ------------------------------------------------------------------ */
/*  Built-in roles (used as DB seed + fallback)                        */
/* ------------------------------------------------------------------ */
export const BUILT_IN_ROLES = [
  "CEO", "ADMIN", "MANAGER", "HR", "FINANCE", "SALES", "EMPLOYEE",
] as const;

export type BuiltInRole = (typeof BUILT_IN_ROLES)[number];

/** Runtime role = any string. Built-in ones are type-safe, custom ones are dynamic. */
export type Role = BuiltInRole | (string & {});

/** Hierarchy level: higher number = more authority */
export const ROLE_HIERARCHY: Record<string, number> = {
  CEO:      100,
  ADMIN:    80,
  MANAGER:  60,
  HR:       50,
  FINANCE:  50,
  SALES:    50,
  EMPLOYEE: 10,
};

export function getRoleLevel(role: string): number {
  return ROLE_HIERARCHY[role] ?? 0;
}

export function isRoleAbove(a: string, b: string): boolean {
  return getRoleLevel(a) > getRoleLevel(b);
}

export const ROLE_LABELS: Record<string, Record<string, string>> = {
  de: {
    CEO:      "Geschäftsleitung (CEO)",
    ADMIN:    "Geschäftsführer",
    MANAGER:  "Teamleiter",
    HR:       "Personal (HR)",
    FINANCE:  "Finanzen",
    SALES:    "Verkauf",
    EMPLOYEE: "Mitarbeiter",
  },
  en: {
    CEO:      "Chief Executive Officer",
    ADMIN:    "Executive",
    MANAGER:  "Team Leader",
    HR:       "Human Resources",
    FINANCE:  "Finance",
    SALES:    "Sales",
    EMPLOYEE: "Employee",
  },
  fr: {
    CEO:      "Directeur Général (CEO)",
    ADMIN:    "Direction",
    MANAGER:  "Chef d'équipe",
    HR:       "Ressources humaines",
    FINANCE:  "Finances",
    SALES:    "Ventes",
    EMPLOYEE: "Employé",
  },
  pt: {
    CEO:      "Diretor Executivo (CEO)",
    ADMIN:    "Diretor",
    MANAGER:  "Líder de equipa",
    HR:       "Recursos Humanos",
    FINANCE:  "Finanças",
    SALES:    "Vendas",
    EMPLOYEE: "Funcionário",
  },
  nl: {
    CEO:      "Algemeen Directeur (CEO)",
    ADMIN:    "Directeur",
    MANAGER:  "Teamleider",
    HR:       "Personeelszaken",
    FINANCE:  "Financiën",
    SALES:    "Verkoop",
    EMPLOYEE: "Medewerker",
  },
  it: {
    CEO:      "Amministratore Delegato (CEO)",
    ADMIN:    "Dirigente",
    MANAGER:  "Caposquadra",
    HR:       "Risorse Umane",
    FINANCE:  "Finanza",
    SALES:    "Vendite",
    EMPLOYEE: "Dipendente",
  },
  es: {
    CEO:      "Director Ejecutivo (CEO)",
    ADMIN:    "Director",
    MANAGER:  "Líder de Equipo",
    HR:       "Recursos Humanos",
    FINANCE:  "Finanzas",
    SALES:    "Ventas",
    EMPLOYEE: "Empleado",
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
  "ceo.dashboard", "ceo.org", "ceo.settings",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/* ------------------------------------------------------------------ */
/*  Default permission matrix — seed values for built-in roles         */
/* ------------------------------------------------------------------ */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  CEO: [...PERMISSIONS],   // CEO has every permission

  ADMIN: [
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
    // ADMIN does NOT get ceo.* permissions
  ],

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
/* ------------------------------------------------------------------ */
export function resolvePermissions(
  role: Role,
  customPermissions?: { add?: Permission[]; remove?: Permission[] } | null,
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
