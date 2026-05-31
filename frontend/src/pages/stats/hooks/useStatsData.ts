// frontend/src/pages/stats/hooks/useStatsData.ts

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuthStore } from '../../../contexts/authStore';
import { useRolesStore } from '../../../store/rolesStore';
import { resolvePermissions, getStatsViewMode, type Role } from '../../../../../shared/constants/roles';
import type { User, Week, Job, Absence, Task, Machine, MachineAllocation, TimeReport, Period, StatsMode, StatsData } from '../types';
import { getWeeksForPeriod, getPeriodDateRange } from '../helpers';

const API = import.meta.env.VITE_API_URL || '';

function normalizeRole(raw: string): Role {
  const upper = (raw || '').toUpperCase();
  switch (upper) {
    case 'GLOBAL_MANAGER': return 'ADMIN';
    case 'LOCAL_MANAGER':  return 'MANAGER';
    case 'ARBEITER':       return 'EMPLOYEE';
    default:               return (upper as Role) || 'EMPLOYEE';
  }
}

export function useStatsData(period: Period): StatsData {
  const { token, user: rawUser } = useAuthStore();
  const user = rawUser as (typeof rawUser & { team_leader_id?: string | null; executive_id?: string | null; departments?: string[] });
  const { permissionMap } = useRolesStore();

  const normalizedRole = useMemo(() => normalizeRole(user?.role || ''), [user?.role]);
  const perms = useMemo(() => resolvePermissions(normalizedRole, user?.custom_permissions, permissionMap), [normalizedRole, user, permissionMap]);
  const statsMode: StatsMode = useMemo(() => getStatsViewMode(user?.role || 'EMPLOYEE') as StatsMode, [user?.role]);

  const authHeaders = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);
  const periodDates = useMemo(() => getPeriodDateRange(period), [period]);

  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineAllocs, setMachineAllocs] = useState<MachineAllocation[]>([]);
  const [timeReports, setTimeReports] = useState<TimeReport[]>([]);

  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [uRes, wRes, abRes, tRes, mRes, maRes, trRes] = await Promise.allSettled([
        fetch(`${API}/api/v1/users?limit=500`, { headers: authHeaders }),
        fetch(`${API}/api/v1/weeks`, { headers: authHeaders }),
        fetch(`${API}/api/v1/absences?startDate=${periodDates.startDate}&endDate=${periodDates.endDate}`, { headers: authHeaders }),
        fetch(`${API}/api/v1/tasks`, { headers: authHeaders }),
        fetch(`${API}/api/v1/machines`, { headers: authHeaders }),
        fetch(`${API}/api/v1/machines/allocations`, { headers: authHeaders }),
        fetch(`${API}/api/v1/reports?startDate=${periodDates.startDate}&endDate=${periodDates.endDate}`, { headers: authHeaders }),
      ]);

      if (!mounted.current) return;

      const json = async (r: PromiseSettledResult<Response>): Promise<any[]> => {
        if (r.status !== 'fulfilled' || !r.value.ok) return [];
        try {
          const data = await r.value.json();
          if (Array.isArray(data)) return data;
          if (data && Array.isArray(data.data)) return data.data;
          return [];
        } catch { return []; }
      };

      const fetchedUsers = await json(uRes);
      const fetchedWeeks: Week[] = await json(wRes);
      const fetchedAbsences = await json(abRes);
      const fetchedTasks = await json(tRes);
      const fetchedMachines = await json(mRes);
      const fetchedMachineAllocs = await json(maRes);
      const fetchedReports = await json(trRes);

      setAllUsers(fetchedUsers);
      setWeeks(fetchedWeeks);
      setAbsences(fetchedAbsences);
      setTasks(fetchedTasks);
      setMachines(fetchedMachines);
      setMachineAllocs(fetchedMachineAllocs);
      setTimeReports(fetchedReports);

      const periodWks = getWeeksForPeriod(period, fetchedWeeks);
      if (periodWks.length > 0) {
        const jobPromises = periodWks.map(w =>
          fetch(`${API}/api/v1/jobs?weekId=${w.id}`, { headers: authHeaders })
            .then(async res => {
              if (!res.ok) return [];
              const data = await res.json();
              if (Array.isArray(data)) return data;
              if (data && Array.isArray(data.data)) return data.data;
              return [];
            })
            .catch(() => [] as Job[])
        );
        const jobResults = await Promise.all(jobPromises);
        if (!mounted.current) return;
        setJobs(jobResults.flat() as Job[]);
      } else {
        setJobs([]);
      }
    } catch (e) {
      console.error('Stats fetch error', e);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [token, authHeaders, period, periodDates]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Scope users based on statsMode
  const users = useMemo(() => {
    switch (statsMode) {
      case 'global':
        return allUsers;
      case 'perimeter': {
        const myId = user?.id;
        if (!myId) return allUsers;
        const myTLs = allUsers.filter(u => u.executive_id === myId);
        const tlIds = new Set(myTLs.map(u => u.id));
        const myEmps = allUsers.filter(u => u.team_leader_id && tlIds.has(u.team_leader_id));
        const scopeIds = new Set([myId, ...tlIds, ...myEmps.map(u => u.id)]);
        return allUsers.filter(u => scopeIds.has(u.id));
      }
      case 'team': {
        const myId = user?.id;
        if (!myId) return [];
        return allUsers.filter(u => u.team_leader_id === myId || u.id === myId);
      }
      case 'individual': {
        const myId = user?.id;
        if (!myId) return [];
        return allUsers.filter(u => u.id === myId);
      }
      default:
        return allUsers;
    }
  }, [allUsers, statsMode, user?.id]);

  const scopedUserIds = useMemo(() => new Set(users.map(u => u.id)), [users]);
  const periodWeeks = useMemo(() => getWeeksForPeriod(period, weeks), [period, weeks]);
  const periodWeekIds = useMemo(() => new Set(periodWeeks.map(w => w.id)), [periodWeeks]);
  const activeUsers = useMemo(() => users.filter(u => u.is_active !== false), [users]);

  const currentDayOfWeek = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 7 : d;
  }, []);

  const periodJobs = useMemo(() => {
    let filtered = jobs.filter(j => periodWeekIds.has(j.week_id) && scopedUserIds.has(j.user_id));
    if (period === 'day') filtered = filtered.filter(j => j.day_of_week === currentDayOfWeek);
    return filtered;
  }, [jobs, periodWeekIds, scopedUserIds, period, currentDayOfWeek]);

  const periodAbsences = useMemo(() => {
    let filtered = absences.filter(a => {
      if (!scopedUserIds.has(a.user_id)) return false;
      if (a.week_id) return periodWeekIds.has(a.week_id);
      if (a.date) return a.date >= periodDates.startDate && a.date <= periodDates.endDate;
      return false;
    });
    if (period === 'day') {
      filtered = filtered.filter(a => {
        if (a.day_of_week !== undefined) return a.day_of_week === currentDayOfWeek;
        if (a.date) return a.date === periodDates.startDate;
        return true;
      });
    }
    return filtered;
  }, [absences, periodWeekIds, scopedUserIds, period, currentDayOfWeek, periodDates]);

  const periodReports = useMemo(() =>
    timeReports.filter(tr => scopedUserIds.has(tr.user_id)),
    [timeReports, scopedUserIds]
  );

  return {
    allUsers, users, activeUsers, scopedUserIds,
    weeks, periodWeeks, periodWeekIds,
    jobs, periodJobs,
    absences, periodAbsences,
    tasks, machines, machineAllocs,
    timeReports, periodReports,
    periodDates, period, statsMode, loading,
  };
}
