import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ARBEITER' | 'LOCAL_MANAGER' | 'GLOBAL_MANAGER';
  departments: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: true,

  login: async (email: string, password: string) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Login failed');
    }

    const data = await res.json();
    localStorage.setItem('authToken', data.data.token);
    set({
      user: data.data.user,
      token: data.data.token,
    });
  },

  logout: () => {
    localStorage.removeItem('authToken');
    set({ user: null, token: null });
  },

  checkAuth: () => {
    const token = localStorage.getItem('authToken');
    if (token) {
      set({ token, loading: false });
    } else {
      set({ loading: false });
    }
  },
}));
