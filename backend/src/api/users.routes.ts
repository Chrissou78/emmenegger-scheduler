import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';
import bcrypt from 'bcryptjs';

export const usersRouter = Router();

// GET /api/v1/users
usersRouter.get('/', async (req: any, res) => {
  try {
    const currentUserId = req.user.userId || req.user.id;
    let query = supabase.from('users').select('*').order('first_name');

    if (req.user.role === 'LOCAL_MANAGER') {
      query = query.or(`manager_id.eq.${currentUserId},id.eq.${currentUserId}`);
    }

    if (req.user.role === 'ARBEITER') {
      query = query.eq('id', currentUserId);
    }

    if (req.query.department) {
      query = query.contains('departments', [req.query.department]);
    }
    if (req.query.role) {
      query = query.eq('role', req.query.role);
    }
    if (req.query.managerId) {
      query = query.eq('manager_id', req.query.managerId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const safe = (data || []).map(({ password_hash, ...u }: any) => u);
    res.json({ data: safe });
  } catch (err: any) {
    console.error('GET /users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/users/:id
usersRouter.get('/:id', async (req: any, res) => {
  try {
    const currentUserId = req.user.userId || req.user.id;

    if (req.user.role === 'ARBEITER' && req.params.id !== currentUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (req.user.role === 'LOCAL_MANAGER' && req.params.id !== currentUserId) {
      const { data: target } = await supabase
        .from('users').select('manager_id').eq('id', req.params.id).single();
      if (!target || target.manager_id !== currentUserId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const { data, error } = await supabase
      .from('users').select('*').eq('id', req.params.id).single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Not found' });

    const { password_hash, ...safe } = data as any;
    res.json({ data: safe });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/users
usersRouter.post('/', requireRole('GLOBAL_MANAGER', 'LOCAL_MANAGER'), async (req: any, res) => {
  try {
    const { email, password, first_name, last_name, role, departments, phone, is_active, manager_id } = req.body;
    const currentUserId = req.user.userId || req.user.id;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (req.user.role === 'LOCAL_MANAGER' && role && role !== 'ARBEITER') {
      return res.status(403).json({ error: 'Local managers can only create workers' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const insertData: any = {
      email,
      password_hash,
      first_name,
      last_name,
      role: role || 'ARBEITER',
      departments: departments || [],
      phone: phone || null,
      is_active: is_active !== false,
    };

    if (req.user.role === 'LOCAL_MANAGER') {
      insertData.manager_id = currentUserId;
    } else if (manager_id) {
      insertData.manager_id = manager_id;
    }

    const { data, error } = await supabase
      .from('users').insert(insertData).select().single();

    if (error) throw error;

    const { password_hash: _, ...safe } = data as any;
    res.status(201).json({ data: safe });
  } catch (err: any) {
    console.error('POST /users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/users/:id
usersRouter.put('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.userId || req.user.id;

    if (req.user.role === 'ARBEITER' && id !== currentUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (req.user.role === 'LOCAL_MANAGER' && id !== currentUserId) {
      const { data: target } = await supabase
        .from('users').select('manager_id').eq('id', id).single();
      if (!target || target.manager_id !== currentUserId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const updates: any = {};
    const { first_name, last_name, phone, email, role, departments, is_active, password, manager_id } = req.body;

    if (first_name !== undefined) updates.first_name = first_name;
    if (last_name !== undefined) updates.last_name = last_name;
    if (phone !== undefined) updates.phone = phone;

    if (req.user.role === 'GLOBAL_MANAGER' || req.user.role === 'LOCAL_MANAGER') {
      if (email !== undefined) updates.email = email;
      if (departments !== undefined) updates.departments = departments;
      if (is_active !== undefined) updates.is_active = is_active;
    }

    if (req.user.role === 'GLOBAL_MANAGER') {
      if (role !== undefined) updates.role = role;
      if (manager_id !== undefined) updates.manager_id = manager_id || null;
    }

    if (password) {
      updates.password_hash = await bcrypt.hash(password, 10);
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('users').update(updates).eq('id', id).select().single();

    if (error) throw error;

    const { password_hash, ...safe } = data as any;
    res.json({ data: safe });
  } catch (err: any) {
    console.error('PUT /users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/users/:id
usersRouter.delete('/:id', requireRole('GLOBAL_MANAGER'), async (req: any, res) => {
  try {
    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
