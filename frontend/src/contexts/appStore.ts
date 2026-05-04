import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode } from '../styles/theme';
import type { Lang } from '../i18n/translations';

interface AppState {
  theme: ThemeMode;
  lang: Lang;
  sidebarOpen: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLang: (lang: Lang) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark',
      lang: 'de',
      sidebarOpen: true,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setLang: (lang) => set({ lang }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    { name: 'emmenegger-settings' }
  )
);
