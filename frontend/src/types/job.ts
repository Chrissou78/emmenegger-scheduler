// frontend/src/types/job.ts
export interface Customer {
  id: string;
  name: string;
  company_name?: string;
  address?: string;
  city?: string;
  contact_name?: string;
  contact_phone?: string;
}

export interface Task {
  id: string;
  code: string;
  name: string;
  color: string;
  schedule_type: string;
  status?: string;
  customer_id?: string;
  customer?: Customer | null;
}

export interface Machine {
  id: string;
  name: string;
  category: string;
  inventory_nr?: string;
  tonnage?: number;
  is_active?: boolean;
  status?: string;
}

export interface JobMachine {
  id: string;
  machine_id: string;
  machine?: Machine;
}

export interface Job {
  id: string;
  week_id: string;
  user_id: string;
  day_of_week: number;
  time_slot: number;
  task_id: string;
  customer_id?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  task?: Task;
  machines?: JobMachine[];
}
