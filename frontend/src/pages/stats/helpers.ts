// frontend/src/pages/stats/helpers.ts

import type { Period, Week } from './types';

export function getISOWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

export function getCurrentWeekNumber(): number {
  return getISOWeek(new Date());
}

export function getMondayOfISOWeek(weekNum: number, year: number): Date {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNum - 1) * 7);
  return monday;
}

export function getWeeksForPeriod(period: Period, allWeeks: Week[]): Week[] {
  const now = new Date();
  const cy = now.getFullYear();
  const cw = getCurrentWeekNumber();
  switch (period) {
    case 'day':
      return allWeeks.filter(w => w.year === cy && w.week_number === cw);
    case 'week':
      return allWeeks.filter(w => w.year === cy && w.week_number === cw);
    case 'month': {
      const s = Math.max(1, cw - 3);
      return allWeeks.filter(w => w.year === cy && w.week_number >= s && w.week_number <= cw);
    }
    case 'quarter': {
      const s = Math.max(1, cw - 12);
      return allWeeks.filter(w => w.year === cy && w.week_number >= s && w.week_number <= cw);
    }
    case 'year':
      return allWeeks.filter(w => w.year === cy && w.week_number <= cw);
  }
}

export function getPeriodDateRange(period: Period): { startDate: string; endDate: string } {
  const now = new Date();
  const cy = now.getFullYear();
  const cw = getCurrentWeekNumber();
  const endDate = now.toISOString().slice(0, 10);

  switch (period) {
    case 'day':
      return { startDate: endDate, endDate };
    case 'week': {
      const mon = getMondayOfISOWeek(cw, cy);
      return { startDate: mon.toISOString().slice(0, 10), endDate };
    }
    case 'month': {
      const s = Math.max(1, cw - 3);
      const mon = getMondayOfISOWeek(s, cy);
      return { startDate: mon.toISOString().slice(0, 10), endDate };
    }
    case 'quarter': {
      const s = Math.max(1, cw - 12);
      const mon = getMondayOfISOWeek(s, cy);
      return { startDate: mon.toISOString().slice(0, 10), endDate };
    }
    case 'year': {
      return { startDate: `${cy}-01-01`, endDate };
    }
  }
}

export function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
