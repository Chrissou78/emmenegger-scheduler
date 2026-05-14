import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole, isRoleOneOf } from '../middleware/auth';

export const absencesRouter = Router();

// GET /api/v1/absences
absencesRouter.get('/', async (req: any, res, next) => {
  try {
    const { userId, startDate, endDate } = req.query;
    let query = supabase.from('absences').select('*');

    const currentUserId = req.user.userId || req.user.id;
    const role = req.user.role || '';

    // ★ Use isRoleOneOf for role-based filtering
    if (isRoleOneOf(role, 'ARBEITER', 'EMPLOYEE')) {
      query = query.eq('user_id', currentUserId);
    } else if (isRoleOneOf(role, 'LOCAL_MANAGER', 'MANAGER')) {
      const { data: teamUsers } = await supabase
        .from('users')
        .select('id')
        .or(`manager_id.eq.${currentUserId},team_leader_id.eq.${currentUserId},id.eq.${currentUserId}`);

      const teamIds = (teamUsers || []).map((u: any) => u.id);
      if (teamIds.length > 0) {
        query = query.in('user_id', teamIds);
      } else {
        query = query.eq('user_id', currentUserId);
      }
    }
    // CEO, ADMIN, GLOBAL_MANAGER, HR, etc. see all

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
    const user_id = req.body.user_id || req.body.userId;
    const date = req.body.date;
    const absence_code = req.body.absence_code || req.body.absenceCode;
    const source = req.body.source || 'MANUAL';
    const notes = req.body.notes || null;
    const currentUserId = req.user.userId || req.user.id;
    const role = req.user.role || '';

    if (!user_id || !date || !absence_code) {
      return res.status(400).json({ error: 'Missing required fields: user_id, date, absence_code' });
    }

    // ★ Use isRoleOneOf for team check
    if (isRoleOneOf(role, 'LOCAL_MANAGER', 'MANAGER')) {
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
