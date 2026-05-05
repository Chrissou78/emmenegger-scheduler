import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';

export const usersRouter = Router();

// GET /api/v1/users (public for scheduling)
usersRouter.get('/', async (req, res, next) => {
  try {
    const { department, active } = req.query;

    let query = supabase
      .from('users')
      .select('id, first_name, last_name, role, departments, is_active')
      .eq('is_active', true)
      .order('first_name', { ascending: true });

    let { data: users, error } = await query;

    if (error) throw error;

    // Filter by department if needed
    let filteredUsers = users || [];
    if (department) {
      filteredUsers = filteredUsers.filter((u) =>
        u.departments?.includes(department)
      );
    }

    res.json({
      success: true,
      data: filteredUsers,
    });
  } catch (err) {
    console.error('❌ Error fetching users:', err);
    next(err);
  }
});

// GET /api/v1/users/:id
usersRouter.get('/:id', async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, departments, is_active')
      .eq('id', req.params.id)
      .single();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/users/:id (protected)
usersRouter.put(
  '/:id',
  requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'),
  async (req, res, next) => {
    try {
      const { firstName, lastName, departments, phone, isActive } = req.body;

      const { data: user, error } = await supabase
        .from('users')
        .update({
          first_name: firstName,
          last_name: lastName,
          departments,
          phone,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/users/:id (soft delete - protected)
usersRouter.delete(
  '/:id',
  requireRole('GLOBAL_MANAGER'),
  async (req, res, next) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', req.params.id);

      if (error) throw error;

      res.json({ success: true, data: { deleted: true } });
    } catch (err) {
      next(err);
    }
  }
);
