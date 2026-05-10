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
      query = query.or(`manager_id.eq.${currentUserId},team_leader_id.eq.${currentUserId},id.eq.${currentUserId}`);
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
    if (req.query.team_leader_id) {
      query = query.eq('team_leader_id', req.query.team_leader_id);
    }
    if (req.query.executive_id) {
      query = query.eq('executive_id', req.query.executive_id);
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
        .from('users').select('manager_id, team_leader_id').eq('id', req.params.id).single();
      if (!target || (target.manager_id !== currentUserId && target.team_leader_id !== currentUserId)) {
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

// GET /api/v1/users/:id/team  — get direct reports for a team leader
usersRouter.get('/:id/team', async (req: any, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.userId || req.user.id;

    // Only the team leader themselves, their executive, or a global manager can see the team
    if (req.user.role === 'ARBEITER') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.user.role === 'LOCAL_MANAGER' && id !== currentUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('team_leader_id', id)
      .order('first_name');

    if (error) throw error;

    const safe = (data || []).map(({ password_hash, ...u }: any) => u);
    res.json({ data: safe });
  } catch (err: any) {
    console.error('GET /users/:id/team error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/users/:id/org  — get full org tree under an executive
usersRouter.get('/:id/org', async (req: any, res) => {
  try {
    const { id } = req.params;

    // Get all team leaders reporting to this executive
    const { data: leaders, error: e1 } = await supabase
      .from('users')
      .select('*')
      .eq('executive_id', id)
      .order('first_name');
    if (e1) throw e1;

    const safeLeaders = (leaders || []).map(({ password_hash, ...u }: any) => u);

    // For each leader, get their team members
    const leaderIds = safeLeaders.map((l: any) => l.id);
    let teamMembers: any[] = [];
    if (leaderIds.length > 0) {
      const { data: members, error: e2 } = await supabase
        .from('users')
        .select('*')
        .in('team_leader_id', leaderIds)
        .order('first_name');
      if (e2) throw e2;
      teamMembers = (members || []).map(({ password_hash, ...u }: any) => u);
    }

    // Build tree
    const tree = safeLeaders.map((leader: any) => ({
      ...leader,
      team: teamMembers.filter((m: any) => m.team_leader_id === leader.id),
    }));

    res.json({ data: tree });
  } catch (err: any) {
    console.error('GET /users/:id/org error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/users
usersRouter.post('/', requireRole('GLOBAL_MANAGER', 'LOCAL_MANAGER'), async (req: any, res) => {
  try {
    const {
      email, password, first_name, last_name, role, departments,
      phone, is_active, manager_id, team_leader_id, executive_id,
    } = req.body;
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
      // Auto-assign team leader to the creating manager
      insertData.team_leader_id = currentUserId;
    } else if (manager_id) {
      insertData.manager_id = manager_id;
    }

    // Hierarchy fields (only GLOBAL_MANAGER can set freely)
    if (req.user.role === 'GLOBAL_MANAGER') {
      if (team_leader_id !== undefined) insertData.team_leader_id = team_leader_id || null;
      if (executive_id !== undefined) insertData.executive_id = executive_id || null;
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
        .from('users').select('manager_id, team_leader_id').eq('id', id).single();
      if (!target || (target.manager_id !== currentUserId && target.team_leader_id !== currentUserId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const updates: any = {};
    const {
      first_name, last_name, phone, email, role, departments,
      is_active, password, manager_id, team_leader_id, executive_id,
      // HR profile fields
      nationality, permit_type, marital_status, children_count,
      canton, ahv_number, iban, entry_date, exit_date,
      contract_type, salary_type, salary_amount, work_pensum,
      hours_per_week, bvg_code, notes,
    } = req.body;

    // Fields any authenticated user can update on their own profile
    if (first_name !== undefined) updates.first_name = first_name;
    if (last_name !== undefined) updates.last_name = last_name;
    if (phone !== undefined) updates.phone = phone;

    // Fields managers+ can update
    if (req.user.role === 'GLOBAL_MANAGER' || req.user.role === 'LOCAL_MANAGER') {
      if (email !== undefined) updates.email = email;
      if (departments !== undefined) updates.departments = departments;
      if (is_active !== undefined) updates.is_active = is_active;
    }

    // Fields only GLOBAL_MANAGER can update
    if (req.user.role === 'GLOBAL_MANAGER') {
      if (role !== undefined) updates.role = role;
      if (manager_id !== undefined) updates.manager_id = manager_id || null;
      if (team_leader_id !== undefined) updates.team_leader_id = team_leader_id || null;
      if (executive_id !== undefined) updates.executive_id = executive_id || null;
    }

    // HR profile fields (managers+)
    if (req.user.role === 'GLOBAL_MANAGER' || req.user.role === 'LOCAL_MANAGER') {
      if (nationality !== undefined) updates.nationality = nationality;
      if (permit_type !== undefined) updates.permit_type = permit_type;
      if (marital_status !== undefined) updates.marital_status = marital_status;
      if (children_count !== undefined) updates.children_count = children_count;
      if (canton !== undefined) updates.canton = canton;
      if (ahv_number !== undefined) updates.ahv_number = ahv_number;
      if (iban !== undefined) updates.iban = iban;
      if (entry_date !== undefined) updates.entry_date = entry_date;
      if (exit_date !== undefined) updates.exit_date = exit_date;
      if (contract_type !== undefined) updates.contract_type = contract_type;
      if (salary_type !== undefined) updates.salary_type = salary_type;
      if (salary_amount !== undefined) updates.salary_amount = salary_amount;
      if (work_pensum !== undefined) updates.work_pensum = work_pensum;
      if (hours_per_week !== undefined) updates.hours_per_week = hours_per_week;
      if (bvg_code !== undefined) updates.bvg_code = bvg_code;
      if (notes !== undefined) updates.notes = notes;
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
    // Before deleting, clear any references to this user
    const { id } = req.params;
    await supabase.from('users').update({ team_leader_id: null }).eq('team_leader_id', id);
    await supabase.from('users').update({ executive_id: null }).eq('executive_id', id);
    await supabase.from('users').update({ manager_id: null }).eq('manager_id', id);

    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
