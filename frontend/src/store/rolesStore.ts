// src/store/rolesStore.ts
import { create } from "zustand";
import type { Permission } from "../../../shared/constants/roles";
import { DEFAULT_ROLE_PERMISSIONS } from "../../../shared/constants/roles";

const API = import.meta.env.VITE_API_URL ?? "";

export interface RoleDefinition {
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

interface RolesState {
  roles: RoleDefinition[];
  loaded: boolean;
  /** role name → Permission[] map for resolvePermissions() */
  permissionMap: Record<string, Permission[]>;
  fetchRoles: (token: string) => Promise<void>;
  getRoleLabel: (roleName: string, lang: string) => string;
  getRoleNames: () => string[];
}

export const useRolesStore = create<RolesState>((set, get) => ({
  roles: [],
  loaded: false,
  permissionMap: { ...DEFAULT_ROLE_PERMISSIONS },

  fetchRoles: async (token: string) => {
    try {
      const r = await fetch(`${API}/api/v1/settings/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      const roles: RoleDefinition[] = j.data ?? j ?? [];

      const permissionMap: Record<string, Permission[]> = {};
      for (const role of roles) {
        if (role.is_active) {
          permissionMap[role.name] = role.permissions;
        }
      }

      set({ roles, loaded: true, permissionMap });
    } catch {
      // Fallback to hardcoded defaults
      set({ loaded: true, permissionMap: { ...DEFAULT_ROLE_PERMISSIONS } });
    }
  },

  getRoleLabel: (roleName: string, lang: string) => {
    const role = get().roles.find((r) => r.name === roleName);
    if (role) {
      const key = `label_${lang}` as keyof RoleDefinition;
      return (role[key] as string) || role.label_en || roleName;
    }
    return roleName;
  },

  getRoleNames: () => {
    return get().roles.filter((r) => r.is_active).map((r) => r.name);
  },
}));
