// frontend/src/pages/settings/types.ts
import type { Permission } from '../../../../shared/constants/roles';

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface ConfigItem {
  id: string;
  key: string;
  label: string;
  is_active: boolean;
  sort_order: number;
  meta?: Record<string, unknown>;
}

export interface RoleConfig {
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

export interface VatRate {
  id: string;
  country_code: string;
  country_name: string;
  rate_type: string;
  rate_percent: number;
  description: string;
  is_active: boolean;
}

export interface CrossBorderCountry {
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

export interface CompanyInfo {
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

export interface HierarchyUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  departments: string[];
  team_leader_id: string | null;
  executive_id: string | null;
  ceo_id: string | null;
}

export interface HierarchyEdit {
  team_leader_id: string | null;
  executive_id: string | null;
  ceo_id: string | null;
  departments?: string[];
}

export type ConfigCategory =
  | 'contract_types'
  | 'salary_types'
  | 'schedule_types'
  | 'absence_types'
  | 'absence_codes'
  | 'machine_categories'
  | 'machine_operators';

export interface ConfigForm {
  key: string;
  label: string;
  sort_order: number;
  meta: string;
}

export type MainTab =
  | 'roles'
  | 'config'
  | 'company'
  | 'vat'
  | 'hierarchy'
  | 'languages';

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

export const PERM_GROUPS: Record<string, Permission[]> = {
  Schedule: ['schedule.view', 'schedule.edit'],
  Customers: ['customers.view', 'customers.edit', 'customers.delete'],
  Machines: ['machines.view', 'machines.edit', 'machines.delete'],
  Tasks: ['tasks.view', 'tasks.edit', 'tasks.delete'],
  Quotations: ['quotations.view', 'quotations.edit', 'quotations.delete'],
  Invoices: ['invoices.view', 'invoices.edit', 'invoices.delete'],
  HR: ['hr.view', 'hr.edit', 'hr.payroll'],
  Finance: ['finance.view', 'finance.reports'],
  Admin: [
    'admin.view', 'admin.users', 'admin.roles',
    'admin.customers', 'admin.machines', 'admin.tasks',
  ],
  Reports: ['reports.own', 'reports.team', 'reports.all'],
};

export const CONFIG_CATEGORIES: { key: ConfigCategory; labelKey: string }[] = [
  { key: 'contract_types', labelKey: 'contractTypes' },
  { key: 'salary_types', labelKey: 'salaryTypes' },
  { key: 'schedule_types', labelKey: 'scheduleTypes' },
  { key: 'absence_types', labelKey: 'absenceTypes' },
  { key: 'absence_codes', labelKey: 'absenceCodes' },
  { key: 'machine_categories', labelKey: 'machineCategories' },
  { key: 'machine_operators', labelKey: 'machineOperators' },
];

export const SWISS_CANTONS = [
  'AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU',
  'NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH',
];

export const LEGAL_FORMS = [
  'Einzelunternehmen','GmbH','AG','Kollektivgesellschaft',
  'Kommanditgesellschaft','Genossenschaft','Verein','Stiftung',
];

export const EMPTY_COMPANY: CompanyInfo = {
  company_name: '', legal_form: 'GmbH', uid_number: '', vat_number: '',
  commercial_register: '', street: '', postal_code: '', city: '',
  canton: '', country: 'CH', phone: '', email: '', website: '',
  bank_name: '', bank_iban: '', bank_bic: '', vat_method: 'EFFECTIVE',
  vat_period: 'QUARTERLY', vat_standard_rate: 8.1, vat_reduced_rate: 2.6,
  vat_special_rate: 3.8, fiscal_year_start: '01-01', logo_url: '',
};

export const EMPTY_ROLE: Omit<RoleConfig, 'id'> = {
  name: '', label_de: '', label_en: '', label_fr: '', label_pt: '',
  permissions: [], is_system: false, is_active: true,
};

export const EMPTY_CONFIG_FORM: ConfigForm = {
  key: '', label: '', sort_order: 0, meta: '{}',
};

export const EMPTY_VAT_RATE: Omit<VatRate, 'id'> = {
  country_code: 'CH', country_name: 'Schweiz', rate_type: 'STANDARD',
  rate_percent: 8.1, description: '', is_active: true,
};

export const EMPTY_CROSS_BORDER: Omit<CrossBorderCountry, 'id'> = {
  country_code: '', country_name: '', currency: 'EUR',
  vat_registered: false, vat_number: '', reverse_charge: true,
  notes: '', is_active: true,
};

/* ================================================================== */
/*  Hierarchy role helpers                                             */
/* ================================================================== */

export function isCeoRole(role: string): boolean {
  return (role || '').toUpperCase() === 'CEO';
}
export function isExecRole(role: string): boolean {
  const r = (role || '').toUpperCase();
  return r === 'ADMIN' || r === 'GLOBAL_MANAGER' || r === 'HR' || r === 'FINANCE' || r === 'SALES';
}
export function isManagerRole(role: string): boolean {
  const r = (role || '').toUpperCase();
  return r === 'MANAGER' || r === 'LOCAL_MANAGER';
}
export function isEmployeeRole(role: string): boolean {
  return !isCeoRole(role) && !isExecRole(role) && !isManagerRole(role);
}
export function getTier(role: string): number {
  if (isCeoRole(role)) return 4;
  if (isExecRole(role)) return 3;
  if (isManagerRole(role)) return 2;
  return 1;
}
