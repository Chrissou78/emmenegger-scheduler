import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';
import bcrypt from 'bcryptjs';

export const usersRouter = Router();

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

/** Role hierarchy tier: CEO=4, Exec=3, Manager=2, Employee=1 */
function getRoleTier(role: string): number {
  const r = (role || '').toUpperCase();
  if (r === 'CEO') return 4;
  if (r === 'ADMIN' || r === 'GLOBAL_MANAGER') return 3;
  if (r === 'MANAGER' || r === 'LOCAL_MANAGER') return 2;
  return 1;
}

/** Can this role modify hierarchy fields? Tier 3+ (Exec/CEO) */
function canManageHierarchy(role: string): boolean {
  return getRoleTier(role) >= 3;
}

/** Can this role modify ALL hierarchy fields including ceo_id? CEO only */
function canManageAllHierarchy(role: string): boolean {
  return getRoleTier(role) >= 4;
}

/** Strip password_hash from user object */
function stripPassword({ password_hash, ...rest }: any) {
  return rest;
}

/* ================================================================== */
/*  GET /api/v1/users                                                  */
/* ================================================================== */
usersRouter.get('/', async (req: any, res) => {
  try {
    const currentUserId = req.user.userId || req.user.id;
    const currentRole = (req.user.role || '').toUpperCase();
    let query = supabase.from('users').select('*').order('first_name');

    // Workers can only see themselves
    if (currentRole === 'ARBEITER') {
      query = query.eq('id', currentUserId);
    }
    // Local managers see themselves + their direct reports
    else if (currentRole === 'LOCAL_MANAGER' || currentRole === 'MANAGER') {
      query = query.or(
        `manager_id.eq.${currentUserId},team_leader_id.eq.${currentUserId},id.eq.${currentUserId}`
      );
    }
    // Executives see themselves + their team leaders + those team leaders' employees
    // CEO and GLOBAL_MANAGER see everyone (no filter)

    // Optional query filters
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
    if (req.query.ceo_id) {
      query = query.eq('ceo_id', req.query.ceo_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ data: (data || []).map(stripPassword) });
  } catch (err: any) {
    console.error('GET /users error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ================================================================== */
/*  GET /api/v1/users/:id                                              */
/* ================================================================== */
usersRouter.get('/:id', async (req: any, res) => {
  try {
    const currentUserId = req.user.userId || req.user.id;
    const currentRole = (req.user.role || '').toUpperCase();

    // Workers can only view themselves
    if ((currentRole === 'ARBEITER') && req.params.id !== currentUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Local managers can view themselves + their direct reports
    if ((currentRole === 'LOCAL_MANAGER' || currentRole === 'MANAGER') && req.params.id !== currentUserId) {
      const { data: target } = await supabase
        .from('users')
        .select('manager_id, team_leader_id')
        .eq('id', req.params.id)
        .single();
      if (!target || (target.manager_id !== currentUserId && target.team_leader_id !== currentUserId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const { data, error } = await supabase
      .from('users').select('*').eq('id', req.params.id).single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Not found' });

    res.json({ data: stripPassword(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================================================== */
/*  GET /api/v1/users/:id/team — direct reports for a team leader      */
/* ================================================================== */
usersRouter.get('/:id/team', async (req: any, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.userId || req.user.id;
    const currentRole = (req.user.role || '').toUpperCase();

    if (currentRole === 'ARBEITER') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if ((currentRole === 'LOCAL_MANAGER' || currentRole === 'MANAGER') && id !== currentUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('team_leader_id', id)
      .order('first_name');

    if (error) throw error;
    res.json({ data: (data || []).map(stripPassword) });
  } catch (err: any) {
    console.error('GET /users/:id/team error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ================================================================== */
/*  GET /api/v1/users/:id/org — full org tree under an executive       */
/*  4-tier: CEO → Executives → Team Leaders → Employees               */
/* ================================================================== */
usersRouter.get('/:id/org', async (req: any, res) => {
  try {
    const { id } = req.params;

    // First determine what tier this user is
    const { data: rootUser, error: e0 } = await supabase
      .from('users').select('id, role, first_name, last_name').eq('id', id).single();
    if (e0) throw e0;
    if (!rootUser) return res.status(404).json({ error: 'Not found' });

    const tier = getRoleTier(rootUser.role);

    if (tier === 4) {
      // CEO: get executives → team leaders → employees
      const { data: executives, error: e1 } = await supabase
        .from('users').select('*').eq('ceo_id', id).order('first_name');
      if (e1) throw e1;

      const execIds = (executives || []).map((e: any) => e.id);

      let leaders: any[] = [];
      if (execIds.length > 0) {
        const { data: tls, error: e2 } = await supabase
          .from('users').select('*').in('executive_id', execIds).order('first_name');
        if (e2) throw e2;
        leaders = tls || [];
      }

      const leaderIds = leaders.map((l: any) => l.id);
      let employees: any[] = [];
      if (leaderIds.length > 0) {
        const { data: emps, error: e3 } = await supabase
          .from('users').select('*').in('team_leader_id', leaderIds).order('first_name');
        if (e3) throw e3;
        employees = emps || [];
      }

      const tree = (executives || []).map((exec: any) => ({
        ...stripPassword(exec),
        teamLeaders: leaders
          .filter((l: any) => l.executive_id === exec.id)
          .map((leader: any) => ({
            ...stripPassword(leader),
            employees: employees
              .filter((e: any) => e.team_leader_id === leader.id)
              .map(stripPassword),
          })),
      }));

      res.json({ data: { ...stripPassword(rootUser), executives: tree } });

    } else if (tier === 3) {
      // Executive: get team leaders → employees
      const { data: leaders, error: e1 } = await supabase
        .from('users').select('*').eq('executive_id', id).order('first_name');
      if (e1) throw e1;

      const leaderIds = (leaders || []).map((l: any) => l.id);
      let employees: any[] = [];
      if (leaderIds.length > 0) {
        const { data: emps, error: e2 } = await supabase
          .from('users').select('*').in('team_leader_id', leaderIds).order('first_name');
        if (e2) throw e2;
        employees = emps || [];
      }

      const tree = (leaders || []).map((leader: any) => ({
        ...stripPassword(leader),
        employees: employees
          .filter((e: any) => e.team_leader_id === leader.id)
          .map(stripPassword),
      }));

      res.json({ data: tree });

    } else if (tier === 2) {
      // Team leader: get direct employees
      const { data: members, error: e1 } = await supabase
        .from('users').select('*').eq('team_leader_id', id).order('first_name');
      if (e1) throw e1;

      res.json({ data: (members || []).map(stripPassword) });

    } else {
      // Employee: no org tree
      res.json({ data: [] });
    }
  } catch (err: any) {
    console.error('GET /users/:id/org error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ================================================================== */
/*  POST /api/v1/users                                                 */
/* ================================================================== */
usersRouter.post('/', requireRole('CEO', 'GLOBAL_MANAGER', 'LOCAL_MANAGER'), async (req: any, res) => {
  try {
    const {
      email, password, first_name, last_name, role, departments,
      phone, is_active, manager_id,
      team_leader_id, executive_id, ceo_id,
    } = req.body;
    const currentUserId = req.user.userId || req.user.id;
    const currentRole = (req.user.role || '').toUpperCase();
    const currentTier = getRoleTier(currentRole);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Tier checks: you can only create users at your tier or below
    const newTier = getRoleTier(role || 'ARBEITER');
    if (newTier >= currentTier) {
      return res.status(403).json({ error: 'Cannot create a user at or above your own tier' });
    }

    // Local managers can only create workers
    if ((currentRole === 'LOCAL_MANAGER' || currentRole === 'MANAGER') && role && getRoleTier(role) > 1) {
      return res.status(403).json({ error: 'Managers can only create employees' });
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

    // Legacy manager_id
    if (currentRole === 'LOCAL_MANAGER' || currentRole === 'MANAGER') {
      insertData.manager_id = currentUserId;
      insertData.team_leader_id = currentUserId;
    } else if (manager_id) {
      insertData.manager_id = manager_id;
    }

    // Hierarchy fields — Exec+ can set team_leader_id and executive_id
    if (canManageHierarchy(currentRole)) {
      if (team_leader_id !== undefined) insertData.team_leader_id = team_leader_id || null;
      if (executive_id !== undefined) insertData.executive_id = executive_id || null;
    }

    // ceo_id — only CEO can assign
    if (canManageAllHierarchy(currentRole)) {
      if (ceo_id !== undefined) insertData.ceo_id = ceo_id || null;
    }

    const { data, error } = await supabase
      .from('users').insert(insertData).select().single();

    if (error) throw error;

    res.status(201).json({ data: stripPassword(data) });
  } catch (err: any) {
    console.error('POST /users error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ================================================================== */
/*  PUT /api/v1/users/:id                                              */
/* ================================================================== */
usersRouter.put('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.userId || req.user.id;
    const currentRole = (req.user.role || '').toUpperCase();
    const currentTier = getRoleTier(currentRole);

    // Workers can only update themselves
    if (currentTier === 1 && id !== currentUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Managers can only update themselves + their direct reports
    if (currentTier === 2 && id !== currentUserId) {
      const { data: target } = await supabase
        .from('users')
        .select('manager_id, team_leader_id')
        .eq('id', id)
        .single();
      if (!target || (target.manager_id !== currentUserId && target.team_leader_id !== currentUserId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const updates: any = {};
    const {
      first_name, last_name, phone, email, role, departments,
      is_active, password, manager_id,
      team_leader_id, executive_id, ceo_id,
      // HR profile fields
      nationality, permit_type, marital_status, children_count,
      canton, ahv_number, iban, entry_date, exit_date,
      contract_type, salary_type, salary_amount, work_pensum,
      hours_per_week, bvg_code, notes,
    } = req.body;

    // ── Fields any authenticated user can update on their own profile ──
    if (first_name !== undefined) updates.first_name = first_name;
    if (last_name !== undefined) updates.last_name = last_name;
    if (phone !== undefined) updates.phone = phone;

    // ── Fields managers+ (tier 2+) can update ──
    if (currentTier >= 2) {
      if (email !== undefined) updates.email = email;
      if (departments !== undefined) updates.departments = departments;
      if (is_active !== undefined) updates.is_active = is_active;

      // HR profile fields
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

    // ── Hierarchy fields — Exec+ (tier 3+) can set team_leader_id, executive_id ──
    if (currentTier >= 3) {
      if (role !== undefined) updates.role = role;
      if (manager_id !== undefined) updates.manager_id = manager_id || null;
      if (team_leader_id !== undefined) updates.team_leader_id = team_leader_id || null;
      if (executive_id !== undefined) updates.executive_id = executive_id || null;
    }

    // ── ceo_id — only CEO (tier 4) can assign executives to a CEO ──
    if (currentTier >= 4) {
      if (ceo_id !== undefined) updates.ceo_id = ceo_id || null;
    }

    // ── Password ──
    if (password) {
      updates.password_hash = await bcrypt.hash(password, 10);
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('users').update(updates).eq('id', id).select().single();

    if (error) throw error;

    res.json({ data: stripPassword(data) });
  } catch (err: any) {
    console.error('PUT /users error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ================================================================== */
/*  DELETE /api/v1/users/:id                                           */
/* ================================================================== */
usersRouter.delete('/:id', requireRole('CEO', 'GLOBAL_MANAGER'), async (req: any, res) => {
  try {
    const { id } = req.params;

    // Clear all hierarchy references to this user before deleting
    await supabase.from('users').update({ ceo_id: null }).eq('ceo_id', id);
    await supabase.from('users').update({ executive_id: null }).eq('executive_id', id);
    await supabase.from('users').update({ team_leader_id: null }).eq('team_leader_id', id);
    await supabase.from('users').update({ manager_id: null }).eq('manager_id', id);

    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
