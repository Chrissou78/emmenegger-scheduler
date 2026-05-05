import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';

export const weeksRouter = Router();

// GET /api/v1/weeks
weeksRouter.get('/', async (req, res, next) => {
  try {
    const { year, weekNumber, scheduleType, status } = req.query;

    let query = supabase.from('weeks').select(`
      *,
      createdBy:created_by_id(id, first_name, last_name)
    `);

    if (year) {
      query = query.eq('year', Number(year));
    }

    if (weekNumber) {
      query = query.eq('week_number', Number(weekNumber));
    }

    if (scheduleType) {
      query = query.eq('schedule_type', scheduleType);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: weeks, error } = await query.order('year', { ascending: false }).order('week_number', { ascending: false });

    if (error) throw error;

    res.json({ data: weeks || [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/weeks
weeksRouter.post('/', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { year, weekNumber, scheduleType } = req.body;

    // Check if week already exists
    const { data: existing } = await supabase
      .from('weeks')
      .select('id')
      .eq('year', year)
      .eq('week_number', weekNumber)
      .eq('schedule_type', scheduleType)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Week already exists' });
    }

    const { data: week, error } = await supabase
      .from('weeks')
      .insert([
        {
          year,
          week_number: weekNumber,
          schedule_type: scheduleType,
          status: 'DRAFT',
          created_by_id: req.user!.userId,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data: week });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/weeks/:id (publish/lock)
weeksRouter.put('/:id', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { status } = req.body;

    const updateData: any = { status };
    if (status === 'PUBLISHED') {
      updateData.published_at = new Date().toISOString();
    }
    if (status === 'LOCKED') {
      updateData.locked_at = new Date().toISOString();
    }
    updateData.updated_at = new Date().toISOString();

    const { data: week, error } = await supabase
      .from('weeks')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ data: week });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/weeks/:id
weeksRouter.delete('/:id', requireRole('GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('weeks')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
