import { create } from 'zustand';
import type { ScheduleType, ViewMode } from '@emmenegger/shared/types';

interface ScheduleState {
  // Current view
  viewMode: ViewMode;
  scheduleType: ScheduleType | 'ALL';
  weekOffset: number;
  selectedYear: number;

  // Selection
  selectedEmployeeId: string | null;
  selectedTaskId: string | null;

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setScheduleType: (type: ScheduleType | 'ALL') => void;
  setWeekOffset: (offset: number) => void;
  nextWeek: () => void;
  prevWeek: () => void;
  goToToday: () => void;
  selectEmployee: (id: string | null) => void;
  selectTask: (id: string | null) => void;
}

export const useScheduleStore = create<ScheduleState>()((set) => ({
  viewMode: 'WOCHE',
  scheduleType: 'ALL',
  weekOffset: 0,
  selectedYear: new Date().getFullYear(),
  selectedEmployeeId: null,
  selectedTaskId: null,

  setViewMode: (mode) => set({ viewMode: mode }),
  setScheduleType: (type) => set({ scheduleType: type }),
  setWeekOffset: (offset) => set({ weekOffset: offset }),
  nextWeek: () => set((s) => ({ weekOffset: s.weekOffset + 1 })),
  prevWeek: () => set((s) => ({ weekOffset: s.weekOffset - 1 })),
  goToToday: () => set({ weekOffset: 0 }),
  selectEmployee: (id) => set({ selectedEmployeeId: id }),
  selectTask: (id) => set({ selectedTaskId: id }),
}));
