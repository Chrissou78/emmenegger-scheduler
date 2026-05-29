import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';

export const machinesRouter = Router();

// ─── GET /api/v1/machines ───
machinesRouter.get('/', async (req, res, next) => {
  try {
    const { category, active } = req.query;

    let query = supabase.from('machines').select('*');

    if (category) {
      query = query.eq('category', category);
    }

    if (active !== undefined) {
      query = query.eq('is_active', active === 'true');
    }

    const { data: machines, error } = await query
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    res.json({ data: machines || [] });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/machines/:id ───
machinesRouter.get('/:id', async (req, res, next) => {
  try {
    // Guard: skip if the "id" looks like a sub-route keyword
    if (req.params.id === 'allocations') return next();

    const { data, error } = await supabase
      .from('machines')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error && error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Machine not found' });
    }
    if (error) throw error;

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/machines ───
machinesRouter.post('/', requireRole('GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const {
      inventoryNr, inventory_nr, name, category, tonnage, operator, notes,
      type, license_plate, status, department, brand, model, year, serial_number,
    } = req.body;

    const { data: machine, error } = await supabase
      .from('machines')
      .insert([{
        inventory_nr: inventoryNr || inventory_nr || null,
        name,
        category: category || null,
        type: type || null,
        tonnage: tonnage || null,
        operator: operator || 'EMMENEGGER',
        license_plate: license_plate || null,
        status: status || 'AVAILABLE',
        department: department || null,
        brand: brand || null,
        model: model || null,
        year: year || null,
        serial_number: serial_number || null,
        notes: notes || null,
        is_active: true,
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data: machine });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/v1/machines/:id ───
machinesRouter.put('/:id', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const allowed = [
      'name', 'type', 'category', 'license_plate', 'status', 'department',
      'notes', 'year', 'brand', 'model', 'serial_number', 'tonnage',
      'operator', 'inventory_nr', 'is_active',
    ];
    const updates: any = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const { data, error } = await supabase
      .from('machines')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/v1/machines/:id ───
machinesRouter.delete('/:id', requireRole('GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('machines')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

/* ================================================================== */
/*  MACHINE ALLOCATIONS                                                */
/* ================================================================== */

// ─── GET /api/v1/machines/allocations ───
machinesRouter.post('/allocations', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { machineId, machine_id, siteId, site_id, weekId, week_id, dayOfWeek, day_of_week } = req.body;

    const mId  = machineId  || machine_id;
    const sId  = siteId     || site_id || null;   // ★ optional — can be null
    const wId  = weekId     || week_id;
    const dow  = dayOfWeek  ?? day_of_week;

    // ★ siteId is NOT required — machines can be allocated without a linked task
    if (!mId || !wId || dow === undefined || dow === null) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'machineId, weekId, and dayOfWeek are required',
      });
    }

    const { data: existing, error: checkErr } = await supabase
      .from('machine_allocations')
      .select('id')
      .eq('machine_id', mId)
      .eq('week_id', wId)
      .eq('day_of_week', dow)
      .maybeSingle();

    if (checkErr) throw checkErr;

    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Machine already allocated on this day',
      });
    }

    const { data: allocation, error } = await supabase
      .from('machine_allocations')
      .insert([{
        machine_id:    mId,
        site_id:       sId,              // ★ null is OK
        week_id:       wId,
        day_of_week:   dow,
        created_by_id: req.user!.userId,
      }])
      .select(`
        id,
        machine_id,
        site_id,
        week_id,
        day_of_week,
        created_by_id,
        created_at,
        machine:machines(*),
        site:tasks(id, name, code)
      `)
      .single();

    if (error) throw error;

    res.status(201).json({ data: allocation });
  } catch (err) {
    next(err);
  }
});

// ★ GET /api/v1/machines/:machineId/allocations — per-machine history
machinesRouter.get('/:machineId/allocations', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('machine_allocations')
      .select(`
        id,
        machine_id,
        site_id,
        week_id,
        day_of_week,
        created_by_id,
        created_at,
        machine:machines(*),
        site:tasks(id, name, code, location, color)
      `)
      .eq('machine_id', req.params.machineId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({ data: data || [] });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/machines/allocations ── ★ FIXED ───
machinesRouter.post('/allocations', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { machineId, machine_id, siteId, site_id, weekId, week_id, dayOfWeek, day_of_week } = req.body;

    // Normalize — accept both camelCase and snake_case
    const mId  = machineId  || machine_id;
    const sId  = siteId     || site_id;
    const wId  = weekId     || week_id;
    const dow  = dayOfWeek  ?? day_of_week;

    if (!mId || !sId || !wId || dow === undefined || dow === null) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'machineId, siteId, weekId, and dayOfWeek are required',
      });
    }

    // ★ FIX: Use .maybeSingle() instead of .single() to avoid PGRST116 error
    //    .single() throws when 0 rows are found; .maybeSingle() returns null.
    const { data: existing, error: checkErr } = await supabase
      .from('machine_allocations')
      .select('id')
      .eq('machine_id', mId)
      .eq('week_id', wId)
      .eq('day_of_week', dow)
      .maybeSingle();

    if (checkErr) throw checkErr;

    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Machine already allocated on this day',
      });
    }

    const { data: allocation, error } = await supabase
      .from('machine_allocations')
      .insert([{
        machine_id:    mId,
        site_id:       sId,
        week_id:       wId,
        day_of_week:   dow,
        created_by_id: req.user!.userId,
      }])
      .select(`
        id,
        machine_id,
        site_id,
        week_id,
        day_of_week,
        created_by_id,
        created_at,
        machine:machines(*),
        site:tasks(id, name, code)
      `)
      .single();

    if (error) throw error;

    res.status(201).json({ data: allocation });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/v1/machines/allocations/:id ───
machinesRouter.delete('/allocations/:id', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('machine_allocations')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
