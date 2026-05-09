// shared/constants/roles.ts

/* ------------------------------------------------------------------ */
/*  Roles                                                              */
/* ------------------------------------------------------------------ */
export const ROLES = [
  "ADMIN",          // Executive / Global Manager
  "MANAGER",        // Team Leader / Local Admin
  "HR",             // Human Resources
  "FINANCE",        // Finance / Accounting
  "SALES",          // Sales / Commercial
  "EMPLOYEE",       // Worker
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<string, Record<Role, string>> = {
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
  // Schedule
  "schedule.view",
  "schedule.edit",
  // Customers
  "customers.view",
  "customers.edit",
  "customers.delete",
  // Machines
  "machines.view",
  "machines.edit",
  "machines.delete",
  // Tasks
  "tasks.view",
  "tasks.edit",
  "tasks.delete",
  // Quotations
  "quotations.view",
  "quotations.edit",
  "quotations.delete",
  // Invoices
  "invoices.view",
  "invoices.edit",
  "invoices.delete",
  // HR
  "hr.view",
  "hr.edit",
  "hr.payroll",
  // Finance
  "finance.view",
  "finance.reports",
  // Admin
  "admin.users",
  "admin.roles",
  // Reports
  "reports.own",
  "reports.team",
  "reports.all",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/* ------------------------------------------------------------------ */
/*  Default permission matrix — each role gets these by default        */
/*  Can be overridden per user                                         */
/* ------------------------------------------------------------------ */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [...PERMISSIONS], // everything

  MANAGER: [
    "schedule.view", "schedule.edit",
    "customers.view", "customers.edit",
    "machines.view", "machines.edit",
    "tasks.view", "tasks.edit",
    "quotations.view", "quotations.edit",
    "invoices.view",
    "hr.view",
    "reports.own", "reports.team",
  ],

  HR: [
    "schedule.view",
    "customers.view",
    "hr.view", "hr.edit", "hr.payroll",
    "reports.own", "reports.team", "reports.all",
    "admin.users",
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
/*  Helper: resolve effective permissions for a user                   */
/*  user.role gives the defaults, user.custom_permissions overrides    */
/* ------------------------------------------------------------------ */
export function resolvePermissions(
  role: Role,
  customPermissions?: { add?: Permission[]; remove?: Permission[] }
): Set<Permission> {
  const base = new Set(DEFAULT_ROLE_PERMISSIONS[role] ?? []);
  if (customPermissions?.add) {
    for (const p of customPermissions.add) base.add(p);
  }
  if (customPermissions?.remove) {
    for (const p of customPermissions.remove) base.delete(p);
  }
  return base;
}
