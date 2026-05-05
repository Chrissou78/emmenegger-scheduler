import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';

export const statsRouter = Router();

// GET /api/v1/stats/week/:weekId
statsRouter.get('/week/:weekId', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { weekId } = req.params;

    // Get all allocations for the week
    const { data: allocations, error: allocError } = await supabase
      .from('allocations')
      .select('user_id, task_id, day_of_week')
      .eq('week_id', weekId);

    if (allocError) throw allocError;

    // Get all absences for employees in that week
    const { data: week, error: weekError } = await supabase
      .from('weeks')
      .select('year, week_number')
      .eq('id', weekId)
      .single();

    if (weekError) throw weekError;

    // Calculate stats
    const employeeCount = new Set((allocations || []).map((a) => a.user_id)).size;
    const allocationCount = (allocations || []).length;
    const taskCount = new Set((allocations || []).map((a) => a.task_id)).size;
    const daysUtilized = (allocations || []).length > 0 ? 6 : 0; // 0-5 days

    res.json({
      data: {
        weekId,
        year: week.year,
        weekNumber: week.week_number,
        employeeCount,
        allocationCount,
        taskCount,
        daysUtilized,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/stats/user/:userId
statsRouter.get('/user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { year } = req.query;

    const currentYear = year ? Number(year) : new Date().getFullYear();

    // Get allocations
    const { data: allocations, error: allocError } = await supabase
      .from('allocations')
      .select(`
        id,
        week:weeks(year, week_number),
        task:tasks(name, code)
      `)
      .eq('user_id', userId);

    if (allocError) throw allocError;

    // Get reports
    const { data: reports, error: reportError } = await supabase
      .from('time_reports')
      .select('actual_hours, status')
      .eq('user_id', userId);

    if (reportError) throw reportError;

    const totalHours = (reports || []).reduce((sum, r) => sum + (r.actual_hours || 0), 0);
    const completedReports = (reports || []).filter((r) => r.status === 'COMPLETED').length;

    res.json({
      data: {
        userId,
        allocations: allocations || [],
        reports: reports || [],
        totalHours,
        completedReports,
        allocationCount: allocations?.length || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});
