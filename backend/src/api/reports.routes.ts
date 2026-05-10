import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';

export const reportsRouter = Router();

// GET /api/v1/reports
reportsRouter.get('/', async (req, res, next) => {
  try {
    const { userId, startDate, endDate, status } = req.query;

    let query = supabase.from('time_reports').select('*');

    // Workers can only see their own reports
    if (req.user?.role === 'ARBEITER') {
      query = query.eq('user_id', req.user.userId);
    } else if (userId) {
      query = query.eq('user_id', userId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data: reports, error } = await query.order('date', { ascending: false });

    if (error) throw error;

    res.json({ data: reports || [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/reports (workers submit their own)
reportsRouter.post('/', async (req, res, next) => {
  try {
    const { taskId, date, plannedHours, actualHours, workDescription, notes, photos } = req.body;

    const { data: report, error } = await supabase
      .from('time_reports')
      .insert([
        {
          user_id: req.user!.userId,
          task_id: taskId,
          date,
          planned_hours: plannedHours,
          actual_hours: actualHours,
          work_description: workDescription,
          notes,
          photos: photos || [],
          status: 'PLANNED',
          submitted_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data: report });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/reports/:id
reportsRouter.put('/:id', async (req, res, next) => {
  try {
    const { taskId, date, plannedHours, actualHours, status, workDescription, notes, photos } = req.body;

    // Fetch report to check permissions
    const { data: report, error: fetchError } = await supabase
      .from('time_reports')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !report) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Workers can only edit their own
    if (req.user?.role === 'ARBEITER' && report.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data: updated, error } = await supabase
      .from('time_reports')
      .update({
        task_id: taskId,
        date,
        planned_hours: plannedHours,
        actual_hours: actualHours,
        status,
        work_description: workDescription,
        notes,
        photos,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/reports/:id
reportsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { data: report, error: fetchError } = await supabase
      .from('time_reports')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !report) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (req.user?.role === 'ARBEITER' && report.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { error } = await supabase
      .from('time_reports')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
