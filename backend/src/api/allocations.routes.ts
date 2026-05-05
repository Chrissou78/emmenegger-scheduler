import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';
import jwt from 'jsonwebtoken';

let io: any = null;
try {
  // Only available in dev (server.ts), not in serverless
  io = require('../server').io;
} catch {
  // Running on Vercel serverless — no Socket.IO
}

export const allocationsRouter = Router();

// GET /api/v1/allocations?weekId=xxx
allocationsRouter.get('/', async (req, res, next) => {
  try {
    const { week_id, user_id } = req.query;
    let query = supabase.from('allocations').select('*');
    
    if (week_id) {
      query = query.eq('week_id', week_id);
    }
    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    const { data, error } = await query.order('day_of_week', { ascending: true });
    if (error) throw error;
    
    res.json({ success: true, data: data || [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/allocations (create with conflict check)
allocationsRouter.post('/', async (req, res, next) => {
  try {
    const { user_id, task_id, week_id, day_of_week, time_slot } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    }

    // Decode JWT to get user ID
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'emmenegger-dev-secret-change-in-production') as any;
    const createdById = decoded.id || decoded.userId;

    if (!createdById) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User ID not found in token' });
    }

    console.log('✅ Creating allocation for user:', createdById);

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
    
    console.log('✅ Allocation created:', data?.[0]);
    res.status(201).json({ success: true, data: data?.[0] });
  } catch (error) {
    console.error('❌ Error creating allocation:', error);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to create allocation' 
    });
  }
});

// DELETE /api/v1/allocations/:id
allocationsRouter.delete(
  '/:id',
  requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      console.log('🗑️ Deleting allocation:', id);

      // Get allocation with week info before deleting
      const { data: allocation, error: fetchError } = await supabase
        .from('allocations')
        .select('id, week_id')
        .eq('id', id)
        .single();

      if (fetchError || !allocation) {
        console.error('❌ Allocation not found:', id);
        return res.status(404).json({
          success: false,
          message: 'Allocation not found',
        });
      }

      // Delete the allocation
      const { error: deleteError } = await supabase
        .from('allocations')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      console.log('✅ Allocation deleted:', id);

      // Broadcast deletion
      if (io) {
        io.to(`schedule:*:${allocation.week_id}`).emit('allocation:deleted', {
          id: allocation.id,
          weekId: allocation.week_id,
        });
      }

      res.json({
        success: true,
        message: 'Allocation deleted',
      });
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
  async (req, res, next) => {
    try {
      const { sourceWeekId, targetWeekId } = req.body;

      console.log('📋 Copying allocations from week', sourceWeekId, 'to', targetWeekId);

      // Get source allocations
      const { data: sourceAllocations, error: fetchError } = await supabase
        .from('allocations')
        .select('user_id, task_id, day_of_week, time_slot')
        .eq('week_id', sourceWeekId);

      if (fetchError) throw fetchError;

      if (!sourceAllocations || sourceAllocations.length === 0) {
        return res.json({
          success: true,
          data: { copied: 0 },
        });
      }

      // Create allocations for target week
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

      console.log(`✅ Copied ${created?.length || 0} allocations`);

      res.json({
        success: true,
        data: { copied: created?.length || 0 },
      });
    } catch (err) {
      console.error('❌ Allocations COPY error:', err);
      next(err);
    }
  }
);
