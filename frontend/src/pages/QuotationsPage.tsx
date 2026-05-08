// src/pages/CustomersPage.tsx
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useTheme } from "../contexts/themeContext";
import { useAuthStore } from "../contexts/authStore";
import { CsvToolbar } from "../components/CsvToolbar";

const API = import.meta.env.VITE_API_URL ?? "";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Contact {
  id: string;
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  is_primary: boolean;
}

interface Customer {
  id: string;
  name: string;
  type: string;
  company: string;
  street: string;
  postal_code: string;
  city: string;
  canton: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  status: string;
  language: string;
  payment_terms: string;
  notes: string;
  created_at: string;
  updated_at: string;
  total_revenue: number;
  open_invoices: number;
  total_projects: number;
}

/* ------------------------------------------------------------------ */
/*  Translations                                                       */
/* ------------------------------------------------------------------ */
const T: Record<string, Record<string, string>> = {
  de: {
    title: "Kunden",
    addNew: "+ Neuer Kunde",
    search: "Suchen…",
    allTypes: "Alle Typen",
    allStatuses: "Alle Status",
    name: "Name",
    type: "Typ",
    city: "Ort",
    status: "Status",
    phone: "Telefon",
    email: "E-Mail",
    actions: "Aktionen",
    edit: "Bearbeiten",
    delete: "Löschen",
    save: "Speichern",
    cancel: "Abbrechen",
    yes: "Ja",
    no: "Nein",
    confirmDelete: "Wirklich löschen?",
    general: "Allgemein",
    contacts: "Kontakte",
    billing: "Abrechnung",
    notesTab: "Notizen",
    company: "Firma",
    street: "Strasse",
    postalCode: "PLZ",
    canton: "Kanton",
    country: "Land",
    website: "Website",
    language: "Sprache",
    paymentTerms: "Zahlungsbedingungen",
    notes: "Notizen",
    totalRevenue: "Gesamtumsatz",
    openInvoices: "Offene Rechnungen",
    totalProjects: "Projekte gesamt",
    loading: "Laden…",
    noResults: "Keine Ergebnisse",
    total: "Total",
    active: "Aktiv",
    page: "Seite",
    of: "von",
    back: "Zurück",
    firstName: "Vorname",
    lastName: "Nachname",
    role: "Rolle",
    isPrimary: "Hauptkontakt",
    addContact: "+ Kontakt",
    editContact: "Kontakt bearbeiten",
    noContacts: "Keine Kontakte vorhanden",
    imported: "importiert",
    PRIVATE: "Privat",
    COMPANY: "Firma",
    ACTIVE: "Aktiv",
    INACTIVE: "Inaktiv",
    LEAD: "Lead",
    BLOCKED: "Gesperrt",
  },
  en: {
    title: "Customers",
    addNew: "+ New Customer",
    search: "Search…",
    allTypes: "All Types",
    allStatuses: "All Statuses",
    name: "Name",
    type: "Type",
    city: "City",
    status: "Status",
    phone: "Phone",
    email: "Email",
    actions: "Actions",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    yes: "Yes",
    no: "No",
    confirmDelete: "Really delete?",
    general: "General",
    contacts: "Contacts",
    billing: "Billing",
    notesTab: "Notes",
    company: "Company",
    street: "Street",
    postalCode: "Postal Code",
    canton: "Canton",
    country: "Country",
    website: "Website",
    language: "Language",
    paymentTerms: "Payment Terms",
    notes: "Notes",
    totalRevenue: "Total Revenue",
    openInvoices: "Open Invoices",
    totalProjects: "Total Projects",
    loading: "Loading…",
    noResults: "No results",
    total: "Total",
    active: "Active",
    page: "Page",
    of: "of",
    back: "Back",
    firstName: "First Name",
    lastName: "Last Name",
    role: "Role",
    isPrimary: "Primary Contact",
    addContact: "+ Contact",
    editContact: "Edit Contact",
    noContacts: "No contacts yet",
    imported: "imported",
    PRIVATE: "Private",
    COMPANY: "Company",
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    LEAD: "Lead",
    BLOCKED: "Blocked",
  },
  fr: {
    title: "Clients",
    addNew: "+ Nouveau client",
    search: "Rechercher…",
    allTypes: "Tous les types",
    allStatuses: "Tous les statuts",
    name: "Nom",
    type: "Type",
    city: "Ville",
    status: "Statut",
    phone: "Téléphone",
    email: "E-mail",
    actions: "Actions",
    edit: "Modifier",
    delete: "Supprimer",
    save: "Enregistrer",
    cancel: "Annuler",
    yes: "Oui",
    no: "Non",
    confirmDelete: "Vraiment supprimer ?",
    general: "Général",
    contacts: "Contacts",
    billing: "Facturation",
    notesTab: "Notes",
    company: "Entreprise",
    street: "Rue",
    postalCode: "Code postal",
    canton: "Canton",
    country: "Pays",
    website: "Site web",
    language: "Langue",
    paymentTerms: "Conditions de paiement",
    notes: "Notes",
    totalRevenue: "Chiffre d'affaires",
    openInvoices: "Factures ouvertes",
    totalProjects: "Projets totaux",
    loading: "Chargement…",
    noResults: "Aucun résultat",
    total: "Total",
    active: "Actif",
    page: "Page",
    of: "de",
    back: "Retour",
    firstName: "Prénom",
    lastName: "Nom",
    role: "Rôle",
    isPrimary: "Contact principal",
    addContact: "+ Contact",
    editContact: "Modifier le contact",
    noContacts: "Aucun contact",
    imported: "importés",
    PRIVATE: "Privé",
    COMPANY: "Entreprise",
    ACTIVE: "Actif",
    INACTIVE: "Inactif",
    LEAD: "Lead",
    BLOCKED: "Bloqué",
  },
  pt: {
    title: "Clientes",
    addNew: "+ Novo cliente",
    search: "Pesquisar…",
    allTypes: "Todos os tipos",
    allStatuses: "Todos os status",
    name: "Nome",
    type: "Tipo",
    city: "Cidade",
    status: "Status",
    phone: "Telefone",
    email: "E-mail",
    actions: "Ações",
    edit: "Editar",
    delete: "Excluir",
    save: "Salvar",
    cancel: "Cancelar",
    yes: "Sim",
    no: "Não",
    confirmDelete: "Realmente excluir?",
    general: "Geral",
    contacts: "Contatos",
    billing: "Faturamento",
    notesTab: "Notas",
    company: "Empresa",
    street: "Rua",
    postalCode: "CEP",
    canton: "Cantão",
    country: "País",
    website: "Site",
    language: "Idioma",
    paymentTerms: "Condições de pagamento",
    notes: "Notas",
    totalRevenue: "Receita total",
    openInvoices: "Faturas abertas",
    totalProjects: "Projetos totais",
    loading: "Carregando…",
    noResults: "Sem resultados",
    total: "Total",
    active: "Ativo",
    page: "Página",
    of: "de",
    back: "Voltar",
    firstName: "Nome",
    lastName: "Sobrenome",
    role: "Função",
    isPrimary: "Contato principal",
    addContact: "+ Contato",
    editContact: "Editar contato",
    noContacts: "Nenhum contato",
    imported: "importados",
    PRIVATE: "Privado",
    COMPANY: "Empresa",
    ACTIVE: "Ativo",
    INACTIVE: "Inativo",
    LEAD: "Lead",
    BLOCKED: "Bloqueado",
  },
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#2ecc71",
  INACTIVE: "#95a5a6",
  LEAD: "#f39c12",
  BLOCKED: "#e74c3c",
};
const TYPE_ICONS: Record<string, string> = {
  PRIVATE: "👤",
  COMPANY: "🏢",
};
const LANG_NAMES: Record<string, string> = {
  de: "Deutsch",
  en: "English",
  fr: "Français",
  pt: "Português",
};

/* CSV helpers */
const csvColumns = (t: Record<string, string>) => [
  { key: "name", label: t.name },
  { key: "type", label: t.type },
  { key: "company", label: t.company },
  { key: "street", label: t.street },
  { key: "postal_code", label: t.postalCode },
  { key: "city", label: t.city },
  { key: "canton", label: t.canton },
  { key: "phone", label: t.phone },
  { key: "email", label: t.email },
  { key: "website", label: t.website },
  { key: "status", label: t.status },
  { key: "language", label: t.language },
  { key: "payment_terms", label: t.paymentTerms },
  { key: "notes", label: t.notes },
];
const CSV_EXAMPLE_ROWS = [
  {
    name: "Max Muster",
    type: "PRIVATE",
    company: "",
    street: "Bahnhofstrasse 1",
    postal_code: "8001",
    city: "Zürich",
    canton: "ZH",
    phone: "+41 44 123 45 67",
    email: "max@example.ch",
    website: "",
    status: "ACTIVE",
    language: "de",
    payment_terms: "30 Tage netto",
    notes: "",
  },
  {
    name: "Beispiel GmbH",
    type: "COMPANY",
    company: "Beispiel GmbH",
    street: "Bundesplatz 3",
    postal_code: "3001",
    city: "Bern",
    canton: "BE",
    phone: "+41 31 765 43 21",
    email: "info@beispiel.ch",
    website: "https://beispiel.ch",
    status: "ACTIVE",
    language: "de",
    payment_terms: "10 Tage netto",
    notes: "Grosskunde",
  },
];

/* ------------------------------------------------------------------ */
/*  Normalisation helpers                                              */
/* ------------------------------------------------------------------ */
function normalizeCustomer(raw: any): Customer {
  return {
    id: raw.id ?? raw._id ?? "",
    name: raw.name ?? raw.display_name ?? raw.company_name ?? "",
    type: raw.type ?? "PRIVATE",
    company: raw.company ?? raw.company_name ?? "",
    street: raw.street ?? raw.address ?? "",
    postal_code: raw.postal_code ?? raw.zip ?? raw.plz ?? "",
    city: raw.city ?? raw.ort ?? "",
    canton: raw.canton ?? raw.kanton ?? "",
    country: raw.country ?? raw.land ?? "CH",
    phone: raw.phone ?? raw.telefon ?? "",
    email: raw.email ?? "",
    website: raw.website ?? "",
    status: raw.status ?? "ACTIVE",
    language: raw.language ?? raw.sprache ?? "de",
    payment_terms: raw.payment_terms ?? raw.zahlungsbedingungen ?? "",
    notes: raw.notes ?? raw.bemerkungen ?? "",
    created_at: raw.created_at ?? "",
    updated_at: raw.updated_at ?? "",
    total_revenue: Number(raw.total_revenue ?? 0),
    open_invoices: Number(raw.open_invoices ?? 0),
    total_projects: Number(raw.total_projects ?? 0),
  };
}

function customerToForm(c: Customer): Customer {
  return { ...c };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function CustomersPage() {
  const { th, isDark, lang } = useTheme();
  const { token, role } = useAuthStore() as any;
  const t = T[lang] ?? T.de;
  const isManager =
    role === "ADMIN" ||
    role === "GLOBAL_MANAGER" ||
    role === "MANAGER" ||
    role === "admin" ||
    role === "manager";

  /* ---- palette ---- */
  const gold = th.accent ?? "#c8a961";
  const inputBg = isDark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.04)";
  const panelBg = isDark ? "#1e1e3a" : "#fff";
  const dimText = isDark ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.4)";

  /* ---- reusable styles ---- */
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${th.border}`,
    background: inputBg,
    color: th.text,
    fontSize: 14,
  };
  const selectStyle: React.CSSProperties = { ...inputStyle };
  const btnPrimary: React.CSSProperties = {
    padding: "8px 18px",
    borderRadius: 8,
    border: "none",
    background: gold,
    color: "#000",
    fontWeight: 600,
    cursor: "pointer",
  };
  const btnDanger: React.CSSProperties = {
    ...btnPrimary,
    background: "#e74c3c",
    color: "#fff",
  };
  const btnSecondary: React.CSSProperties = {
    padding: "8px 18px",
    borderRadius: 8,
    border: `1px solid ${th.border}`,
    background: isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)",
    color: th.text,
    fontWeight: 600,
    cursor: "pointer",
  };
  const btnClose: React.CSSProperties = {
    ...btnSecondary,
    padding: "6px 14px",
  };
  const paginationBtn = (disabled: boolean): React.CSSProperties => ({
    padding: "6px 16px",
    borderRadius: 8,
    border: `1px solid ${th.border}`,
    background: disabled
      ? isDark
        ? "rgba(255,255,255,.04)"
        : "rgba(0,0,0,.04)"
      : isDark
      ? "rgba(255,255,255,.1)"
      : "rgba(0,0,0,.07)",
    color: disabled ? dimText : th.text,
    cursor: disabled ? "default" : "pointer",
    fontWeight: 600,
  });
  const contactBtnSmall = (bg: string): React.CSSProperties => ({
    padding: "4px 12px",
    borderRadius: 6,
    border: "none",
    background: bg,
    color: bg === "#e74c3c" ? "#fff" : "#000",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  });
  const statCard: React.CSSProperties = {
    padding: "10px 20px",
    borderRadius: 10,
    background: isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)",
    textAlign: "center",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 4,
    fontSize: 12,
    color: dimText,
  };
  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "10px 12px",
    fontSize: 13,
    color: dimText,
    borderBottom: `1px solid ${th.border}`,
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 14,
    borderBottom: `1px solid ${th.border}`,
  };

  /* ---- state ---- */
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<Customer | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactForm, setContactForm] = useState<Partial<Contact> | null>(
    null
  );
  const [editingContact, setEditingContact] = useState<string | null>(null);

  const [tab, setTab] = useState<"general" | "contacts" | "billing" | "notes">(
    "general"
  );
  const [toast, setToast] = useState<{
    msg: string;
    type: "ok" | "err";
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const panelOpen = selected !== null || editing;

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ---- helpers ---- */
  const headers = (): HeadersInit => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat(lang === "de" ? "de-CH" : lang, {
      style: "currency",
      currency: "CHF",
    }).format(v);

  /* ---- data fetching ---- */
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.append("search", search);
      if (filterType) params.append("type", filterType);
      if (filterStatus) params.append("status", filterStatus);
      const res = await fetch(`${API}/api/v1/customers?${params}`, {
        headers: headers(),
      });
      const json = await res.json();
      const list: any[] = json.data ?? json.items ?? json ?? [];
      setCustomers(list.map(normalizeCustomer));
      setTotalCount(json.total ?? json.totalCount ?? list.length);
    } catch {
      showToast("Fetch error", "err");
    } finally {
      setLoading(false);
    }
  }, [page, search, filterType, filterStatus, token]);

  const fetchAllCustomers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/customers?pageSize=9999`, {
        headers: headers(),
      });
      const json = await res.json();
      const list: any[] = json.data ?? json.items ?? json ?? [];
      setAllCustomers(list.map(normalizeCustomer));
    } catch {
      /* silent */
    }
  }, [token]);

  const fetchDetail = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`${API}/api/v1/customers/${id}`, {
          headers: headers(),
        });
        const json = await res.json();
        const raw = json.data ?? json;
        console.log("[fetchDetail] raw:", raw);
        const cust = normalizeCustomer(raw);
        console.log("[fetchDetail] normalized:", cust);
        setSelected(cust);

        /* contacts */
        try {
          const cRes = await fetch(
            `${API}/api/v1/contacts?customer_id=${id}`,
            { headers: headers() }
          );
          const cJson = await cRes.json();
          setContacts(cJson.data ?? cJson.items ?? cJson ?? []);
        } catch {
          setContacts([]);
        }
      } catch {
        showToast("Detail fetch error", "err");
      }
    },
    [token]
  );

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);
  useEffect(() => {
    fetchAllCustomers();
  }, [fetchAllCustomers]);

  /* ---- CRUD: customer ---- */
  const saveCustomer = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const isNew = !form.id;
      const url = isNew
        ? `${API}/api/v1/customers`
        : `${API}/api/v1/customers/${form.id}`;
      const method = isNew ? "POST" : "PUT";

      const body: any = {
        name: form.name,
        type: form.type || "PRIVATE",
        company: form.company,
        street: form.street,
        postal_code: form.postal_code,
        city: form.city,
        canton: form.canton,
        country: form.country || "CH",
        phone: form.phone,
        email: form.email,
        website: form.website,
        status: form.status || "ACTIVE",
        language: form.language || "de",
        payment_terms: form.payment_terms,
        notes: form.notes,
      };

      const res = await fetch(url, {
        method,
        headers: headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const saved = normalizeCustomer(json.data ?? json);

      if (isNew) {
        showToast(`${saved.name} created`);
        closeDetail();
      } else {
        /* update selected + list row from server response */
        setSelected(saved);
        setCustomers((prev) =>
          prev.map((c) => (c.id === saved.id ? saved : c))
        );
        setEditing(false);
        setForm(null);
        showToast(`${saved.name} saved`);
      }
      fetchCustomers();
      fetchAllCustomers();
    } catch (e: any) {
      showToast(e.message ?? "Save error", "err");
    } finally {
      setSaving(false);
    }
  };

  const deleteCustomer = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/v1/customers/${selected.id}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(`${selected.name} deleted`);
      closeDetail();
      fetchCustomers();
      fetchAllCustomers();
    } catch (e: any) {
      showToast(e.message ?? "Delete error", "err");
    } finally {
      setSaving(false);
    }
  };

  /* ---- CRUD: contact ---- */
  const saveContact = async () => {
    if (!contactForm || !selected) return;
    setSaving(true);
    try {
      const isNew = !editingContact;
      const url = isNew
        ? `${API}/api/v1/contacts`
        : `${API}/api/v1/contacts/${editingContact}`;
      const method = isNew ? "POST" : "PUT";
      const payload = { ...contactForm, customer_id: selected.id };
      const res = await fetch(url, {
        method,
        headers: headers(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(isNew ? "Contact added" : "Contact saved");
      setContactForm(null);
      setEditingContact(null);
      /* refresh contacts from DB */
      const cRes = await fetch(
        `${API}/api/v1/contacts?customer_id=${selected.id}`,
        { headers: headers() }
      );
      const cJson = await cRes.json();
      setContacts(cJson.data ?? cJson.items ?? cJson ?? []);
    } catch (e: any) {
      showToast(e.message ?? "Contact save error", "err");
    } finally {
      setSaving(false);
    }
  };

  const deleteContact = async (id: string) => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/v1/contacts/${id}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast("Contact deleted");
      const cRes = await fetch(
        `${API}/api/v1/contacts?customer_id=${selected.id}`,
        { headers: headers() }
      );
      const cJson = await cRes.json();
      setContacts(cJson.data ?? cJson.items ?? cJson ?? []);
    } catch (e: any) {
      showToast(e.message ?? "Contact delete error", "err");
    } finally {
      setSaving(false);
    }
  };

  /* ---- CSV import ---- */
  const handleCsvImport = async (rows: Record<string, string>[]) => {
    let ok = 0;
    let fail = 0;
    for (const row of rows) {
      try {
        const res = await fetch(`${API}/api/v1/customers`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            name: row.name,
            type: row.type || "PRIVATE",
            company: row.company ?? "",
            street: row.street ?? "",
            postal_code: row.postal_code ?? "",
            city: row.city ?? "",
            canton: row.canton ?? "",
            country: row.country ?? "CH",
            phone: row.phone ?? "",
            email: row.email ?? "",
            website: row.website ?? "",
            status: row.status || "ACTIVE",
            language: row.language || "de",
            payment_terms: row.payment_terms ?? "",
            notes: row.notes ?? "",
          }),
        });
        if (res.ok) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }
    fetchCustomers();
    fetchAllCustomers();
    const msg = fail
      ? `${ok} ${t.imported} (${fail} failed)`
      : `${ok} ${t.imported}`;
    showToast(msg, fail ? "err" : "ok");
  };

  /* ---- navigation helpers ---- */
  const closeDetail = () => {
    setSelected(null);
    setEditing(false);
    setForm(null);
    setConfirmDelete(false);
    setContactForm(null);
    setEditingContact(null);
    setTab("general");
  };

  const openCreate = () => {
    const blank: Customer = {
      id: "",
      name: "",
      type: "PRIVATE",
      company: "",
      street: "",
      postal_code: "",
      city: "",
      canton: "",
      country: "CH",
      phone: "",
      email: "",
      website: "",
      status: "ACTIVE",
      language: "de",
      payment_terms: "",
      notes: "",
      created_at: "",
      updated_at: "",
      total_revenue: 0,
      open_invoices: 0,
      total_projects: 0,
    };
    setSelected(null);
    setForm(blank);
    setEditing(true);
    setTab("general");
  };

  const startEdit = () => {
    if (!selected) return;
    setForm(customerToForm(selected));
    setEditing(true);
  };

  const cancelEdit = () => {
    if (!form?.id) {
      /* was creating new */
      closeDetail();
    } else {
      setEditing(false);
      setForm(null);
    }
  };

  /* ---- derived ---- */
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const activeCount = customers.filter((c) => c.status === "ACTIVE").length;

  const csvData = useMemo(
    () =>
      allCustomers.map((c) => ({
        name: c.name,
        type: c.type,
        company: c.company,
        street: c.street,
        postal_code: c.postal_code,
        city: c.city,
        canton: c.canton,
        phone: c.phone,
        email: c.email,
        website: c.website,
        status: c.status,
        language: c.language,
        payment_terms: c.payment_terms,
        notes: c.notes,
      })),
    [allCustomers]
  );

  /* ---- form field updater ---- */
  const setField = (key: keyof Customer, value: string) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div style={{ padding: 24, color: th.text, fontFamily: "inherit" }}>
      {/* toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 9999,
            padding: "12px 24px",
            borderRadius: 10,
            background: toast.type === "ok" ? "#2ecc71" : "#e74c3c",
            color: "#fff",
            fontWeight: 600,
            boxShadow: "0 4px 20px rgba(0,0,0,.25)",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* ---- LIST VIEW ---- */}
      {!panelOpen && (
        <>
          {/* header */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
              gap: 12,
            }}
          >
            <h1 style={{ margin: 0, fontSize: 26, color: gold }}>
              {t.title}
            </h1>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={statCard}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {totalCount}
                </div>
                <div style={{ fontSize: 11, color: dimText }}>{t.total}</div>
              </div>
              <div style={statCard}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#2ecc71" }}>
                  {activeCount}
                </div>
                <div style={{ fontSize: 11, color: dimText }}>{t.active}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <CsvToolbar
                columns={csvColumns(t)}
                data={csvData}
                filename="customers"
                exampleRows={CSV_EXAMPLE_ROWS}
                onImport={handleCsvImport}
                validators={{ name: (value: string) => (value ? null : "name required") }}
                canImport={isManager}
              />
              {isManager && (
                <button style={btnPrimary} onClick={openCreate}>
                  {t.addNew}
                </button>
              )}
            </div>
          </div>

          {/* filters */}
          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <input
              style={{ ...inputStyle, maxWidth: 260 }}
              placeholder={t.search}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              style={{ ...selectStyle, maxWidth: 160 }}
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t.allTypes}</option>
              <option value="PRIVATE">{t.PRIVATE}</option>
              <option value="COMPANY">{t.COMPANY}</option>
            </select>
            <select
              style={{ ...selectStyle, maxWidth: 160 }}
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t.allStatuses}</option>
              <option value="ACTIVE">{t.ACTIVE}</option>
              <option value="INACTIVE">{t.INACTIVE}</option>
              <option value="LEAD">{t.LEAD}</option>
              <option value="BLOCKED">{t.BLOCKED}</option>
            </select>
          </div>

          {/* loading */}
          {loading && (
            <div style={{ textAlign: "center", padding: 40, color: dimText }}>
              {t.loading}
            </div>
          )}

          {/* table */}
          {!loading && (
            <>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 14,
                  }}
                >
                  <thead>
                    <tr>
                      <th style={thStyle}>{t.name}</th>
                      <th style={thStyle}>{t.type}</th>
                      <th style={thStyle}>{t.city}</th>
                      <th style={thStyle}>{t.phone}</th>
                      <th style={thStyle}>{t.email}</th>
                      <th style={thStyle}>{t.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            textAlign: "center",
                            padding: 30,
                            color: dimText,
                          }}
                        >
                          {t.noResults}
                        </td>
                      </tr>
                    )}
                    {customers.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => fetchDetail(c.id)}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = isDark
                            ? "rgba(255,255,255,.04)"
                            : "rgba(0,0,0,.02)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <td style={tdStyle}>
                          {TYPE_ICONS[c.type] ?? ""} {c.name}
                        </td>
                        <td style={tdStyle}>{t[c.type] ?? c.type}</td>
                        <td style={tdStyle}>{c.city}</td>
                        <td style={tdStyle}>{c.phone}</td>
                        <td style={tdStyle}>{c.email}</td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 10px",
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 600,
                              background:
                                (STATUS_COLORS[c.status] ?? "#888") + "22",
                              color: STATUS_COLORS[c.status] ?? "#888",
                            }}
                          >
                            {t[c.status] ?? c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* pagination */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 14,
                  marginTop: 18,
                }}
              >
                <button
                  style={paginationBtn(page <= 1)}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ◀
                </button>
                <span style={{ fontSize: 14, color: dimText }}>
                  {t.page} {page} {t.of} {totalPages}
                </span>
                <button
                  style={paginationBtn(page >= totalPages)}
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  ▶
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* ---- DETAIL / EDIT PANEL ---- */}
      {panelOpen && (
        <div ref={panelRef}>
          {/* toolbar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <button style={btnSecondary} onClick={closeDetail}>
              ◀ {t.back}
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              {editing ? (
                <>
                  <button
                    style={btnPrimary}
                    onClick={saveCustomer}
                    disabled={saving}
                  >
                    {saving ? "…" : t.save}
                  </button>
                  <button style={btnSecondary} onClick={cancelEdit}>
                    {t.cancel}
                  </button>
                </>
              ) : (
                isManager && (
                  <>
                    <button style={btnPrimary} onClick={startEdit}>
                      {t.edit}
                    </button>
                    {!confirmDelete ? (
                      <button
                        style={btnDanger}
                        onClick={() => setConfirmDelete(true)}
                      >
                        {t.delete}
                      </button>
                    ) : (
                      <>
                        <button style={btnDanger} onClick={deleteCustomer}>
                          {t.yes}
                        </button>
                        <button
                          style={btnSecondary}
                          onClick={() => setConfirmDelete(false)}
                        >
                          {t.no}
                        </button>
                      </>
                    )}
                  </>
                )
              )}
            </div>
          </div>

          {/* panel card */}
          <div
            style={{
              background: panelBg,
              borderRadius: 14,
              border: `1px solid ${th.border}`,
              padding: 28,
            }}
          >
            {/* title */}
            <h2 style={{ margin: "0 0 18px", color: gold }}>
              {editing
                ? form?.id
                  ? form.name || t.edit
                  : t.addNew
                : selected?.name}
            </h2>

            {/* tabs (only when viewing existing) */}
            {(selected || form?.id) && (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginBottom: 20,
                  flexWrap: "wrap",
                }}
              >
                {(
                  ["general", "contacts", "billing", "notes"] as const
                ).map((k) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    style={{
                      padding: "6px 16px",
                      borderRadius: 8,
                      border:
                        tab === k ? `2px solid ${gold}` : `1px solid ${th.border}`,
                      background:
                        tab === k
                          ? gold + "22"
                          : isDark
                          ? "rgba(255,255,255,.05)"
                          : "rgba(0,0,0,.03)",
                      color: tab === k ? gold : th.text,
                      fontWeight: tab === k ? 700 : 500,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    {t[k === "notes" ? "notesTab" : k]}
                  </button>
                ))}
              </div>
            )}

            {/* ============ GENERAL TAB ============ */}
            {tab === "general" && editing && form && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div>
                  <label style={labelStyle}>{t.name}</label>
                  <input
                    style={inputStyle}
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t.type}</label>
                  <select
                    style={selectStyle}
                    value={form.type}
                    onChange={(e) => setField("type", e.target.value)}
                  >
                    <option value="PRIVATE">{t.PRIVATE}</option>
                    <option value="COMPANY">{t.COMPANY}</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{t.company}</label>
                  <input
                    style={inputStyle}
                    value={form.company}
                    onChange={(e) => setField("company", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t.street}</label>
                  <input
                    style={inputStyle}
                    value={form.street}
                    onChange={(e) => setField("street", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t.postalCode}</label>
                  <input
                    style={inputStyle}
                    value={form.postal_code}
                    onChange={(e) => setField("postal_code", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t.city}</label>
                  <input
                    style={inputStyle}
                    value={form.city}
                    onChange={(e) => setField("city", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t.canton}</label>
                  <input
                    style={inputStyle}
                    value={form.canton}
                    onChange={(e) => setField("canton", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t.country}</label>
                  <input
                    style={inputStyle}
                    value={form.country}
                    onChange={(e) => setField("country", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t.phone}</label>
                  <input
                    style={inputStyle}
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t.email}</label>
                  <input
                    style={inputStyle}
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t.website}</label>
                  <input
                    style={inputStyle}
                    value={form.website}
                    onChange={(e) => setField("website", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t.status}</label>
                  <select
                    style={selectStyle}
                    value={form.status}
                    onChange={(e) => setField("status", e.target.value)}
                  >
                    <option value="ACTIVE">{t.ACTIVE}</option>
                    <option value="INACTIVE">{t.INACTIVE}</option>
                    <option value="LEAD">{t.LEAD}</option>
                    <option value="BLOCKED">{t.BLOCKED}</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{t.language}</label>
                  <select
                    style={selectStyle}
                    value={form.language}
                    onChange={(e) => setField("language", e.target.value)}
                  >
                    <option value="de">Deutsch</option>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="pt">Português</option>
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>{t.paymentTerms}</label>
                  <input
                    style={inputStyle}
                    value={form.payment_terms}
                    onChange={(e) => setField("payment_terms", e.target.value)}
                  />
                </div>
              </div>
            )}

            {tab === "general" && !editing && selected && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                }}
              >
                {(
                  [
                    ["name", t.name],
                    ["type", t.type],
                    ["company", t.company],
                    ["street", t.street],
                    ["postal_code", t.postalCode],
                    ["city", t.city],
                    ["canton", t.canton],
                    ["country", t.country],
                    ["phone", t.phone],
                    ["email", t.email],
                    ["website", t.website],
                    ["status", t.status],
                    ["language", t.language],
                    ["payment_terms", t.paymentTerms],
                  ] as [keyof Customer, string][]
                ).map(([key, label]) => {
                  let display = String(selected[key] ?? "");
                  if (key === "type") display = t[selected.type] ?? display;
                  if (key === "status")
                    display = t[selected.status] ?? display;
                  if (key === "language")
                    display = LANG_NAMES[selected.language] ?? display;
                  return (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: dimText }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 14, marginTop: 2 }}>
                        {display || "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ============ CONTACTS TAB ============ */}
            {tab === "contacts" && selected && (
              <div>
                {contacts.length === 0 && !contactForm && (
                  <p style={{ color: dimText }}>{t.noContacts}</p>
                )}
                {contacts.map((ct) => (
                  <div
                    key={ct.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: `1px solid ${th.border}`,
                    }}
                  >
                    <div>
                      <strong>
                        {ct.first_name} {ct.last_name}
                      </strong>{" "}
                      {ct.is_primary && "⭐"}{" "}
                      <span style={{ fontSize: 12, color: dimText }}>
                        {ct.role}
                      </span>
                      <div style={{ fontSize: 13, color: dimText }}>
                        {ct.email} {ct.phone && `· ${ct.phone}`}
                      </div>
                    </div>
                    {isManager && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          style={contactBtnSmall(gold)}
                          onClick={() => {
                            setContactForm({ ...ct });
                            setEditingContact(ct.id);
                          }}
                        >
                          {t.edit}
                        </button>
                        <button
                          style={contactBtnSmall("#e74c3c")}
                          onClick={() => deleteContact(ct.id)}
                        >
                          {t.delete}
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* contact form */}
                {contactForm && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 16,
                      borderRadius: 10,
                      background: isDark
                        ? "rgba(255,255,255,.04)"
                        : "rgba(0,0,0,.02)",
                    }}
                  >
                    <h4 style={{ margin: "0 0 10px", color: gold }}>
                      {editingContact ? t.editContact : t.addContact}
                    </h4>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                      }}
                    >
                      <div>
                        <label style={labelStyle}>{t.firstName}</label>
                        <input
                          style={inputStyle}
                          value={contactForm.first_name ?? ""}
                          onChange={(e) =>
                            setContactForm({
                              ...contactForm,
                              first_name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>{t.lastName}</label>
                        <input
                          style={inputStyle}
                          value={contactForm.last_name ?? ""}
                          onChange={(e) =>
                            setContactForm({
                              ...contactForm,
                              last_name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>{t.email}</label>
                        <input
                          style={inputStyle}
                          value={contactForm.email ?? ""}
                          onChange={(e) =>
                            setContactForm({
                              ...contactForm,
                              email: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>{t.phone}</label>
                        <input
                          style={inputStyle}
                          value={contactForm.phone ?? ""}
                          onChange={(e) =>
                            setContactForm({
                              ...contactForm,
                              phone: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>{t.role}</label>
                        <input
                          style={inputStyle}
                          value={contactForm.role ?? ""}
                          onChange={(e) =>
                            setContactForm({
                              ...contactForm,
                              role: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          paddingTop: 22,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={contactForm.is_primary ?? false}
                          onChange={(e) =>
                            setContactForm({
                              ...contactForm,
                              is_primary: e.target.checked,
                            })
                          }
                        />
                        <span style={{ fontSize: 13 }}>{t.isPrimary}</span>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 12,
                      }}
                    >
                      <button style={btnPrimary} onClick={saveContact}>
                        {t.save}
                      </button>
                      <button
                        style={btnSecondary}
                        onClick={() => {
                          setContactForm(null);
                          setEditingContact(null);
                        }}
                      >
                        {t.cancel}
                      </button>
                    </div>
                  </div>
                )}

                {/* add contact button */}
                {!contactForm && isManager && (
                  <button
                    style={{ ...btnPrimary, marginTop: 14 }}
                    onClick={() =>
                      setContactForm({
                        first_name: "",
                        last_name: "",
                        email: "",
                        phone: "",
                        role: "",
                        is_primary: false,
                      })
                    }
                  >
                    {t.addContact}
                  </button>
                )}
              </div>
            )}

            {/* ============ BILLING TAB ============ */}
            {tab === "billing" && selected && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 18,
                }}
              >
                <div style={statCard}>
                  <div style={{ fontSize: 11, color: dimText }}>
                    {t.totalRevenue}
                  </div>
                  <div
                    style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}
                  >
                    {formatCurrency(selected.total_revenue)}
                  </div>
                </div>
                <div style={statCard}>
                  <div style={{ fontSize: 11, color: dimText }}>
                    {t.openInvoices}
                  </div>
                  <div
                    style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}
                  >
                    {selected.open_invoices}
                  </div>
                </div>
                <div style={statCard}>
                  <div style={{ fontSize: 11, color: dimText }}>
                    {t.totalProjects}
                  </div>
                  <div
                    style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}
                  >
                    {selected.total_projects}
                  </div>
                </div>
              </div>
            )}

            {/* ============ NOTES TAB ============ */}
            {tab === "notes" && editing && form && (
              <div>
                <label style={labelStyle}>{t.notes}</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 160, resize: "vertical" }}
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                />
              </div>
            )}

            {tab === "notes" && !editing && selected && (
              <div>
                <div style={{ fontSize: 11, color: dimText, marginBottom: 6 }}>
                  {t.notes}
                </div>
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  {selected.notes || "—"}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
