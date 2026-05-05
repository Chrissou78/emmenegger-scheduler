import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';

export const absencesRouter = Router();

// GET /api/v1/absences
absencesRouter.get('/', async (req, res, next) => {
  try {
    const { userId, startDate, endDate } = req.query;

    let query = supabase
      .from('absences')
      .select(`
        *,
        user:users(id, first_name, last_name)
      `)
      .order('date', { ascending: true });

    // Workers can only see their own absences
    if (req.user?.role === 'ARBEITER') {
      query = query.eq('user_id', req.user.userId);
    } else if (userId) {
      query = query.eq('user_id', userId);
    }

    // Date range filter
    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data: absences, error } = await query;

    if (error) throw error;

    res.json({ data: absences || [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/absences
absencesRouter.post('/', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { userId, date, absenceCode, source, notes, approvedById } = req.body;

    const { data: absence, error } = await supabase
      .from('absences')
      .insert([
        {
          user_id: userId,
          date,
          absence_code: absenceCode,
          source: source || 'MANUAL',
          notes,
          approved_by_id: approvedById,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data: absence });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/absences/:id
absencesRouter.delete('/:id', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('absences')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
