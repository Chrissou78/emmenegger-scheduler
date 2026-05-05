import { useAuthStore } from '../contexts/authStore';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = useAuthStore.getState().token;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...this.getHeaders(), ...options.headers },
    });

    if (res.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${res.status}`);
    }

    return res.json();
  }

  get<T>(path: string) { return this.request<T>(path); }
  post<T>(path: string, data: unknown) { return this.request<T>(path, { method: 'POST', body: JSON.stringify(data) }); }
  put<T>(path: string, data: unknown) { return this.request<T>(path, { method: 'PUT', body: JSON.stringify(data) }); }
  delete<T>(path: string) { return this.request<T>(path, { method: 'DELETE' }); }

  // ── Auth ──
  login(email: string, password: string) { return this.post<{ data: { token: string; user: any } }>('/auth/login', { email, password }); }

  // ── Users ──
  getUsers(params?: Record<string, string>) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.get<{ data: any[] }>(`/users${q}`);
  }
  createUser(data: any) { return this.post<{ data: any }>('/users', data); }
  updateUser(id: string, data: any) { return this.put<{ data: any }>(`/users/${id}`, data); }

  // ── Tasks ──
  getTasks(params?: Record<string, string>) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.get<{ data: any[] }>(`/tasks${q}`);
  }
  createTask(data: any) { return this.post<{ data: any }>('/tasks', data); }
  updateTask(id: string, data: any) { return this.put<{ data: any }>(`/tasks/${id}`, data); }

  // ── Allocations ──
  getAllocations(params: Record<string, string>) {
    const q = '?' + new URLSearchParams(params).toString();
    return this.get<{ data: any[] }>(`/allocations${q}`);
  }
  createAllocation(data: any) { return this.post<{ data: any }>('/allocations', data); }
  deleteAllocation(id: string) { return this.delete<{ data: any }>(`/allocations/${id}`); }
  copyWeek(sourceWeekId: string, targetWeekId: string) {
    return this.post<{ data: any }>('/allocations/copy-week', { sourceWeekId, targetWeekId });
  }

  // ── Absences ──
  getAbsences(params?: Record<string, string>) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.get<{ data: any[] }>(`/absences${q}`);
  }
  createAbsence(data: any) { return this.post<{ data: any }>('/absences', data); }
  deleteAbsence(id: string) { return this.delete<{ data: any }>(`/absences/${id}`); }

  // ── Machines ──
  getMachines() { return this.get<{ data: any[] }>('/machines'); }
  getMachineAllocations(weekId: string) { return this.get<{ data: any[] }>(`/machines/allocations?weekId=${weekId}`); }
  createMachineAllocation(data: any) { return this.post<{ data: any }>('/machines/allocations', data); }

  // ── Weeks ──
  getWeeks(year: number, scheduleType?: string) {
    const params: Record<string, string> = { year: String(year) };
    if (scheduleType) params.scheduleType = scheduleType;
    return this.get<{ data: any[] }>(`/weeks?${new URLSearchParams(params)}`);
  }
  createWeek(data: any) { return this.post<{ data: any }>('/weeks', data); }

  // ── Reports ──
  getReports(params?: Record<string, string>) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.get<{ data: any[] }>(`/reports${q}`);
  }
  submitReport(data: any) { return this.post<{ data: any }>('/reports', data); }
  updateReport(id: string, data: any) { return this.put<{ data: any }>(`/reports/${id}`, data); }

  // ── Customers ──
  getCustomers() { return this.get<{ data: any[] }>('/customers'); }
  createCustomer(data: any) { return this.post<{ data: any }>('/customers', data); }

  // ── Stats ──
  getOccupancy(params: Record<string, string>) {
    return this.get<{ data: any }>(`/stats/occupancy?${new URLSearchParams(params)}`);
  }
}

export const api = new ApiClient();
