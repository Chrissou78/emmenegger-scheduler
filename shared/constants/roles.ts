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

/* ★ FIX: Added 'crm' to the interface */
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
  "schedule.view.all", "schedule.view.team",
  "machines.view.all", "machines.view.team",
  "tasks.view.all", "tasks.view.team",
  "customers.view.all", "customers.view.team",
  "quotations.view.all", "quotations.view.team",
  "invoices.view.all", "invoices.view.finance",
  "myweek.view",
  "stats.global", "stats.perimeter", "stats.team", "stats.individual",
  "hr.access", "admin.access", "profile.view",
  "crm.view", "crm.edit", "crm.delete", "crm.pipeline", "crm.performance",
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
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  CEO: [...PERMISSIONS],

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
    "crm.view", "crm.edit", "crm.pipeline", "crm.performance",
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
    "customers.view", "customers.edit",
    "quotations.view", "quotations.edit",
    "reports.own",
    "crm.view", "crm.edit", "crm.pipeline", "crm.performance",
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
