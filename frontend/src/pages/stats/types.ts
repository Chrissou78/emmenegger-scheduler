// frontend/src/pages/stats/types.ts

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  departments: string[];
  is_active: boolean;
  manager_id?: string;
  team_leader_id?: string | null;
  executive_id?: string | null;
  custom_permissions?: any;
}

export interface Week {
  id: string;
  week_number: number;
  year: number;
}

export interface Job {
  id: string;
  user_id: string;
  task_id: string;
  week_id: string;
  day_of_week: number;
  time_slot: number;
  customer_id?: string | null;
  notes?: string | null;
  task?: {
    id: string;
    code: string;
    name: string;
    color?: string;
    schedule_type?: string;
    status?: string;
    customer_id?: string;
    customer?: {
      id: string;
      name: string;
      company_name?: string;
      address?: string;
      city?: string;
      contact_name?: string;
      contact_phone?: string;
    };
  };
  machines?: {
    id: string;
    machine_id: string;
    machine?: {
      id: string;
      name: string;
      category?: string;
      inventory_nr?: string;
      tonnage?: number;
      is_active?: boolean;
    };
  }[];
}

export interface TimeReport {
  id: string;
  user_id: string;
  task_id: string;
  date: string;
  planned_hours?: number;
  actual_hours?: number;
  status: string;
  work_description?: string;
  notes?: string;
  photos?: string[];
  submitted_at?: string;
}

export interface Absence {
  id: string;
  user_id: string;
  week_id?: string;
  day_of_week?: number;
  date?: string;
  type: number | string;
  absence_code?: number | string;
  status?: string;
}

export interface Task {
  id: string;
  name: string;
  short_code?: string;
  code?: string;
  status: string;
  color?: string;
  bg_color?: string;
}

export interface Machine {
  id: string;
  name: string;
  category: string;
  status: string;
  notes?: string;
  is_active?: boolean;
}

export interface MachineAllocation {
  id: string;
  machine_id: string;
  user_id?: string;
  site_id?: string;
  week_id?: string;
  day_of_week?: number;
  date?: string;
  start_time?: string;
  end_time?: string;
}

export type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type StatsMode = 'global' | 'perimeter' | 'team' | 'individual';

export interface StatsData {
  allUsers: User[];
  users: User[];
  activeUsers: User[];
  scopedUserIds: Set<string>;
  weeks: Week[];
  periodWeeks: Week[];
  periodWeekIds: Set<string>;
  jobs: Job[];
  periodJobs: Job[];
  absences: Absence[];
  periodAbsences: Absence[];
  tasks: Task[];
  machines: Machine[];
  machineAllocs: MachineAllocation[];
  timeReports: TimeReport[];
  periodReports: TimeReport[];
  periodDates: { startDate: string; endDate: string };
  period: Period;
  statsMode: StatsMode;
  loading: boolean;
}
