import { useState, useEffect, useCallback } from 'react';

const API_URL = (import.meta as any).env.VITE_API_URL || '';

export interface Allocation {
  id: string;
  user_id: string;
  task_id: string;
  week_id: string;
  day_of_week: number;
  time_slot: number;
  user: { id: string; first_name: string; last_name: string };
  task: { id: string; code: string; name: string; color: string };
  created_at: string;
}

export interface Week {
  id: string;
  year: number;
  week_number: number;
  schedule_type: string;
  status: 'DRAFT' | 'PUBLISHED' | 'LOCKED';
  created_at: string;
}

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  departments: string[];
}

export function useSchedule(weekId?: string) {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem('authToken');

  // Fetch allocations
  const fetchAllocations = useCallback(
    async (wId?: string) => {
      if (!wId) return;
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/v1/allocations?weekId=${wId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch allocations');
        const data = await res.json();
        setAllocations(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  // Fetch weeks
  const fetchWeeks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/weeks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch weeks');
      const data = await res.json();
      setWeeks(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Create allocation
  const createAllocation = useCallback(
    async (allocation: any) => {
      try {
        const res = await fetch(`${API_URL}/api/v1/allocations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(allocation),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'Failed to create allocation');
        }
        const data = await res.json();
        setAllocations((prev) => [...prev, data.data]);
        return data.data;
      } catch (err) {
        throw err;
      }
    },
    [token]
  );

  // Delete allocation
  const deleteAllocation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`${API_URL}/api/v1/allocations/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to delete allocation');
        setAllocations((prev) => prev.filter((a) => a.id !== id));
      } catch (err) {
        throw err;
      }
    },
    [token]
  );

  useEffect(() => {
    if (weekId) fetchAllocations(weekId);
  }, [weekId, fetchAllocations]);

  return {
    allocations,
    weeks,
    users,
    loading,
    error,
    fetchAllocations,
    fetchWeeks,
    fetchUsers,
    createAllocation,
    deleteAllocation,
  };
}
