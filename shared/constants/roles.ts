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

export function getHierarchyField(role: string): string | null {
  const r = (role || '').toUpperCase();
  if (r === 'CEO') return null;
  if (r === 'ADMIN') return 'ceo_id';
  if (r === 'MANAGER') return 'executive_id';
  return 'team_leader_id';
}

export function getRoleTier(role: string): number {
  switch (role) {
    case 'CEO': return 4;
    case 'ADMIN': case 'GLOBAL_MANAGER': return 3;
    case 'HR': case 'FINANCE': case 'SALES': return 3;
    case 'MANAGER': case 'LOCAL_MANAGER': return 2;
    default: return 1;
  }
}

export function getViewTier(role: string): 'ceo' | 'executive' | 'teamleader' | 'employee' {
  switch (role) {
    case 'CEO': return 'ceo';
    case 'ADMIN': case 'GLOBAL_MANAGER':
    case 'HR': case 'FINANCE': case 'SALES':
      return 'executive';
    case 'MANAGER': case 'LOCAL_MANAGER':
      return 'teamleader';
    default: return 'employee';
  }
}

export interface NavAccess {
  schedule: boolean;
  machines: boolean;
  tasks: boolean;
  customers: boolean;
  quotations: boolean;
  invoices: boolean;
  crm: boolean;
  myWeek: boolean;
  stats: boolean;
  hr: boolean;
  admin: boolean;
  settings: boolean;
  profile: boolean;
  logistics: boolean;
}

export function getNavAccess(
  role: string,
  departments: string[] = []
): NavAccess {
  const tier = getViewTier(role);
  const operational = isOperational(departments);
  const isHR = departments.includes('HR');
  const isFinance = departments.includes('FINANCE');
  const r = (role || '').toUpperCase();

  return {
    schedule:
      r !== 'SALES' && r !== 'HR' && r !== 'FINANCE' && (
        tier === 'ceo' ||
        (tier === 'executive' && operational) ||
        (tier === 'teamleader' && operational)
      ),

    machines:
      r !== 'SALES' && r !== 'HR' && r !== 'FINANCE' && (
        tier === 'ceo' ||
        (tier === 'executive' && operational) ||
        (tier === 'teamleader' && operational)
      ),

    tasks:
      r !== 'SALES' && r !== 'HR' && r !== 'FINANCE' && (
        tier === 'ceo' ||
        (tier === 'executive' && operational) ||
        (tier === 'teamleader' && operational)
      ),

    customers:
      tier === 'ceo' || tier === 'executive' || tier === 'teamleader',

    quotations:
      r !== 'HR' && r !== 'FINANCE' && (
        tier === 'ceo' || tier === 'executive' || tier === 'teamleader'
      ),

    invoices:
      r !== 'SALES' && (
        tier === 'ceo' || isFinance || r === 'ADMIN' || r === 'GLOBAL_MANAGER'
      ),

    crm:
      r === 'SALES' || r === 'CEO' || r === 'ADMIN' || r === 'GLOBAL_MANAGER',

    myWeek:
      tier === 'employee' ||
      (tier === 'teamleader' && operational),

    stats: true,

    hr: tier === 'ceo' || isHR,

    admin: tier === 'ceo' || tier === 'executive',
    settings: tier === 'ceo' || tier === 'executive',

    profile: true,
    logistics: tier === 'ceo' || (tier === 'executive' && operational) || (tier === 'teamleader' && operational) || (tier === 'employee' && operational),
  };
}

// Stats view mode per role
export type StatsViewMode = 'global' | 'perimeter' | 'team' | 'individual';

export function getStatsViewMode(role: string): StatsViewMode {
  switch (getViewTier(role)) {
    case 'ceo': return 'global';
    case 'executive': return 'perimeter';
    case 'teamleader': return 'team';
    default: return 'individual';
  }
}

// Schedule scope per role
export type ScheduleScope = 'all' | 'team' | 'personal' | 'none';

export function getScheduleScope(role: string, departments: string[]): ScheduleScope {
  const tier = getViewTier(role);
  const operational = isOperational(departments);

  if (tier === 'ceo') return 'all';
  if (tier === 'executive' && operational) return 'all';
  if (tier === 'teamleader' && operational) return 'team';
  return 'none';
}

export function getRoleLevel(role: string): number {
  return ROLE_HIERARCHY[role] ?? 0;
}

export function isRoleAbove(a: string, b: string): boolean {
  return getRoleLevel(a) > getRoleLevel(b);
}

export const ROLE_LABELS: Record<string, Record<string, string>> = {
  de: {
    CEO: "Geschäftsleitung (CEO)", ADMIN: "Geschäftsführer", MANAGER: "Teamleiter",
    HR: "Personal (HR)", FINANCE: "Finanzen", SALES: "Verkauf", EMPLOYEE: "Mitarbeiter",
  },
  en: {
    CEO: "Chief Executive Officer", ADMIN: "Executive", MANAGER: "Team Leader",
    HR: "Human Resources", FINANCE: "Finance", SALES: "Sales", EMPLOYEE: "Employee",
  },
  fr: {
    CEO: "Directeur Général (CEO)", ADMIN: "Direction", MANAGER: "Chef d'équipe",
    HR: "Ressources humaines", FINANCE: "Finances", SALES: "Ventes", EMPLOYEE: "Employé",
  },
  pt: {
    CEO: "Diretor Executivo (CEO)", ADMIN: "Diretor", MANAGER: "Líder de equipa",
    HR: "Recursos Humanos", FINANCE: "Finanças", SALES: "Vendas", EMPLOYEE: "Funcionário",
  },
  nl: {
    CEO: "Algemeen Directeur (CEO)", ADMIN: "Directeur", MANAGER: "Teamleider",
    HR: "Personeelszaken", FINANCE: "Financiën", SALES: "Verkoop", EMPLOYEE: "Medewerker",
  },
  it: {
    CEO: "Amministratore Delegato (CEO)", ADMIN: "Dirigente", MANAGER: "Caposquadra",
    HR: "Risorse Umane", FINANCE: "Finanza", SALES: "Vendite", EMPLOYEE: "Dipendente",
  },
  es: {
    CEO: "Director Ejecutivo (CEO)", ADMIN: "Director", MANAGER: "Líder de Equipo",
    HR: "Recursos Humanos", FINANCE: "Finanzas", SALES: "Ventas", EMPLOYEE: "Empleado",
  },
};

/* ------------------------------------------------------------------ */
/*  Permissions                                                        */
/* ------------------------------------------------------------------ */

/**
 * ★ UPDATED: Added granular logistics permissions for the new module tabs:
 *   - logistics.sell      → record SALE transactions
 *   - logistics.pricing   → manage margin rules / pricing tab
 *   - logistics.alerts    → manage / resolve alerts
 *   - logistics.import    → CSV import of spare parts
 *   - logistics.inventory → perform inventory counts
 */
export const PERMISSIONS = [
  // Schedule
  "schedule.view", "schedule.edit",
  "schedule.view.all", "schedule.view.team",

  // Customers
  "customers.view", "customers.edit", "customers.delete",
  "customers.view.all", "customers.view.team",

  // Machines
  "machines.view", "machines.edit", "machines.delete",
  "machines.view.all", "machines.view.team",

  // Tasks
  "tasks.view", "tasks.edit", "tasks.delete",
  "tasks.view.all", "tasks.view.team",

  // Quotations
  "quotations.view", "quotations.edit", "quotations.delete",
  "quotations.view.all", "quotations.view.team",

  // Invoices
  "invoices.view", "invoices.edit", "invoices.delete",
  "invoices.view.all", "invoices.view.finance",

  // HR
  "hr.view", "hr.edit", "hr.payroll", "hr.access",

  // Finance
  "finance.view", "finance.reports",

  // Admin
  "admin.view", "admin.users", "admin.roles",
  "admin.customers", "admin.machines", "admin.tasks",
  "admin.access",

  // Reports
  "reports.own", "reports.team", "reports.all",

  // CEO
  "ceo.dashboard", "ceo.org", "ceo.settings",

  // Stats
  "stats.global", "stats.perimeter", "stats.team", "stats.individual",

  // My Week
  "myweek.view",

  // Profile
  "profile.view",

  // CRM
  "crm.view", "crm.edit", "crm.delete", "crm.pipeline", "crm.performance",

  // Logistics (★ expanded)
  "logistics.view",
  "logistics.edit",
  "logistics.delete",
  "logistics.consume",
  "logistics.sell",
  "logistics.pricing",
  "logistics.alerts",
  "logistics.import",
  "logistics.inventory",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export const NON_OPERATIONAL_ROLES = ['HR', 'FINANCE'] as const;

export function isOperational(userDepartments: string[]): boolean {
  const nonOp = new Set(['HR', 'FINANCE']);
  return userDepartments.some(d => !nonOp.has(d));
}

/* ------------------------------------------------------------------ */
/*  Default permission matrix                                          */
/* ------------------------------------------------------------------ */

/**
 * ★ UPDATED: Each role now has the appropriate logistics sub-permissions
 *   matching the logistics tab structure (dashboard, maintenance, consumables,
 *   alerts, transactions, inventory, pricing).
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  CEO: [...PERMISSIONS],

  ADMIN: [
    "schedule.view", "schedule.edit",
    "schedule.view.all",
    "customers.view", "customers.edit", "customers.delete",
    "customers.view.all",
    "machines.view", "machines.edit", "machines.delete",
    "machines.view.all",
    "tasks.view", "tasks.edit", "tasks.delete",
    "tasks.view.all",
    "quotations.view", "quotations.edit", "quotations.delete",
    "quotations.view.all",
    "invoices.view", "invoices.edit", "invoices.delete",
    "invoices.view.all",
    "hr.view", "hr.edit", "hr.payroll", "hr.access",
    "finance.view", "finance.reports",
    "admin.view", "admin.users", "admin.roles",
    "admin.customers", "admin.machines", "admin.tasks",
    "admin.access",
    "reports.own", "reports.team", "reports.all",
    "crm.view", "crm.edit", "crm.pipeline", "crm.performance",
    "stats.global", "stats.perimeter",
    "profile.view",
    // ★ Logistics — full access
    "logistics.view", "logistics.edit", "logistics.delete", "logistics.consume",
    "logistics.sell", "logistics.pricing", "logistics.alerts",
    "logistics.import", "logistics.inventory",
  ],

  MANAGER: [
    "schedule.view", "schedule.edit",
    "schedule.view.team",
    "customers.view", "customers.edit",
    "customers.view.team",
    "machines.view", "machines.edit",
    "machines.view.team",
    "tasks.view", "tasks.edit",
    "tasks.view.team",
    "quotations.view", "quotations.edit",
    "quotations.view.team",
    "invoices.view",
    "hr.view",
    "admin.view",
    "reports.own", "reports.team",
    "stats.team",
    "myweek.view",
    "profile.view",
    // ★ Logistics — can manage parts, consume, sell, run inventory, handle alerts
    "logistics.view", "logistics.edit", "logistics.consume",
    "logistics.sell", "logistics.alerts", "logistics.inventory",
  ],

  HR: [
    "customers.view",
    "hr.view", "hr.edit", "hr.payroll", "hr.access",
    "reports.own", "reports.team", "reports.all",
    "admin.view", "admin.users",
    "stats.perimeter",
    "profile.view",
  ],

  FINANCE: [
    "customers.view",
    "quotations.view",
    "invoices.view", "invoices.edit",
    "invoices.view.finance",
    "finance.view", "finance.reports",
    "hr.view", "hr.payroll",
    "reports.own", "reports.all",
    "stats.perimeter",
    "profile.view",
  ],

  SALES: [
    "customers.view", "customers.edit",
    "quotations.view", "quotations.edit",
    "reports.own",
    "crm.view", "crm.edit", "crm.pipeline", "crm.performance",
    "stats.individual",
    "profile.view",
  ],

  EMPLOYEE: [
    "schedule.view",
    "tasks.view",
    "machines.view",
    "reports.own",
    "myweek.view",
    "stats.individual",
    "profile.view",
    // ★ Logistics — can view dashboard + consume parts
    "logistics.view", "logistics.consume",
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
