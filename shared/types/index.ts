// ─── ROLES ───
export type UserRole = 'ARBEITER' | 'LOCAL_MANAGER' | 'GLOBAL_MANAGER';

// ─── SCHEDULE TYPES ───
export type ScheduleType = 'GARTEN_TIEFBAU' | 'UNTERHALT';

// ─── ABSENCE CODES (matching Excel 1-6) ───
export type AbsenceCode = 1 | 2 | 3 | 4 | 5 | 6;
export interface AbsenceType {
  code: AbsenceCode;
  key: string; // i18n key
  color: string;
  icon: string;
}

// ─── USER ───
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department: ScheduleType[];      // can belong to one or both
  abacusId?: string;               // for HR API sync
  isActive: boolean;
  phone?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserCreateInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department: ScheduleType[];
  abacusId?: string;
}

// ─── CUSTOMER ───
export interface Customer {
  id: string;
  name: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── TASK (OBJEKT) ───
export type TaskStatus = 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'CANCELLED';
export type RecurrenceType = 'NONE' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'SEASONAL';

export interface Task {
  id: string;
  customerId?: string;
  customer?: Customer;
  code: string;                    // letter code for weekly grid display (a-z)
  name: string;
  description?: string;
  location?: string;
  scheduleType: ScheduleType;
  status: TaskStatus;
  isRecurring: boolean;
  recurrenceType: RecurrenceType;
  recurrenceWeeks?: number[];      // KW numbers when this task recurs (from Dauerauftraege)
  seasonalTasks?: string[];        // w, f, r, u, p, wm, h, he, b, rp, sp, d
  estimatedHours?: number;
  machines?: string[];             // machine IDs needed
  materials?: string;
  color: string;                   // display color for schedule grid
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ─── WEEK ───
export type WeekStatus = 'DRAFT' | 'PUBLISHED' | 'LOCKED';

export interface Week {
  id: string;
  year: number;
  weekNumber: number;
  scheduleType: ScheduleType;
  status: WeekStatus;
  createdBy: string;
  publishedAt?: string;
  lockedAt?: string;
}

// ─── ALLOCATION (employee to task) ───
export interface Allocation {
  id: string;
  userId: string;
  user?: User;
  taskId: string;
  task?: Task;
  weekId: string;
  dayOfWeek: number;               // 0=Monday ... 5=Saturday
  timeSlot: number;                // 1-4 (AM1, AM2, PM1, PM2)
  createdBy: string;
  createdAt: string;
}

export interface AllocationCreateInput {
  userId: string;
  taskId: string;
  weekId: string;
  dayOfWeek: number;
  timeSlot: number;
}

// ─── ABSENCE ───
export type AbsenceSource = 'MANUAL' | 'ABACUS_API';

export interface Absence {
  id: string;
  userId: string;
  user?: User;
  date: string;                    // ISO date
  absenceCode: AbsenceCode;
  source: AbsenceSource;
  notes?: string;
  approvedBy?: string;
  createdAt: string;
}

// ─── MACHINE ───
export type MachineCategory =
  | 'RAUPEN_BAGGER'
  | 'PNEU_BAGGER'
  | 'RADLADER'
  | 'RAUPEN_DUMPER'
  | 'RAD_DUMPER'
  | 'WALZE'
  | 'SPITZHAMMER'
  | 'ANBAUGERAET'
  | 'LKW'
  | 'OTHER';

export type MachineOperator = 'EMMENEGGER' | 'APPENZELLER';

export interface Machine {
  id: string;
  inventoryNr: string;             // e.g. "4001", "9014"
  name: string;                    // e.g. "Raupen Bagger Kobelco 0.8 to"
  category: MachineCategory;
  tonnage?: number;
  operator: MachineOperator;
  isActive: boolean;
  notes?: string;
}

// ─── MACHINE ALLOCATION ───
export interface MachineAllocation {
  id: string;
  machineId: string;
  machine?: Machine;
  siteId: string;                  // task/site where machine is deployed
  site?: Task;
  weekId: string;
  dayOfWeek: number;
  createdBy: string;
  createdAt: string;
}

// ─── TIME REPORT (Arbeiter reporting) ───
export type ReportStatus = 'PLANNED' | 'COMPLETED' | 'PARTIAL' | 'NOT_DONE' | 'ADDED';

export interface TimeReport {
  id: string;
  userId: string;
  user?: User;
  taskId: string;
  task?: Task;
  date: string;
  plannedHours: number;
  actualHours?: number;
  status: ReportStatus;
  workDescription?: string;
  notes?: string;
  photos?: string[];               // URLs for uploaded photos
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface TimeReportInput {
  taskId: string;
  date: string;
  actualHours: number;
  status: ReportStatus;
  workDescription?: string;
  notes?: string;
}

// ─── SCHEDULE VIEW TYPES ───
export type ViewMode = 'TAG' | 'WOCHE' | 'MONAT' | 'JAHR';
export type ViewScope = 'PERSONAL' | 'TEAM' | 'COMPANY';

// ─── STATS ───
export interface OccupancyStats {
  userId?: string;
  period: { start: string; end: string };
  totalSlots: number;
  filledSlots: number;
  absenceSlots: number;
  occupancyRate: number;           // 0-100
  byDay: { day: number; rate: number }[];
  byTask: { taskId: string; taskName: string; hours: number }[];
}

// ─── API RESPONSES ───
export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// ─── DRAG & DROP ───
export interface DragItem {
  type: 'TASK' | 'ABSENCE' | 'MACHINE';
  id: string;
  code?: string;
  label?: string;
  color?: string;
}

export interface DropTarget {
  userId?: string;
  machineId?: string;
  dayOfWeek: number;
  timeSlot?: number;
  weekId: string;
}

// ─── CONFLICT ───
export interface Conflict {
  type: 'DOUBLE_BOOKING' | 'ABSENCE_OVERLAP' | 'MACHINE_CONFLICT';
  message: string;
  userId?: string;
  machineId?: string;
  dayOfWeek: number;
  weekId: string;
}
