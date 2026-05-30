// backend/src/api/stats.routes.ts — COMPLETE REPLACEMENT

import { Router } from 'express';
import { supabase } from '../lib/supabase';

export const statsRouter = Router();

// GET /api/v1/stats/dashboard
// Returns all raw data needed for frontend stats computation
// The frontend already fetches from individual endpoints (users, jobs, reports, etc.)
// This endpoint provides pre-aggregated stats for efficiency

statsRouter.get('/dashboard', async (req, res, next) => {
  try {
    const { startDate, endDate, userId } = req.query;
    const userRole = req.user?.role || 'ARBEITER';

    // Get time reports for the period
    let reportsQuery = supabase.from('time_reports').select('*');
    if (startDate) reportsQuery = reportsQuery.gte('date', startDate);
    if (endDate) reportsQuery = reportsQuery.lte('date', endDate);

    // Workers can only see their own
    if (userRole === 'ARBEITER') {
      reportsQuery = reportsQuery.eq('user_id', req.user!.userId);
    } else if (userId) {
      reportsQuery = reportsQuery.eq('user_id', userId);
    }

    const { data: reports, error: repErr } = await reportsQuery;
    if (repErr) throw repErr;

    // Get job counts for the period's weeks
    const { data: weeks, error: wkErr } = await supabase
      .from('weeks')
      .select('id, week_number, year');
    if (wkErr) throw wkErr;

    // Basic aggregation
    const totalReports = (reports || []).length;
    const completedReports = (reports || []).filter(r => r.status === 'COMPLETED').length;
    const totalActualHours = (reports || []).reduce((s, r) => s + (r.actual_hours || 0), 0);
    const totalPlannedHours = (reports || []).reduce((s, r) => s + (r.planned_hours || 0), 0);

    res.json({
      data: {
        reports: reports || [],
        totalReports,
        completedReports,
        totalActualHours,
        totalPlannedHours,
        completionRate: totalReports > 0 ? Math.round((completedReports / totalReports) * 100) : 0,
      }
    });
  } catch (err) {
    next(err);
  }
});

// Keep legacy endpoints for backward compatibility
statsRouter.get('/week/:weekId', async (req, res, next) => {
  try {
    const { weekId } = req.params;
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('user_id, task_id, day_of_week')
      .eq('week_id', weekId);
    if (error) throw error;

    const employeeCount = new Set((jobs || []).map(j => j.user_id)).size;
    const jobCount = (jobs || []).length;
    const taskCount = new Set((jobs || []).map(j => j.task_id)).size;

    const { data: week } = await supabase
      .from('weeks')
      .select('year, week_number')
      .eq('id', weekId)
      .single();

    res.json({
      data: {
        weekId,
        year: week?.year,
        weekNumber: week?.week_number,
        employeeCount,
        jobCount,
        taskCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

statsRouter.get('/user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;

    const { data: jobs } = await supabase
      .from('jobs')
      .select('*, task:tasks!task_id(name, code), week:weeks!week_id(year, week_number)')
      .eq('user_id', userId);

    const { data: reports } = await supabase
      .from('time_reports')
      .select('actual_hours, planned_hours, status, date')
      .eq('user_id', userId);

    const totalHours = (reports || []).reduce((s, r) => s + (r.actual_hours || 0), 0);
    const completedReports = (reports || []).filter(r => r.status === 'COMPLETED').length;

    res.json({
      data: {
        userId,
        jobs: jobs || [],
        reports: reports || [],
        totalHours,
        completedReports,
        jobCount: jobs?.length || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});
