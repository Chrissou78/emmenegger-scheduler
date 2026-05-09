import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTheme } from "../contexts/themeContext";
import { useAuthStore } from "../contexts/authStore";
import { CsvToolbar } from "../components/CsvToolbar";
import {
  BUILT_IN_ROLES,
  ROLE_LABELS,
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  resolvePermissions,
  type Role,
  type Permission,
} from "../../../shared/constants/roles";
import { RolePermissionMatrix } from "../components/RolePermissionMatrix";
import { useRolesStore } from "../store/rolesStore";

/* ───────────────────── API ───────────────────── */
const API = import.meta.env.VITE_API_URL ?? "";

/* ───────────────────── Types ───────────────────── */
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name?: string;
  role: Role;
  departments: string[];
  is_active?: boolean;
  custom_permissions?: { add?: Permission[]; remove?: Permission[] } | null;
  // HR fields
  entry_date?: string;
  exit_date?: string;
  contract_type?: string;
  salary_type?: string;
  salary_amount?: number;
  work_pensum?: number;
  hours_per_week?: number;
  ahv_number?: string;
  iban?: string;
  nationality?: string;
  permit_type?: string;
  marital_status?: string;
  children_count?: number;
  canton?: string;
  bvg_code?: string;
}
interface Customer {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  type?: string;
  status?: string;
  notes?: string;
}
interface Machine {
  id: string;
  name: string;
  type?: string;
  category?: string;
  license_plate?: string;
  status?: string;
  department?: string;
  notes?: string;
}
interface Task {
  id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  department?: string;
  assigned_to?: string;
  customer_id?: string;
  start_date?: string;
  end_date?: string;
  notes?: string;
}

/* ───────────────────── Form types ───────────────────── */
interface UserForm {
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  departments: string[];
  password: string;
  is_active: boolean;
  // HR fields
  entry_date: string;
  exit_date: string;
  contract_type: string;
  salary_type: string;
  salary_amount: string;
  work_pensum: string;
  hours_per_week: string;
  ahv_number: string;
  iban: string;
  nationality: string;
  permit_type: string;
  marital_status: string;
  children_count: string;
  canton: string;
  bvg_code: string;
}
interface CustomerForm {
  name: string;
  company: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  postal_code: string;
  country: string;
  type: string;
  status: string;
  notes: string;
}
interface MachineForm {
  name: string;
  type: string;
  category: string;
  license_plate: string;
  status: string;
  department: string;
  notes: string;
}
interface TaskForm {
  title: string;
  description: string;
  status: string;
  priority: string;
  department: string;
  assigned_to: string;
  customer_id: string;
  start_date: string;
  end_date: string;
  notes: string;
}

/* ───────────────────── Empty form defaults ───────────────────── */
const EMPTY_USER: UserForm = {
  email: "", first_name: "", last_name: "", role: "EMPLOYEE",
  departments: [], password: "", is_active: true,
  entry_date: "", exit_date: "", contract_type: "PERMANENT",
  salary_type: "MONTHLY", salary_amount: "", work_pensum: "100",
  hours_per_week: "42.0", ahv_number: "", iban: "", nationality: "",
  permit_type: "", marital_status: "", children_count: "0",
  canton: "", bvg_code: "",
};
const EMPTY_CUSTOMER: CustomerForm = {
  name: "", company: "", email: "", phone: "", street: "",
  city: "", postal_code: "", country: "CH", type: "PRIVATE", status: "ACTIVE", notes: "",
};
const EMPTY_MACHINE: MachineForm = {
  name: "", type: "", category: "", license_plate: "",
  status: "AVAILABLE", department: "", notes: "",
};
const EMPTY_TASK: TaskForm = {
  title: "", description: "", status: "OPEN", priority: "MEDIUM",
  department: "", assigned_to: "", customer_id: "", start_date: "", end_date: "", notes: "",
};

/* ───────────────────── Option arrays ───────────────────── */
const DEPARTMENTS = ["GARTEN_TIEFBAU", "UNTERHALT", "PIKETT", "ADMIN"];
const MACHINE_STATUSES = ["AVAILABLE", "IN_USE", "MAINTENANCE", "DECOMMISSIONED"];
const TASK_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const MACHINE_CATEGORIES = [
  "BAGGER", "DUMPER", "RADLADER", "WALZE", "KOMPRESSOR",
  "GENERATOR", "FAHRZEUG", "WERKZEUG", "SONSTIGES",
];
const CONTRACT_TYPES = ["PERMANENT", "TEMPORARY", "APPRENTICE", "INTERN", "FREELANCE"];
const SALARY_TYPES = ["MONTHLY", "HOURLY"];
const MARITAL_STATUSES = ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "REGISTERED_PARTNERSHIP"];
const PERMIT_TYPES = ["", "B", "C", "G", "L", "F", "N", "S"];
const SWISS_CANTONS = [
  "AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU",
  "NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH",
];

/* ───────────────────── Translations ───────────────────── */
const L_ALL: Record<string, Record<string, string>> = {
  de: {
    admin: "Administration", users: "Benutzer", customers: "Kunden",
    machines: "Maschinen", tasks: "Aufgaben", search: "Suchen…",
    newUser: "Neuer Benutzer", newCustomer: "Neuer Kunde",
    newMachine: "Neue Maschine", newTask: "Neue Aufgabe",
    save: "Speichern", cancel: "Abbrechen", delete: "Löschen",
    confirmDelete: "Wirklich löschen?", yes: "Ja", no: "Nein",
    email: "E-Mail", firstName: "Vorname", lastName: "Nachname",
    role: "Rolle", departments: "Abteilungen", password: "Passwort",
    active: "Aktiv", name: "Name", company: "Firma", phone: "Telefon",
    street: "Strasse", city: "Ort", postalCode: "PLZ", country: "Land",
    type: "Typ", status: "Status", notes: "Notizen", title: "Titel",
    description: "Beschreibung", priority: "Priorität", assignedTo: "Zugewiesen an",
    customer: "Kunde", startDate: "Startdatum", endDate: "Enddatum",
    category: "Kategorie", licensePlate: "Kennzeichen", department: "Abteilung",
    saved: "Gespeichert", deleted: "Gelöscht", error: "Fehler",
    noResults: "Keine Ergebnisse", filter: "Filter",
    // HR
    hrInfo: "HR-Informationen", entryDate: "Eintrittsdatum", exitDate: "Austrittsdatum",
    contractType: "Vertragsart", salaryType: "Lohnart", salaryAmount: "Lohn (CHF)",
    workPensum: "Pensum (%)", hoursPerWeek: "Std/Woche", ahvNumber: "AHV-Nummer",
    iban: "IBAN", nationality: "Nationalität", permitType: "Ausweis",
    maritalStatus: "Zivilstand", childrenCount: "Kinder", canton: "Kanton",
    bvgCode: "BVG-Code", permissions: "Berechtigungen",
    permanent: "Festanstellung", temporary: "Temporär", apprentice: "Lernende/r",
    intern: "Praktikant/in", freelance: "Freelance",
    monthly: "Monatlich", hourly: "Stundenlohn",
  },
  en: {
    admin: "Administration", users: "Users", customers: "Customers",
    machines: "Machines", tasks: "Tasks", search: "Search…",
    newUser: "New User", newCustomer: "New Customer",
    newMachine: "New Machine", newTask: "New Task",
    save: "Save", cancel: "Cancel", delete: "Delete",
    confirmDelete: "Really delete?", yes: "Yes", no: "No",
    email: "Email", firstName: "First Name", lastName: "Last Name",
    role: "Role", departments: "Departments", password: "Password",
    active: "Active", name: "Name", company: "Company", phone: "Phone",
    street: "Street", city: "City", postalCode: "Postal Code", country: "Country",
    type: "Type", status: "Status", notes: "Notes", title: "Title",
    description: "Description", priority: "Priority", assignedTo: "Assigned To",
    customer: "Customer", startDate: "Start Date", endDate: "End Date",
    category: "Category", licensePlate: "License Plate", department: "Department",
    saved: "Saved", deleted: "Deleted", error: "Error",
    noResults: "No results", filter: "Filter",
    hrInfo: "HR Information", entryDate: "Entry Date", exitDate: "Exit Date",
    contractType: "Contract Type", salaryType: "Salary Type", salaryAmount: "Salary (CHF)",
    workPensum: "Pensum (%)", hoursPerWeek: "Hours/Week", ahvNumber: "AHV Number",
    iban: "IBAN", nationality: "Nationality", permitType: "Permit",
    maritalStatus: "Marital Status", childrenCount: "Children", canton: "Canton",
    bvgCode: "BVG Code", permissions: "Permissions",
    permanent: "Permanent", temporary: "Temporary", apprentice: "Apprentice",
    intern: "Intern", freelance: "Freelance",
    monthly: "Monthly", hourly: "Hourly",
  },
  fr: {
    admin: "Administration", users: "Utilisateurs", customers: "Clients",
    machines: "Machines", tasks: "Tâches", search: "Rechercher…",
    newUser: "Nouvel utilisateur", newCustomer: "Nouveau client",
    newMachine: "Nouvelle machine", newTask: "Nouvelle tâche",
    save: "Enregistrer", cancel: "Annuler", delete: "Supprimer",
    confirmDelete: "Vraiment supprimer ?", yes: "Oui", no: "Non",
    email: "E-mail", firstName: "Prénom", lastName: "Nom",
    role: "Rôle", departments: "Départements", password: "Mot de passe",
    active: "Actif", name: "Nom", company: "Entreprise", phone: "Téléphone",
    street: "Rue", city: "Ville", postalCode: "Code postal", country: "Pays",
    type: "Type", status: "Statut", notes: "Notes", title: "Titre",
    description: "Description", priority: "Priorité", assignedTo: "Assigné à",
    customer: "Client", startDate: "Date de début", endDate: "Date de fin",
    category: "Catégorie", licensePlate: "Plaque", department: "Département",
    saved: "Enregistré", deleted: "Supprimé", error: "Erreur",
    noResults: "Aucun résultat", filter: "Filtre",
    hrInfo: "Informations RH", entryDate: "Date d'entrée", exitDate: "Date de sortie",
    contractType: "Type de contrat", salaryType: "Type de salaire", salaryAmount: "Salaire (CHF)",
    workPensum: "Taux (%)", hoursPerWeek: "H/Semaine", ahvNumber: "Numéro AVS",
    iban: "IBAN", nationality: "Nationalité", permitType: "Permis",
    maritalStatus: "État civil", childrenCount: "Enfants", canton: "Canton",
    bvgCode: "Code LPP", permissions: "Permissions",
    permanent: "CDI", temporary: "CDD", apprentice: "Apprenti(e)",
    intern: "Stagiaire", freelance: "Freelance",
    monthly: "Mensuel", hourly: "Horaire",
  },
  pt: {
    admin: "Administração", users: "Utilizadores", customers: "Clientes",
    machines: "Máquinas", tasks: "Tarefas", search: "Pesquisar…",
    newUser: "Novo Utilizador", newCustomer: "Novo Cliente",
    newMachine: "Nova Máquina", newTask: "Nova Tarefa",
    save: "Guardar", cancel: "Cancelar", delete: "Eliminar",
    confirmDelete: "Eliminar mesmo?", yes: "Sim", no: "Não",
    email: "E-mail", firstName: "Nome", lastName: "Apelido",
    role: "Função", departments: "Departamentos", password: "Palavra-passe",
    active: "Ativo", name: "Nome", company: "Empresa", phone: "Telefone",
    street: "Rua", city: "Cidade", postalCode: "Código Postal", country: "País",
    type: "Tipo", status: "Estado", notes: "Notas", title: "Título",
    description: "Descrição", priority: "Prioridade", assignedTo: "Atribuído a",
    customer: "Cliente", startDate: "Data de Início", endDate: "Data de Fim",
    category: "Categoria", licensePlate: "Matrícula", department: "Departamento",
    saved: "Guardado", deleted: "Eliminado", error: "Erro",
    noResults: "Sem resultados", filter: "Filtro",
    hrInfo: "Informações RH", entryDate: "Data de Entrada", exitDate: "Data de Saída",
    contractType: "Tipo de Contrato", salaryType: "Tipo de Salário", salaryAmount: "Salário (CHF)",
    workPensum: "Taxa (%)", hoursPerWeek: "H/Semana", ahvNumber: "Número AHV",
    iban: "IBAN", nationality: "Nacionalidade", permitType: "Autorização",
    maritalStatus: "Estado Civil", childrenCount: "Filhos", canton: "Cantão",
    bvgCode: "Código BVG", permissions: "Permissões",
    permanent: "Permanente", temporary: "Temporário", apprentice: "Aprendiz",
    intern: "Estagiário", freelance: "Freelance",
    monthly: "Mensal", hourly: "Por hora",
  },
};

/* ───────────────────── CSV Definitions ───────────────────── */
const csvColumnsUsers = (t: Record<string, string>) => [
  { key: "email", label: t.email },
  { key: "first_name", label: t.firstName },
  { key: "last_name", label: t.lastName },
  { key: "role", label: t.role },
  { key: "departments", label: t.departments },
];
const csvColumnsCustomers = (t: Record<string, string>) => [
  { key: "name", label: t.name },
  { key: "company", label: t.company },
  { key: "email", label: t.email },
  { key: "phone", label: t.phone },
  { key: "city", label: t.city },
];
const csvColumnsMachines = (t: Record<string, string>) => [
  { key: "name", label: t.name },
  { key: "category", label: t.category },
  { key: "license_plate", label: t.licensePlate },
  { key: "status", label: t.status },
];
const csvColumnsTasks = (t: Record<string, string>) => [
  { key: "title", label: t.title },
  { key: "status", label: t.status },
  { key: "priority", label: t.priority },
  { key: "department", label: t.department },
];

const CSV_EXAMPLE_USERS = [
  { email: "max@example.ch", first_name: "Max", last_name: "Muster", role: "EMPLOYEE", departments: "GARTEN_TIEFBAU" },
];
const CSV_EXAMPLE_CUSTOMERS = [
  { name: "Muster AG", company: "Muster AG", email: "info@muster.ch", phone: "+41 31 000 0000", city: "Bern" },
];
const CSV_EXAMPLE_MACHINES = [
  { name: "CAT 320", category: "BAGGER", license_plate: "BE 12345", status: "AVAILABLE" },
];
const CSV_EXAMPLE_TASKS = [
  { title: "Gartenanlage", status: "OPEN", priority: "HIGH", department: "GARTEN_TIEFBAU" },
];

/* ───────────────────── Helpers ───────────────────── */
const statusColor = (s: string): string => {
  const m: Record<string, string> = {
    ACTIVE: "#22c55e", AVAILABLE: "#22c55e", OPEN: "#3b82f6",
    IN_USE: "#f59e0b", IN_PROGRESS: "#f59e0b", MAINTENANCE: "#ef4444",
    COMPLETED: "#22c55e", CANCELLED: "#6b7280", DECOMMISSIONED: "#6b7280",
    INACTIVE: "#6b7280", LEAD: "#8b5cf6", PROSPECT: "#06b6d4",
  };
  return m[s] || "#6b7280";
};

/* ═══════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════ */
export default function AdminPage() {
  const { th, isDark, lang } = useTheme();
  const { token, user } = useAuthStore();
  const t = L_ALL[lang] ?? L_ALL.de;
  const { getRoleNames, getRoleLabel, permissionMap } = useRolesStore();
  const roleNames = getRoleNames();

  /* ── Permissions ── */
  const perms = useMemo(() => {
    const role: Role = user?.role || "EMPLOYEE";
    return resolvePermissions(role, user?.custom_permissions, permissionMap);
  }, [user, permissionMap]);

  const canManageUsers = perms.has("admin.users" as Permission);
  const canManageCustomers = perms.has("admin.customers" as Permission) || perms.has("customers.edit" as Permission);
  const canManageMachines = perms.has("admin.machines" as Permission) || perms.has("machines.edit" as Permission);
  const canManageTasks = perms.has("admin.tasks" as Permission) || perms.has("tasks.edit" as Permission);
  const canManageRoles = perms.has("admin.roles" as Permission);
  const canViewHR = perms.has("hr.view" as Permission);
  const canEditHR = perms.has("hr.edit" as Permission);

  /* ── State ── */
  const [tab, setTab] = useState<"users" | "customers" | "machines" | "tasks">("users");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<null | "user" | "customer" | "machine" | "task">(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ type: string; id: string } | null>(null);
  const [userFormTab, setUserFormTab] = useState<"general" | "hr" | "permissions">("general");

  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [userForm, setUserForm] = useState<UserForm>({ ...EMPTY_USER });
  const [customerForm, setCustomerForm] = useState<CustomerForm>({ ...EMPTY_CUSTOMER });
  const [machineForm, setMachineForm] = useState<MachineForm>({ ...EMPTY_MACHINE });
  const [taskForm, setTaskForm] = useState<TaskForm>({ ...EMPTY_TASK });

  const [filterRole, setFilterRole] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const [userCustomPerms, setUserCustomPerms] = useState<{ add: Permission[]; remove: Permission[] }>({ add: [], remove: [] });

  const gold = th.gold;

  /* ── Headers ── */
  const headers = useCallback(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token],
  );

  /* ── Show toast ── */
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── Fetchers ── */
  const fetchUsers = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/users`, { headers: headers() });
      const j = await r.json();
      setUsers(j.data ?? j ?? []);
    } catch { /* ignore */ }
  }, [headers]);

  const fetchCustomers = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/customers`, { headers: headers() });
      const j = await r.json();
      setCustomers(j.data ?? j ?? []);
    } catch { /* ignore */ }
  }, [headers]);

  const fetchMachines = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/machines`, { headers: headers() });
      const j = await r.json();
      setMachines(j.data ?? j ?? []);
    } catch { /* ignore */ }
  }, [headers]);

  const fetchTasks = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/tasks`, { headers: headers() });
      const j = await r.json();
      setTasks(j.data ?? j ?? []);
    } catch { /* ignore */ }
  }, [headers]);

  useEffect(() => {
    fetchUsers();
    fetchCustomers();
    fetchMachines();
    fetchTasks();
  }, [fetchUsers, fetchCustomers, fetchMachines, fetchTasks]);

  /* ── Label helpers ── */
  const roleLabel = (r: string) => ROLE_LABELS[lang]?.[r as Role] ?? r;
  const deptLabel = (d: string) => d.replace(/_/g, " ");
  const managerName = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u ? `${u.first_name} ${u.last_name ?? ""}`.trim() : id;
  };
  const customerName = (id: string) => {
    const c = customers.find((x) => x.id === id);
    return c ? c.name : id;
  };

  /* ── Filtering ── */
  const filteredUsers = useMemo(() => {
    let list = users;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.first_name.toLowerCase().includes(s) ||
          (u.last_name ?? "").toLowerCase().includes(s) ||
          u.email.toLowerCase().includes(s),
      );
    }
    if (filterRole) list = list.filter((u) => u.role === filterRole);
    if (filterDept) list = list.filter((u) => u.departments?.includes(filterDept));
    return list;
  }, [users, search, filterRole, filterDept]);

  const filteredCustomers = useMemo(() => {
    let list = customers;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(s) ||
          (c.company ?? "").toLowerCase().includes(s) ||
          (c.email ?? "").toLowerCase().includes(s),
      );
    }
    if (filterStatus) list = list.filter((c) => c.status === filterStatus);
    return list;
  }, [customers, search, filterStatus]);

  const filteredMachines = useMemo(() => {
    let list = machines;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(s) ||
          (m.license_plate ?? "").toLowerCase().includes(s),
      );
    }
    if (filterStatus) list = list.filter((m) => m.status === filterStatus);
    if (filterCategory) list = list.filter((m) => m.category === filterCategory);
    return list;
  }, [machines, search, filterStatus, filterCategory]);

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(s) ||
          (t.description ?? "").toLowerCase().includes(s),
      );
    }
    if (filterStatus) list = list.filter((t) => t.status === filterStatus);
    if (filterDept) list = list.filter((t) => t.department === filterDept);
    return list;
  }, [tasks, search, filterStatus, filterDept]);

  /* ── CSV data ── */
  const csvData = useMemo(() => {
    if (tab === "users") return filteredUsers.map((u) => ({
      email: u.email, first_name: u.first_name, last_name: u.last_name ?? "",
      role: u.role, departments: u.departments?.join(", ") ?? "",
    }));
    if (tab === "customers") return filteredCustomers.map((c) => ({
      name: c.name, company: c.company ?? "", email: c.email ?? "",
      phone: c.phone ?? "", city: c.city ?? "",
    }));
    if (tab === "machines") return filteredMachines.map((m) => ({
      name: m.name, category: m.category ?? "", license_plate: m.license_plate ?? "",
      status: m.status ?? "",
    }));
    return filteredTasks.map((t) => ({
      title: t.title, status: t.status ?? "", priority: t.priority ?? "",
      department: t.department ?? "",
    }));
  }, [tab, filteredUsers, filteredCustomers, filteredMachines, filteredTasks]);

  /* ── CSV import handlers ── */
  const handleCsvImport = async (rows: Record<string, string>[]) => {
    const endpoint =
      tab === "users" ? "users" :
      tab === "customers" ? "customers" :
      tab === "machines" ? "machines" : "tasks";
    let ok = 0;
    for (const row of rows) {
      try {
        const body = tab === "users"
          ? { ...row, departments: row.departments ? row.departments.split(",").map((d: string) => d.trim()) : [] }
          : row;
        const r = await fetch(`${API}/api/v1/${endpoint}`, {
          method: "POST", headers: headers(), body: JSON.stringify(body),
        });
        if (r.ok) ok++;
      } catch { /* skip */ }
    }
    showToast(`${ok}/${rows.length} imported`);
    if (tab === "users") fetchUsers();
    if (tab === "customers") fetchCustomers();
    if (tab === "machines") fetchMachines();
    if (tab === "tasks") fetchTasks();
  };

  /* ── Open modal for create/edit ── */
  const openCreateUser = () => {
    setUserForm({ ...EMPTY_USER });
    setUserCustomPerms({ add: [], remove: [] });
    setEditId(null);
    setUserFormTab("general");
    setModal("user");
  };
  const openEditUser = (u: User) => {
    setUserForm({
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name ?? "",
      role: u.role,
      departments: u.departments ?? [],
      password: "",
      is_active: u.is_active !== false,
      entry_date: u.entry_date ?? "",
      exit_date: u.exit_date ?? "",
      contract_type: u.contract_type ?? "PERMANENT",
      salary_type: u.salary_type ?? "MONTHLY",
      salary_amount: u.salary_amount != null ? String(u.salary_amount) : "",
      work_pensum: u.work_pensum != null ? String(u.work_pensum) : "100",
      hours_per_week: u.hours_per_week != null ? String(u.hours_per_week) : "42.0",
      ahv_number: u.ahv_number ?? "",
      iban: u.iban ?? "",
      nationality: u.nationality ?? "",
      permit_type: u.permit_type ?? "",
      marital_status: u.marital_status ?? "",
      children_count: u.children_count != null ? String(u.children_count) : "0",
      canton: u.canton ?? "",
      bvg_code: u.bvg_code ?? "",
    });
    setUserCustomPerms({
      add: u.custom_permissions?.add ?? [],
      remove: u.custom_permissions?.remove ?? [],
    });
    setEditId(u.id);
    setUserFormTab("general");
    setModal("user");
  };
  const openCreateCustomer = () => { setCustomerForm({ ...EMPTY_CUSTOMER }); setEditId(null); setModal("customer"); };
  const openEditCustomer = (c: Customer) => {
    setCustomerForm({
      name: c.name, company: c.company ?? "", email: c.email ?? "",
      phone: c.phone ?? "", street: c.street ?? "", city: c.city ?? "",
      postal_code: c.postal_code ?? "", country: c.country ?? "CH",
      type: c.type ?? "PRIVATE", status: c.status ?? "ACTIVE", notes: c.notes ?? "",
    });
    setEditId(c.id); setModal("customer");
  };
  const openCreateMachine = () => { setMachineForm({ ...EMPTY_MACHINE }); setEditId(null); setModal("machine"); };
  const openEditMachine = (m: Machine) => {
    setMachineForm({
      name: m.name, type: m.type ?? "", category: m.category ?? "",
      license_plate: m.license_plate ?? "", status: m.status ?? "AVAILABLE",
      department: m.department ?? "", notes: m.notes ?? "",
    });
    setEditId(m.id); setModal("machine");
  };
  const openCreateTask = () => { setTaskForm({ ...EMPTY_TASK }); setEditId(null); setModal("task"); };
  const openEditTask = (tk: Task) => {
    setTaskForm({
      title: tk.title, description: tk.description ?? "", status: tk.status ?? "OPEN",
      priority: tk.priority ?? "MEDIUM", department: tk.department ?? "",
      assigned_to: tk.assigned_to ?? "", customer_id: tk.customer_id ?? "",
      start_date: tk.start_date ?? "", end_date: tk.end_date ?? "", notes: tk.notes ?? "",
    });
    setEditId(tk.id); setModal("task");
  };

  /* ── Save ── */
  const saveEntity = async (type: string, body: Record<string, unknown>, id: string | null) => {
    const endpoint =
      type === "user" ? "users" :
      type === "customer" ? "customers" :
      type === "machine" ? "machines" : "tasks";
    setSaving(true);
    try {
      const url = id ? `${API}/api/v1/${endpoint}/${id}` : `${API}/api/v1/${endpoint}`;
      const r = await fetch(url, {
        method: id ? "PUT" : "POST",
        headers: headers(),
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      showToast(t.saved);
      setModal(null);
      if (type === "user") fetchUsers();
      if (type === "customer") fetchCustomers();
      if (type === "machine") fetchMachines();
      if (type === "task") fetchTasks();
    } catch (e) {
      showToast(t.error + ": " + (e instanceof Error ? e.message : ""), false);
    } finally {
      setSaving(false);
    }
  };

  const saveUser = () => {
    const body: Record<string, unknown> = {
      email: userForm.email,
      first_name: userForm.first_name,
      last_name: userForm.last_name,
      role: userForm.role,
      departments: userForm.departments,
      is_active: userForm.is_active,
      // HR fields
      entry_date: userForm.entry_date || null,
      exit_date: userForm.exit_date || null,
      contract_type: userForm.contract_type,
      salary_type: userForm.salary_type,
      salary_amount: userForm.salary_amount ? parseFloat(userForm.salary_amount) : 0,
      work_pensum: userForm.work_pensum ? parseInt(userForm.work_pensum) : 100,
      hours_per_week: userForm.hours_per_week ? parseFloat(userForm.hours_per_week) : 42.0,
      ahv_number: userForm.ahv_number || null,
      iban: userForm.iban || null,
      nationality: userForm.nationality || null,
      permit_type: userForm.permit_type || null,
      marital_status: userForm.marital_status || null,
      children_count: userForm.children_count ? parseInt(userForm.children_count) : 0,
      canton: userForm.canton || null,
      bvg_code: userForm.bvg_code || null,
    };
    if (userForm.password) body.password = userForm.password;
    // Custom permissions – only include if there are overrides
    if (userCustomPerms.add.length > 0 || userCustomPerms.remove.length > 0) {
      body.custom_permissions = userCustomPerms;
    } else {
      body.custom_permissions = null;
    }
    saveEntity("user", body, editId);
  };

  const saveCustomer = () => saveEntity("customer", { ...customerForm }, editId);
  const saveMachine = () => saveEntity("machine", { ...machineForm }, editId);
  const saveTask = () => saveEntity("task", { ...taskForm }, editId);

  /* ── Delete ── */
  const deleteEntity = async () => {
    if (!confirmDel) return;
    const endpoint =
      confirmDel.type === "user" ? "users" :
      confirmDel.type === "customer" ? "customers" :
      confirmDel.type === "machine" ? "machines" : "tasks";
    try {
      const r = await fetch(`${API}/api/v1/${endpoint}/${confirmDel.id}`, {
        method: "DELETE", headers: headers(),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      showToast(t.deleted);
      if (confirmDel.type === "user") fetchUsers();
      if (confirmDel.type === "customer") fetchCustomers();
      if (confirmDel.type === "machine") fetchMachines();
      if (confirmDel.type === "task") fetchTasks();
    } catch (e) {
      showToast(t.error + ": " + (e instanceof Error ? e.message : ""), false);
    } finally {
      setConfirmDel(null);
    }
  };

  /* ── CSV columns for current tab ── */
  const currentCsvCols = tab === "users" ? csvColumnsUsers(t)
    : tab === "customers" ? csvColumnsCustomers(t)
    : tab === "machines" ? csvColumnsMachines(t)
    : csvColumnsTasks(t);

  const currentCsvExamples = tab === "users" ? CSV_EXAMPLE_USERS
    : tab === "customers" ? CSV_EXAMPLE_CUSTOMERS
    : tab === "machines" ? CSV_EXAMPLE_MACHINES
    : CSV_EXAMPLE_TASKS;

  const currentValidators: Record<string, (v: string) => string | null> =
    tab === "users" ? { email: (v: string) => (v ? null : "email required"), first_name: (v: string) => (v ? null : "name required") }
    : tab === "customers" ? { name: (v: string) => (v ? null : "name required") }
    : tab === "machines" ? { name: (v: string) => (v ? null : "name required") }
    : { title: (v: string) => (v ? null : "title required") };

  const canCreateForTab = tab === "users" ? canManageUsers
    : tab === "customers" ? canManageCustomers
    : tab === "machines" ? canManageMachines
    : canManageTasks;

  /* ── Styles ── */
  const sOverlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const sModal: React.CSSProperties = {
    background: th.bgCard, color: th.text, borderRadius: 12, padding: 24,
    width: "90%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto",
    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
  };
  const sInput: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: 8,
    border: `1px solid ${th.border}`, background: isDark ? "#1e1e1e" : "#fff",
    color: th.text, fontSize: 14, boxSizing: "border-box",
  };
  const sSelect: React.CSSProperties = { ...sInput };
  const sLabel: React.CSSProperties = { display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13 };
  const sBtn = (bg: string): React.CSSProperties => ({
    padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
    fontWeight: 600, color: "#fff", background: bg, fontSize: 14,
  });
  const sTab = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px", borderRadius: "8px 8px 0 0", cursor: "pointer", fontWeight: 600,
    background: active ? gold : "transparent", color: active ? "#fff" : th.text,
    border: "none", fontSize: 14,
  });
  const sFormTab = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 600,
    background: active ? gold : "transparent", color: active ? "#fff" : th.text,
    border: `1px solid ${active ? gold : th.border}`, fontSize: 13,
  });
  const sTable: React.CSSProperties = {
    width: "100%", borderCollapse: "collapse", fontSize: 14,
  };
  const sTh: React.CSSProperties = {
    textAlign: "left", padding: "10px 12px", borderBottom: `2px solid ${th.border}`,
    fontWeight: 700, color: gold,
  };
  const sTd: React.CSSProperties = {
    padding: "8px 12px", borderBottom: `1px solid ${th.border}`,
  };

  /* ── Permission guard ── */
  if (!perms.has("admin.view" as Permission)) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: th.text }}>
        <h2>Access Denied</h2>
      </div>
    );
  }

  /* ═══════════════════ RENDER ═══════════════════ */
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, color: gold }}>{t.admin}</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <CsvToolbar
            columns={currentCsvCols}
            data={csvData as Record<string, any>[]}
            filename={tab}
            exampleRows={currentCsvExamples}
            onImport={handleCsvImport}
            validators={currentValidators}
            canImport={canCreateForTab}
          />
          {canCreateForTab && (
            <button
              style={sBtn(gold)}
              onClick={() => {
                if (tab === "users") openCreateUser();
                else if (tab === "customers") openCreateCustomer();
                else if (tab === "machines") openCreateMachine();
                else openCreateTask();
              }}
            >
              + {tab === "users" ? t.newUser : tab === "customers" ? t.newCustomer : tab === "machines" ? t.newMachine : t.newTask}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 0 }}>
        {(["users", "customers", "machines", "tasks"] as const).map((key) => (
          <button key={key} style={sTab(tab === key)} onClick={() => { setTab(key); setSearch(""); setFilterRole(""); setFilterDept(""); setFilterStatus(""); setFilterCategory(""); }}>
            {t[key]}
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div style={{
        display: "flex", gap: 8, alignItems: "center", padding: "12px 0",
        borderTop: `2px solid ${gold}`, flexWrap: "wrap",
      }}>
        <input
          style={{ ...sInput, maxWidth: 260 }}
          placeholder={t.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {tab === "users" && (
          <>
            <select style={{ ...sSelect, maxWidth: 160 }} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="">{t.role}</option>
              {roleNames.map((r) => <option key={r} value={r}>{getRoleLabel(r, lang)}</option>)}
            </select>
            <select style={{ ...sSelect, maxWidth: 180 }} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="">{t.department}</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{deptLabel(d)}</option>)}
            </select>
          </>
        )}
        {tab === "customers" && (
          <select style={{ ...sSelect, maxWidth: 160 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">{t.status}</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="LEAD">Lead</option>
            <option value="PROSPECT">Prospect</option>
          </select>
        )}
        {tab === "machines" && (
          <>
            <select style={{ ...sSelect, maxWidth: 160 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">{t.status}</option>
              {MACHINE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select style={{ ...sSelect, maxWidth: 160 }} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">{t.category}</option>
              {MACHINE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </>
        )}
        {tab === "tasks" && (
          <>
            <select style={{ ...sSelect, maxWidth: 160 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">{t.status}</option>
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select style={{ ...sSelect, maxWidth: 180 }} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="">{t.department}</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{deptLabel(d)}</option>)}
            </select>
          </>
        )}
      </div>

      {/* ─── USERS TABLE ─── */}
      {tab === "users" && (
        <table style={sTable}>
          <thead>
            <tr>
              <th style={sTh}>{t.firstName}</th>
              <th style={sTh}>{t.lastName}</th>
              <th style={sTh}>{t.email}</th>
              <th style={sTh}>{t.role}</th>
              <th style={sTh}>{t.departments}</th>
              <th style={sTh}>{t.contractType}</th>
              <th style={sTh}>{t.active}</th>
              <th style={sTh}></th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 && (
              <tr><td colSpan={8} style={{ ...sTd, textAlign: "center", opacity: 0.6 }}>{t.noResults}</td></tr>
            )}
            {filteredUsers.map((u) => (
              <tr key={u.id} style={{ cursor: canManageUsers ? "pointer" : "default" }} onClick={() => canManageUsers && openEditUser(u)}>
                <td style={sTd}>{u.first_name}</td>
                <td style={sTd}>{u.last_name ?? ""}</td>
                <td style={sTd}>{u.email}</td>
                <td style={sTd}>
                  <span style={{ padding: "2px 8px", borderRadius: 4, background: gold + "22", color: gold, fontWeight: 600, fontSize: 12 }}>
                    {getRoleLabel(u.role, lang)}
                  </span>
                </td>
                <td style={sTd}>{u.departments?.map(deptLabel).join(", ")}</td>
                <td style={sTd}>{u.contract_type ?? "-"}</td>
                <td style={sTd}>
                  <span style={{ color: u.is_active !== false ? "#22c55e" : "#ef4444" }}>●</span>
                </td>
                <td style={sTd}>
                  {canManageUsers && (
                    <button
                      style={{ ...sBtn("#ef4444"), padding: "4px 10px", fontSize: 12 }}
                      onClick={(e) => { e.stopPropagation(); setConfirmDel({ type: "user", id: u.id }); }}
                    >
                      {t.delete}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ─── CUSTOMERS TABLE ─── */}
      {tab === "customers" && (
        <table style={sTable}>
          <thead>
            <tr>
              <th style={sTh}>{t.name}</th>
              <th style={sTh}>{t.company}</th>
              <th style={sTh}>{t.email}</th>
              <th style={sTh}>{t.phone}</th>
              <th style={sTh}>{t.city}</th>
              <th style={sTh}>{t.status}</th>
              <th style={sTh}></th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length === 0 && (
              <tr><td colSpan={7} style={{ ...sTd, textAlign: "center", opacity: 0.6 }}>{t.noResults}</td></tr>
            )}
            {filteredCustomers.map((c) => (
              <tr key={c.id} style={{ cursor: canManageCustomers ? "pointer" : "default" }} onClick={() => canManageCustomers && openEditCustomer(c)}>
                <td style={sTd}>{c.name}</td>
                <td style={sTd}>{c.company ?? ""}</td>
                <td style={sTd}>{c.email ?? ""}</td>
                <td style={sTd}>{c.phone ?? ""}</td>
                <td style={sTd}>{c.city ?? ""}</td>
                <td style={sTd}>
                  <span style={{ padding: "2px 8px", borderRadius: 4, background: statusColor(c.status ?? "") + "22", color: statusColor(c.status ?? ""), fontWeight: 600, fontSize: 12 }}>
                    {c.status}
                  </span>
                </td>
                <td style={sTd}>
                  {canManageCustomers && (
                    <button
                      style={{ ...sBtn("#ef4444"), padding: "4px 10px", fontSize: 12 }}
                      onClick={(e) => { e.stopPropagation(); setConfirmDel({ type: "customer", id: c.id }); }}
                    >
                      {t.delete}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ─── MACHINES TABLE ─── */}
      {tab === "machines" && (
        <table style={sTable}>
          <thead>
            <tr>
              <th style={sTh}>{t.name}</th>
              <th style={sTh}>{t.category}</th>
              <th style={sTh}>{t.licensePlate}</th>
              <th style={sTh}>{t.status}</th>
              <th style={sTh}>{t.department}</th>
              <th style={sTh}></th>
            </tr>
          </thead>
          <tbody>
            {filteredMachines.length === 0 && (
              <tr><td colSpan={6} style={{ ...sTd, textAlign: "center", opacity: 0.6 }}>{t.noResults}</td></tr>
            )}
            {filteredMachines.map((m) => (
              <tr key={m.id} style={{ cursor: canManageMachines ? "pointer" : "default" }} onClick={() => canManageMachines && openEditMachine(m)}>
                <td style={sTd}>{m.name}</td>
                <td style={sTd}>{m.category ?? ""}</td>
                <td style={sTd}>{m.license_plate ?? ""}</td>
                <td style={sTd}>
                  <span style={{ padding: "2px 8px", borderRadius: 4, background: statusColor(m.status ?? "") + "22", color: statusColor(m.status ?? ""), fontWeight: 600, fontSize: 12 }}>
                    {m.status}
                  </span>
                </td>
                <td style={sTd}>{deptLabel(m.department ?? "")}</td>
                <td style={sTd}>
                  {canManageMachines && (
                    <button
                      style={{ ...sBtn("#ef4444"), padding: "4px 10px", fontSize: 12 }}
                      onClick={(e) => { e.stopPropagation(); setConfirmDel({ type: "machine", id: m.id }); }}
                    >
                      {t.delete}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ─── TASKS TABLE ─── */}
      {tab === "tasks" && (
        <table style={sTable}>
          <thead>
            <tr>
              <th style={sTh}>{t.title}</th>
              <th style={sTh}>{t.status}</th>
              <th style={sTh}>{t.priority}</th>
              <th style={sTh}>{t.department}</th>
              <th style={sTh}>{t.assignedTo}</th>
              <th style={sTh}>{t.customer}</th>
              <th style={sTh}></th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 && (
              <tr><td colSpan={7} style={{ ...sTd, textAlign: "center", opacity: 0.6 }}>{t.noResults}</td></tr>
            )}
            {filteredTasks.map((tk) => (
              <tr key={tk.id} style={{ cursor: canManageTasks ? "pointer" : "default" }} onClick={() => canManageTasks && openEditTask(tk)}>
                <td style={sTd}>{tk.title}</td>
                <td style={sTd}>
                  <span style={{ padding: "2px 8px", borderRadius: 4, background: statusColor(tk.status ?? "") + "22", color: statusColor(tk.status ?? ""), fontWeight: 600, fontSize: 12 }}>
                    {tk.status}
                  </span>
                </td>
                <td style={sTd}>{tk.priority}</td>
                <td style={sTd}>{deptLabel(tk.department ?? "")}</td>
                <td style={sTd}>{tk.assigned_to ? managerName(tk.assigned_to) : ""}</td>
                <td style={sTd}>{tk.customer_id ? customerName(tk.customer_id) : ""}</td>
                <td style={sTd}>
                  {canManageTasks && (
                    <button
                      style={{ ...sBtn("#ef4444"), padding: "4px 10px", fontSize: 12 }}
                      onClick={(e) => { e.stopPropagation(); setConfirmDel({ type: "task", id: tk.id }); }}
                    >
                      {t.delete}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ═══════ USER MODAL ═══════ */}
      {modal === "user" && (
        <div style={sOverlay} onClick={() => setModal(null)}>
          <div style={sModal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 16px", color: gold }}>{editId ? `${t.users}: ${userForm.first_name}` : t.newUser}</h2>

            {/* Form tabs: General / HR / Permissions */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              <button style={sFormTab(userFormTab === "general")} onClick={() => setUserFormTab("general")}>
                {t.users}
              </button>
              {(canViewHR || canEditHR) && (
                <button style={sFormTab(userFormTab === "hr")} onClick={() => setUserFormTab("hr")}>
                  {t.hrInfo}
                </button>
              )}
              {canManageRoles && (
                <button style={sFormTab(userFormTab === "permissions")} onClick={() => setUserFormTab("permissions")}>
                  {t.permissions}
                </button>
              )}
            </div>

            {/* ── General tab ── */}
            {userFormTab === "general" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={sLabel}>{t.firstName} *</label>
                  <input style={sInput} value={userForm.first_name} onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })} />
                </div>
                <div>
                  <label style={sLabel}>{t.lastName}</label>
                  <input style={sInput} value={userForm.last_name} onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={sLabel}>{t.email} *</label>
                  <input style={sInput} type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
                </div>
                <div>
                  <label style={sLabel}>{t.role}</label>
                  <select style={sSelect} value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as Role })}>
                    {roleNames.map((r) => <option key={r} value={r}>{getRoleLabel(r, lang)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={sLabel}>{t.password} {editId ? "" : "*"}</label>
                  <input style={sInput} type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder={editId ? "leave empty to keep" : ""} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={sLabel}>{t.departments}</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {DEPARTMENTS.map((d) => (
                      <label key={d} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={userForm.departments.includes(d)}
                          onChange={() => {
                            const depts = userForm.departments.includes(d)
                              ? userForm.departments.filter((x) => x !== d)
                              : [...userForm.departments, d];
                            setUserForm({ ...userForm, departments: depts });
                          }}
                        />
                        {deptLabel(d)}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                    <input type="checkbox" checked={userForm.is_active} onChange={(e) => setUserForm({ ...userForm, is_active: e.target.checked })} />
                    {t.active}
                  </label>
                </div>
              </div>
            )}

            {/* ── HR tab ── */}
            {userFormTab === "hr" && (canViewHR || canEditHR) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={sLabel}>{t.entryDate}</label>
                  <input style={sInput} type="date" value={userForm.entry_date} disabled={!canEditHR}
                    onChange={(e) => setUserForm({ ...userForm, entry_date: e.target.value })} />
                </div>
                <div>
                  <label style={sLabel}>{t.exitDate}</label>
                  <input style={sInput} type="date" value={userForm.exit_date} disabled={!canEditHR}
                    onChange={(e) => setUserForm({ ...userForm, exit_date: e.target.value })} />
                </div>
                <div>
                  <label style={sLabel}>{t.contractType}</label>
                  <select style={sSelect} value={userForm.contract_type} disabled={!canEditHR}
                    onChange={(e) => setUserForm({ ...userForm, contract_type: e.target.value })}>
                    {CONTRACT_TYPES.map((c) => <option key={c} value={c}>{t[c.toLowerCase()] ?? c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={sLabel}>{t.salaryType}</label>
                  <select style={sSelect} value={userForm.salary_type} disabled={!canEditHR}
                    onChange={(e) => setUserForm({ ...userForm, salary_type: e.target.value })}>
                    {SALARY_TYPES.map((s) => <option key={s} value={s}>{t[s.toLowerCase()] ?? s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={sLabel}>{t.salaryAmount}</label>
                  <input style={sInput} type="number" step="0.01" value={userForm.salary_amount} disabled={!canEditHR}
                    onChange={(e) => setUserForm({ ...userForm, salary_amount: e.target.value })} />
                </div>
                <div>
                  <label style={sLabel}>{t.workPensum}</label>
                  <input style={sInput} type="number" min="0" max="100" value={userForm.work_pensum} disabled={!canEditHR}
                    onChange={(e) => setUserForm({ ...userForm, work_pensum: e.target.value })} />
                </div>
                <div>
                  <label style={sLabel}>{t.hoursPerWeek}</label>
                  <input style={sInput} type="number" step="0.5" value={userForm.hours_per_week} disabled={!canEditHR}
                    onChange={(e) => setUserForm({ ...userForm, hours_per_week: e.target.value })} />
                </div>
                <div>
                  <label style={sLabel}>{t.ahvNumber}</label>
                  <input style={sInput} value={userForm.ahv_number} disabled={!canEditHR} placeholder="756.XXXX.XXXX.XX"
                    onChange={(e) => setUserForm({ ...userForm, ahv_number: e.target.value })} />
                </div>
                <div>
                  <label style={sLabel}>{t.iban}</label>
                  <input style={sInput} value={userForm.iban} disabled={!canEditHR} placeholder="CH00 0000 0000 0000 0000 0"
                    onChange={(e) => setUserForm({ ...userForm, iban: e.target.value })} />
                </div>
                <div>
                  <label style={sLabel}>{t.nationality}</label>
                  <input style={sInput} value={userForm.nationality} disabled={!canEditHR} placeholder="CH" maxLength={2}
                    onChange={(e) => setUserForm({ ...userForm, nationality: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <label style={sLabel}>{t.permitType}</label>
                  <select style={sSelect} value={userForm.permit_type} disabled={!canEditHR}
                    onChange={(e) => setUserForm({ ...userForm, permit_type: e.target.value })}>
                    {PERMIT_TYPES.map((p) => <option key={p} value={p}>{p || "-"}</option>)}
                  </select>
                </div>
                <div>
                  <label style={sLabel}>{t.maritalStatus}</label>
                  <select style={sSelect} value={userForm.marital_status} disabled={!canEditHR}
                    onChange={(e) => setUserForm({ ...userForm, marital_status: e.target.value })}>
                    <option value="">-</option>
                    {MARITAL_STATUSES.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label style={sLabel}>{t.childrenCount}</label>
                  <input style={sInput} type="number" min="0" value={userForm.children_count} disabled={!canEditHR}
                    onChange={(e) => setUserForm({ ...userForm, children_count: e.target.value })} />
                </div>
                <div>
                  <label style={sLabel}>{t.canton}</label>
                  <select style={sSelect} value={userForm.canton} disabled={!canEditHR}
                    onChange={(e) => setUserForm({ ...userForm, canton: e.target.value })}>
                    <option value="">-</option>
                    {SWISS_CANTONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={sLabel}>{t.bvgCode}</label>
                  <input style={sInput} value={userForm.bvg_code} disabled={!canEditHR}
                    onChange={(e) => setUserForm({ ...userForm, bvg_code: e.target.value })} />
                </div>
              </div>
            )}

            {/* ── Permissions tab ── */}
            {userFormTab === "permissions" && canManageRoles && (
              <div>
                <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>
                  Default permissions for <strong>{roleLabel(userForm.role)}</strong>. Toggle to add or remove overrides for this user.
                </p>
                <RolePermissionMatrix
                  userId={editId ?? undefined}
                  userRole={userForm.role}
                  userCustomAdd={userCustomPerms.add}
                  userCustomRemove={userCustomPerms.remove}
                  onChangeCustom={(add, remove) => setUserCustomPerms({ add, remove })}
                  readOnly={!canManageRoles}
                />
              </div>
            )}

            {/* Modal footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button style={sBtn("#6b7280")} onClick={() => setModal(null)}>{t.cancel}</button>
              <button style={sBtn(gold)} disabled={saving} onClick={saveUser}>
                {saving ? "…" : t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ CUSTOMER MODAL ═══════ */}
      {modal === "customer" && (
        <div style={sOverlay} onClick={() => setModal(null)}>
          <div style={sModal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 16px", color: gold }}>{editId ? t.customers : t.newCustomer}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={sLabel}>{t.name} *</label>
                <input style={sInput} value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>{t.company}</label>
                <input style={sInput} value={customerForm.company} onChange={(e) => setCustomerForm({ ...customerForm, company: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>{t.email}</label>
                <input style={sInput} type="email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>{t.phone}</label>
                <input style={sInput} value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>{t.street}</label>
                <input style={sInput} value={customerForm.street} onChange={(e) => setCustomerForm({ ...customerForm, street: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>{t.city}</label>
                <input style={sInput} value={customerForm.city} onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>{t.postalCode}</label>
                <input style={sInput} value={customerForm.postal_code} onChange={(e) => setCustomerForm({ ...customerForm, postal_code: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>{t.country}</label>
                <input style={sInput} value={customerForm.country} onChange={(e) => setCustomerForm({ ...customerForm, country: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>{t.type}</label>
                <select style={sSelect} value={customerForm.type} onChange={(e) => setCustomerForm({ ...customerForm, type: e.target.value })}>
                  <option value="PRIVATE">Private</option>
                  <option value="COMPANY">Company</option>
                  <option value="PUBLIC">Public</option>
                </select>
              </div>
              <div>
                <label style={sLabel}>{t.status}</label>
                <select style={sSelect} value={customerForm.status} onChange={(e) => setCustomerForm({ ...customerForm, status: e.target.value })}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="LEAD">Lead</option>
                  <option value="PROSPECT">Prospect</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={sLabel}>{t.notes}</label>
                <textarea style={{ ...sInput, minHeight: 60, resize: "vertical" }} value={customerForm.notes} onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button style={sBtn("#6b7280")} onClick={() => setModal(null)}>{t.cancel}</button>
              <button style={sBtn(gold)} disabled={saving} onClick={saveCustomer}>{saving ? "…" : t.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ MACHINE MODAL ═══════ */}
      {modal === "machine" && (
        <div style={sOverlay} onClick={() => setModal(null)}>
          <div style={sModal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 16px", color: gold }}>{editId ? t.machines : t.newMachine}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={sLabel}>{t.name} *</label>
                <input style={sInput} value={machineForm.name} onChange={(e) => setMachineForm({ ...machineForm, name: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>{t.type}</label>
                <input style={sInput} value={machineForm.type} onChange={(e) => setMachineForm({ ...machineForm, type: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>{t.category}</label>
                <select style={sSelect} value={machineForm.category} onChange={(e) => setMachineForm({ ...machineForm, category: e.target.value })}>
                  <option value="">-</option>
                  {MACHINE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={sLabel}>{t.licensePlate}</label>
                <input style={sInput} value={machineForm.license_plate} onChange={(e) => setMachineForm({ ...machineForm, license_plate: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>{t.status}</label>
                <select style={sSelect} value={machineForm.status} onChange={(e) => setMachineForm({ ...machineForm, status: e.target.value })}>
                  {MACHINE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={sLabel}>{t.department}</label>
                <select style={sSelect} value={machineForm.department} onChange={(e) => setMachineForm({ ...machineForm, department: e.target.value })}>
                  <option value="">-</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{deptLabel(d)}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={sLabel}>{t.notes}</label>
                <textarea style={{ ...sInput, minHeight: 60, resize: "vertical" }} value={machineForm.notes} onChange={(e) => setMachineForm({ ...machineForm, notes: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button style={sBtn("#6b7280")} onClick={() => setModal(null)}>{t.cancel}</button>
              <button style={sBtn(gold)} disabled={saving} onClick={saveMachine}>{saving ? "…" : t.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ TASK MODAL ═══════ */}
      {modal === "task" && (
        <div style={sOverlay} onClick={() => setModal(null)}>
          <div style={sModal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 16px", color: gold }}>{editId ? t.tasks : t.newTask}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={sLabel}>{t.title} *</label>
                <input style={sInput} value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={sLabel}>{t.description}</label>
                <textarea style={{ ...sInput, minHeight: 60, resize: "vertical" }} value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>{t.status}</label>
                <select style={sSelect} value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}>
                  {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={sLabel}>{t.priority}</label>
                <select style={sSelect} value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div>
                <label style={sLabel}>{t.department}</label>
                <select style={sSelect} value={taskForm.department} onChange={(e) => setTaskForm({ ...taskForm, department: e.target.value })}>
                  <option value="">-</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{deptLabel(d)}</option>)}
                </select>
              </div>
              <div>
                <label style={sLabel}>{t.assignedTo}</label>
                <select style={sSelect} value={taskForm.assigned_to} onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}>
                  <option value="">-</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name ?? ""}</option>)}
                </select>
              </div>
              <div>
                <label style={sLabel}>{t.customer}</label>
                <select style={sSelect} value={taskForm.customer_id} onChange={(e) => setTaskForm({ ...taskForm, customer_id: e.target.value })}>
                  <option value="">-</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={sLabel}>{t.startDate}</label>
                <input style={sInput} type="date" value={taskForm.start_date} onChange={(e) => setTaskForm({ ...taskForm, start_date: e.target.value })} />
              </div>
              <div>
                <label style={sLabel}>{t.endDate}</label>
                <input style={sInput} type="date" value={taskForm.end_date} onChange={(e) => setTaskForm({ ...taskForm, end_date: e.target.value })} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={sLabel}>{t.notes}</label>
                <textarea style={{ ...sInput, minHeight: 60, resize: "vertical" }} value={taskForm.notes} onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button style={sBtn("#6b7280")} onClick={() => setModal(null)}>{t.cancel}</button>
              <button style={sBtn(gold)} disabled={saving} onClick={saveTask}>{saving ? "…" : t.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ DELETE CONFIRM MODAL ═══════ */}
      {confirmDel && (
        <div style={sOverlay} onClick={() => setConfirmDel(null)}>
          <div style={{ ...sModal, maxWidth: 400, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: "#ef4444", marginBottom: 16 }}>{t.confirmDelete}</h3>
            <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
              <button style={sBtn("#6b7280")} onClick={() => setConfirmDel(null)}>{t.no}</button>
              <button style={sBtn("#ef4444")} onClick={deleteEntity}>{t.yes}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
