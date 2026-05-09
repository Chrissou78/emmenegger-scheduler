import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Lang = 'de' | 'en' | 'fr' | 'pt';

const SUPPORTED_LANGS: Lang[] = ['de', 'en', 'fr', 'pt'];

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  th: Record<string, string>;
  t: Record<string, any>;
  mode: 'dark' | 'light';
  lang: Lang;
  setLanguage: (l: Lang) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const themes = {
  dark: {
    bg: '#0a0a0a', bgCard: '#1a1a1a', bgHeader: '#0f0f0f',
    gold: '#d4af37', goldDim: '#b8941f', goldFaint: '#8b7c1f', goldGhost: '#2a2415',
    text: '#ffffff', textMuted: '#b0b0b0', textDim: '#707070', textGhost: '#404040',
    border: '#333333', borderFaint: '#222222', primary: '#d4af37',
    cellHover: '#1a1a2e', rowHover: '#161625', switchActive: '#2a2a3e',
    headerBg: '#0f0f0f', buttonBg: '#1a1a1a', buttonBgHover: '#252525',
    modalBg: 'rgba(0,0,0,0.7)', modalCard: '#1a1a1a',
    toastBg: '#2a2a2a', toastText: '#ffffff', toastBorder: '#444444',
    toastErrBg: '#4d1a1a', toastErrText: '#ff6b6b', toastErrBorder: '#8b3333',
    scrollThumb: '#555555',
    empName: '#ffffff', empNameSel: '#d4af37',
    roleV: '#4ecdc4', roleM: '#ff6b9d',
    legendItemBg: '#1a1a1a', legendCountActive: '#d4af37', legendCountInactive: '#707070',
    btnBg: '#2a2a2a', btnBgHover: '#3a3a3a', switchBg: '#1a1a1a',
    logoRotateBorder: '#d4af37',
    toast: '#333333', legend: '#1a1a1a', legendText: '#ffffff',
    emptyJobBg: '#333333', emptyJobText: '#999999',
  },
  light: {
    bg: '#ffffff', bgCard: '#f5f5f5', bgHeader: '#ffffff',
    gold: '#c9a961', goldDim: '#9d7f3e', goldFaint: '#d4af37', goldGhost: '#f0e6d2',
    text: '#000000', textMuted: '#666666', textDim: '#999999', textGhost: '#cccccc',
    border: '#dddddd', borderFaint: '#eeeeee', primary: '#c9a961',
    cellHover: '#f0f0f0', rowHover: '#f8f8f8', switchActive: '#e8e8e8',
    headerBg: '#ffffff', buttonBg: '#f5f5f5', buttonBgHover: '#e8e8e8',
    modalBg: 'rgba(0,0,0,0.5)', modalCard: '#ffffff',
    toastBg: '#f8f8f8', toastText: '#000000', toastBorder: '#dddddd',
    toastErrBg: '#f8d7da', toastErrText: '#721c24', toastErrBorder: '#f5c6cb',
    scrollThumb: '#cccccc',
    empName: '#000000', empNameSel: '#c9a961',
    roleV: '#2c9b8b', roleM: '#d85b8f',
    legendItemBg: '#f5f5f5', legendCountActive: '#c9a961', legendCountInactive: '#999999',
    btnBg: '#f5f5f5', btnBgHover: '#e0e0e0', switchBg: '#ffffff',
    logoRotateBorder: '#c9a961',
    toast: '#f5f5f5', legend: '#ffffff', legendText: '#000000',
    emptyJobBg: '#f0f0f0', emptyJobText: '#cccccc',
  },
};

export const translations: Record<Lang, Record<string, any>> = {
  de: {
    brand: 'Emmenegger', sub: 'Disposition & Planung',
    employees: 'Mitarbeiter', assignments: 'Zuweisungen',
    absences: 'Absenzen', absenzen: 'Absenzen',
    objekte: 'Objekte', objects: 'Objekte', today: 'Heute',
    days: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
    abs: { 1: 'Krankheit', 2: 'Urlaub', 3: 'Fortbildung', 4: 'Dienstreise', 5: 'Homeoffice', 6: 'Sonstiges' },
    login: 'Anmelden', email: 'E-Mail', password: 'Passwort', forgotPw: 'Passwort vergessen?',
    logout: 'Abmelden', profile: 'Profil', admin: 'Verwaltung', machines: 'Maschinen',
    schedule: 'Disposition', reports: 'Meine Woche', stats: 'Statistiken',
    users: 'Benutzer', customers: 'Kunden', tasks: 'Aufträge',
    save: 'Speichern', cancel: 'Abbrechen', delete: 'Löschen', add: 'Hinzufügen',
    search: 'Suchen...', noResults: 'Keine Ergebnisse', loading: 'Laden...',
    darkMode: 'Dunkelmodus', lightMode: 'Hellmodus', language: 'Sprache',
    navSchedule: 'Disposition', navMachines: 'Maschinen', navTasks: 'Aufträge',
    navCustomers: 'Kunden', navQuotations: 'Offerten', navInvoices: 'Rechnungen',
    navReports: 'Meine Woche', navStats: 'Statistiken', navAdmin: 'Benutzerverwaltung',
    navHR: 'Personal', navProfile: 'Profil',
  },
  en: {
    brand: 'Emmenegger', sub: 'Scheduling & Planning',
    employees: 'Employees', assignments: 'Assignments',
    absences: 'Absences', absenzen: 'Absences',
    objekte: 'Objects', objects: 'Objects', today: 'Today',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    abs: { 1: 'Illness', 2: 'Vacation', 3: 'Training', 4: 'Business Trip', 5: 'Home Office', 6: 'Other' },
    login: 'Login', email: 'Email', password: 'Password', forgotPw: 'Forgot password?',
    logout: 'Logout', profile: 'Profile', admin: 'Administration', machines: 'Machines',
    schedule: 'Schedule', reports: 'My Week', stats: 'Statistics',
    users: 'Users', customers: 'Customers', tasks: 'Tasks',
    save: 'Save', cancel: 'Cancel', delete: 'Delete', add: 'Add',
    search: 'Search...', noResults: 'No results', loading: 'Loading...',
    darkMode: 'Dark mode', lightMode: 'Light mode', language: 'Language',
    navSchedule: 'Schedule', navMachines: 'Machines', navTasks: 'Tasks',
    navCustomers: 'Customers', navQuotations: 'Quotations', navInvoices: 'Invoices',
    navReports: 'My Week', navStats: 'Statistics', navAdmin: 'User Management',
    navHR: 'HR', navProfile: 'Profile',
  },
  fr: {
    brand: 'Emmenegger', sub: 'Disposition & Planification',
    employees: 'Employés', assignments: 'Attributions',
    absences: 'Absences', absenzen: 'Absences',
    objekte: 'Objets', objects: 'Objets', today: "Aujourd'hui",
    days: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
    abs: { 1: 'Maladie', 2: 'Vacances', 3: 'Formation', 4: 'Déplacement', 5: 'Télétravail', 6: 'Autre' },
    login: 'Connexion', email: 'E-mail', password: 'Mot de passe', forgotPw: 'Mot de passe oublié?',
    logout: 'Déconnexion', profile: 'Profil', admin: 'Administration', machines: 'Machines',
    schedule: 'Disposition', reports: 'Ma Semaine', stats: 'Statistiques',
    users: 'Utilisateurs', customers: 'Clients', tasks: 'Tâches',
    save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer', add: 'Ajouter',
    search: 'Rechercher...', noResults: 'Aucun résultat', loading: 'Chargement...',
    darkMode: 'Mode sombre', lightMode: 'Mode clair', language: 'Langue',
    navSchedule: 'Disposition', navMachines: 'Machines', navTasks: 'Tâches',
    navCustomers: 'Clients', navQuotations: 'Devis', navInvoices: 'Factures',
    navReports: 'Ma Semaine', navStats: 'Statistiques', navAdmin: 'Gestion des utilisateurs',
    navHR: 'RH', navProfile: 'Profil',
  },
  pt: {
    brand: 'Emmenegger', sub: 'Disposição & Planejamento',
    employees: 'Funcionários', assignments: 'Atribuições',
    absences: 'Ausências', absenzen: 'Ausências',
    objekte: 'Objetos', objects: 'Objetos', today: 'Hoje',
    days: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
    abs: { 1: 'Doença', 2: 'Férias', 3: 'Formação', 4: 'Viagem', 5: 'Home Office', 6: 'Outro' },
    login: 'Entrar', email: 'E-mail', password: 'Senha', forgotPw: 'Esqueceu a senha?',
    logout: 'Sair', profile: 'Perfil', admin: 'Administração', machines: 'Máquinas',
    schedule: 'Disposição', reports: 'Minha Semana', stats: 'Estatísticas',
    users: 'Usuários', customers: 'Clientes', tasks: 'Tarefas',
    save: 'Salvar', cancel: 'Cancelar', delete: 'Excluir', add: 'Adicionar',
    search: 'Pesquisar...', noResults: 'Sem resultados', loading: 'Carregando...',
    darkMode: 'Modo escuro', lightMode: 'Modo claro', language: 'Idioma',
    navSchedule: 'Disposição', navMachines: 'Máquinas', navTasks: 'Tarefas',
    navCustomers: 'Clientes', navQuotations: 'Orçamentos', navInvoices: 'Faturas',
    navReports: 'Minha Semana', navStats: 'Estatísticas', navAdmin: 'Gestão de utilizadores',
    navHR: 'RH', navProfile: 'Perfil',
  },
};

/**
 * Detects the best matching supported language from the browser.
 * Checks navigator.languages (ordered preference list), then navigator.language.
 * Matches both exact codes ("pt") and regional variants ("pt-BR" → "pt").
 * Falls back to 'en' if nothing matches.
 */
function detectBrowserLang(): Lang {
  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  for (const raw of candidates) {
    const code = raw.toLowerCase();
    if (SUPPORTED_LANGS.includes(code as Lang)) return code as Lang;
    const prefix = code.split('-')[0] as Lang;
    if (SUPPORTED_LANGS.includes(prefix)) return prefix;
  }

  return 'en';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    return saved ? JSON.parse(saved) : true;
  });

  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('lang') as Lang | null;
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
    return detectBrowserLang();
  });

  useEffect(() => {
    localStorage.setItem('theme', JSON.stringify(isDark));
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  const th = isDark ? themes.dark : themes.light;
  const t = translations[lang];

  const setLanguage = (l: Lang) => {
    setLang(l);
  };

  return (
    <ThemeContext.Provider value={{
      isDark,
      toggleTheme: () => setIsDark(prev => !prev),
      th,
      t,
      mode: isDark ? 'dark' : 'light',
      lang,
      setLanguage,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
