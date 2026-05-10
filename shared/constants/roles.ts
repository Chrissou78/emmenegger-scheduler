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
  if (r === 'CEO') return null;                    // CEO has no superior
  if (r === 'ADMIN') return 'ceo_id';              // Executive → CEO
  if (r === 'MANAGER') return 'executive_id';      // Team Leader → Executive
  return 'team_leader_id';                          // Employee → Team Leader
}

export function getRoleTier(role: string): number {
  switch (role) {
    case 'CEO': return 4;
    case 'ADMIN': case 'GLOBAL_MANAGER': return 3;   // executives
    case 'HR': case 'FINANCE': case 'SALES': return 3; // non-operational executives
    case 'MANAGER': case 'LOCAL_MANAGER': return 2;    // team leaders
    default: return 1;                                  // employees
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
  myWeek: boolean;
  stats: boolean;
  hr: boolean;
  admin: boolean;
  settings: boolean;
  profile: boolean;
}

export function getNavAccess(
  role: string,
  departments: string[] = []
): NavAccess {
  const tier = getViewTier(role);
  const operational = isOperational(departments);
  const isHR = departments.includes('HR');
  const isFinance = departments.includes('FINANCE');
  const isSales = departments.includes('SALES');
  const r = (role || '').toUpperCase();

  return {
    // Schedule: CEO, operational executives, operational team leaders
    schedule:
      tier === 'ceo' ||
      (tier === 'executive' && operational) ||
      (tier === 'teamleader' && operational),

    // Machines: CEO, operational executives, operational team leaders
    machines:
      tier === 'ceo' ||
      (tier === 'executive' && operational) ||
      (tier === 'teamleader' && operational),

    // Tasks: same as machines
    tasks:
      tier === 'ceo' ||
      (tier === 'executive' && operational) ||
      (tier === 'teamleader' && operational),

    // Customers & Quotations: CEO, all executives, team leaders
    customers:
      tier === 'ceo' || tier === 'executive' || tier === 'teamleader',

    quotations:
      tier === 'ceo' || tier === 'executive' || tier === 'teamleader',

    // Invoices: CEO, finance, sales
    invoices:
      tier === 'ceo' || isFinance || isSales,

    // My Week: employees + operational team leaders only
    myWeek:
      tier === 'employee' ||
      (tier === 'teamleader' && operational),

    // Stats: everyone (but different views per tier)
    stats: true,

    // HR: CEO + HR executives
    hr: tier === 'ceo' || isHR,

    // Admin & Settings: CEO + executives
    admin: tier === 'ceo' || tier === 'executive',
    settings: tier === 'ceo' || tier === 'executive',

    // Profile: everyone
    profile: true,
    crm: r === 'SALES' || r === 'CEO' || r === 'ADMIN' || r === 'GLOBAL_MANAGER',
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
  'schedule.view.all',      // CEO / exec operational – full schedule
  'schedule.view.team',     // team leader operational – own team
  'machines.view.all',
  'machines.view.team',
  'tasks.view.all',
  'tasks.view.team',
  'customers.view.all',
  'customers.view.team',
  'quotations.view.all',
  'quotations.view.team',
  'invoices.view.all',      // CEO only
  'invoices.view.finance',  // finance / sales exec or TL
  'myweek.view',            // employees + operational TL
  'stats.global',           // CEO
  'stats.perimeter',        // executives
  'stats.team',             // team leaders
  'stats.individual',       // employees
  'hr.access',              // CEO + HR exec
  'admin.access',           // CEO + all executives
  'profile.view',           // everyone
  'crm.view',
  'crm.edit',
  'crm.delete',
  'crm.pipeline',
  'crm.performance',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export const NON_OPERATIONAL_ROLES = ['HR', 'FINANCE'] as const;

export function isOperational(userDepartments: string[]): boolean {
  // A user is "operational" if they have at least one department
  // that is NOT purely HR or FINANCE
  const nonOp = new Set(['HR', 'FINANCE']);
  return userDepartments.some(d => !nonOp.has(d));
}
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
