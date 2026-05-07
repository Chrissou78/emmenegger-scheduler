import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';
import jwt from 'jsonwebtoken';

export const allocationsRouter = Router();

// GET /api/v1/allocations?week_id=xxx
allocationsRouter.get('/', async (req: any, res, next) => {
  try {
    const { week_id, user_id } = req.query;
    let query = supabase.from('allocations').select('*');

    if (week_id) {
      query = query.eq('week_id', week_id);
    }
    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    // LOCAL_MANAGER: only show allocations for their team
    const currentUserId = req.user.userId || req.user.id;
    if (req.user.role === 'LOCAL_MANAGER' && currentUserId) {
      const { data: teamUsers } = await supabase
        .from('users')
        .select('id')
        .or(`manager_id.eq.${currentUserId},id.eq.${currentUserId}`);

      const teamIds = (teamUsers || []).map((u: any) => u.id);
      if (teamIds.length > 0) {
        query = query.in('user_id', teamIds);
      } else {
        // No team found — return only own allocations
        query = query.eq('user_id', currentUserId);
      }
    }

    // ARBEITER: only their own allocations
    if (req.user.role === 'ARBEITER' && currentUserId) {
      query = query.eq('user_id', currentUserId);
    }

    const { data, error } = await query.order('day_of_week', { ascending: true });
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/allocations
allocationsRouter.post('/', async (req: any, res, next) => {
  try {
    const { user_id, task_id, week_id, day_of_week, time_slot } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'emmenegger-dev-secret-change-in-production') as any;
    const createdById = decoded.id || decoded.userId;

    if (!createdById) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User ID not found in token' });
    }

    // LOCAL_MANAGER can only create allocations for their team
    if (req.user.role === 'LOCAL_MANAGER') {
      const currentUserId = req.user.userId || req.user.id;
      const { data: targetUser } = await supabase
        .from('users')
        .select('id, manager_id')
        .eq('id', user_id)
        .single();

      if (targetUser && targetUser.id !== currentUserId && targetUser.manager_id !== currentUserId) {
        return res.status(403).json({ success: false, message: 'Cannot allocate for users outside your team' });
      }
    }

    const { data, error } = await supabase
      .from('allocations')
      .insert({
        user_id,
        task_id,
        week_id,
        day_of_week,
        time_slot: time_slot || 1,
        created_by_id: createdById,
      })
      .select();

    if (error) throw error;

    res.status(201).json({ success: true, data: data?.[0] });
  } catch (error) {
    console.error('❌ Error creating allocation:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create allocation',
    });
  }
});

// DELETE /api/v1/allocations/:id
allocationsRouter.delete(
  '/:id',
  requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'),
  async (req: any, res, next) => {
    try {
      const { id } = req.params;

      const { data: allocation, error: fetchError } = await supabase
        .from('allocations')
        .select('id, week_id')
        .eq('id', id)
        .single();

      if (fetchError || !allocation) {
        return res.status(404).json({ success: false, message: 'Allocation not found' });
      }

      const { error: deleteError } = await supabase
        .from('allocations')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      res.json({ success: true, message: 'Allocation deleted' });
    } catch (err) {
      console.error('❌ Allocations DELETE error:', err);
      next(err);
    }
  }
);

// POST /api/v1/allocations/copy-week
allocationsRouter.post(
  '/copy-week',
  requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'),
  async (req: any, res, next) => {
    try {
      const { sourceWeekId, targetWeekId } = req.body;
      const currentUserId = req.user.userId || req.user.id;

      let sourceQuery = supabase
        .from('allocations')
        .select('user_id, task_id, day_of_week, time_slot')
        .eq('week_id', sourceWeekId);

      // LOCAL_MANAGER: only copy their team's allocations
      if (req.user.role === 'LOCAL_MANAGER' && currentUserId) {
        const { data: teamUsers } = await supabase
          .from('users')
          .select('id')
          .or(`manager_id.eq.${currentUserId},id.eq.${currentUserId}`);

        const teamIds = (teamUsers || []).map((u: any) => u.id);
        if (teamIds.length > 0) {
          sourceQuery = sourceQuery.in('user_id', teamIds);
        }
      }

      const { data: sourceAllocations, error: fetchError } = await sourceQuery;
      if (fetchError) throw fetchError;

      if (!sourceAllocations || sourceAllocations.length === 0) {
        return res.json({ success: true, data: { copied: 0 } });
      }

      const allocationsToCreate = sourceAllocations.map((a) => ({
        user_id: a.user_id,
        task_id: a.task_id,
        week_id: targetWeekId,
        day_of_week: a.day_of_week,
        time_slot: a.time_slot,
      }));

      const { data: created, error: createError } = await supabase
        .from('allocations')
        .insert(allocationsToCreate)
        .select();

      if (createError) throw createError;

      res.json({ success: true, data: { copied: created?.length || 0 } });
    } catch (err) {
      console.error('❌ Allocations COPY error:', err);
      next(err);
    }
  }
);
