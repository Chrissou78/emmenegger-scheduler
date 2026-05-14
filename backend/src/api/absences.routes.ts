import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';

export const absencesRouter = Router();

// GET /api/v1/absences
absencesRouter.get('/', async (req: any, res, next) => {
  try {
    const { userId, startDate, endDate } = req.query;
    let query = supabase.from('absences').select('*');

    const currentUserId = req.user.userId || req.user.id;

    // Role-based filtering
    if (req.user.role === 'ARBEITER') {
      // Workers see only their own absences
      query = query.eq('user_id', currentUserId);
    } else if (req.user.role === 'LOCAL_MANAGER') {
      // Local managers see only their team's absences
      const { data: teamUsers } = await supabase
        .from('users')
        .select('id')
        .or(`manager_id.eq.${currentUserId},id.eq.${currentUserId}`);

      const teamIds = (teamUsers || []).map((u: any) => u.id);
      if (teamIds.length > 0) {
        query = query.in('user_id', teamIds);
      } else {
        query = query.eq('user_id', currentUserId);
      }
    }
    // GLOBAL_MANAGER sees all — no filter needed

    // Optional filters
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query.order('date', { ascending: true });
    if (error) throw error;

    res.json({ data: data || [] });
  } catch (err) {
    console.error('GET /absences error:', err);
    next(err);
  }
});

// POST /api/v1/absences
absencesRouter.post('/', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req: any, res, next) => {
  try {
    // ★ Accept both field naming conventions
    const user_id = req.body.user_id || req.body.userId;
    const date = req.body.date;
    const absence_code = req.body.absence_code || req.body.absenceCode;
    const source = req.body.source || 'MANUAL';
    const notes = req.body.notes || null;
    const currentUserId = req.user.userId || req.user.id;

    if (!user_id || !date || !absence_code) {
      return res.status(400).json({ error: 'Missing required fields: user_id, date, absence_code' });
    }

    // LOCAL_MANAGER / MANAGER can only create absences for their team
    const userRoleUpper = (req.user.role || '').toUpperCase();
    if (userRoleUpper === 'LOCAL_MANAGER' || userRoleUpper === 'MANAGER') {
      const { data: targetUser } = await supabase
        .from('users')
        .select('id, manager_id, team_leader_id')
        .eq('id', user_id)
        .single();

      if (targetUser && targetUser.id !== currentUserId
        && targetUser.manager_id !== currentUserId
        && targetUser.team_leader_id !== currentUserId) {
        return res.status(403).json({ error: 'Cannot create absences for users outside your team' });
      }
    }

    const { data, error } = await supabase
      .from('absences')
      .insert({
        user_id,
        date,
        absence_code,
        source,
        notes,
        approved_by_id: currentUserId,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data });
  } catch (err) {
    console.error('POST /absences error:', err);
    next(err);
  }
});

// DELETE /api/v1/absences/:id
absencesRouter.delete('/:id', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req: any, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('absences')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('DELETE /absences error:', err);
    next(err);
  }
});
