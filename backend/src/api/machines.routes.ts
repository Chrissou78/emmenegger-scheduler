import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';

export const machinesRouter = Router();

// GET /api/v1/machines
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
      .order('tonnage', { ascending: true });

    if (error) throw error;

    res.json({ data: machines || [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/machines
machinesRouter.post('/', requireRole('GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { inventoryNr, name, category, tonnage, operator, notes } = req.body;

    const { data: machine, error } = await supabase
      .from('machines')
      .insert([
        {
          inventory_nr: inventoryNr,
          name,
          category,
          tonnage,
          operator: operator || 'EMMENEGGER',
          notes,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data: machine });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/machines/allocations
machinesRouter.get('/allocations', async (req, res, next) => {
  try {
    const { weekId } = req.query;

    let query = supabase.from('machine_allocations').select(`
      id,
      machine_id,
      site_id,
      week_id,
      day_of_week,
      created_by_id,
      created_at,
      machine:machines(*),
      site:tasks(id, name, location)
    `);

    if (weekId) {
      query = query.eq('week_id', weekId);
    }

    const { data: allocations, error } = await query.order('day_of_week', { ascending: true });

    if (error) throw error;

    res.json({ data: allocations || [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/machines/allocations
machinesRouter.post('/allocations', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { machineId, siteId, weekId, dayOfWeek } = req.body;

    // Check for existing allocation
    const { data: existing } = await supabase
      .from('machine_allocations')
      .select('id')
      .eq('machine_id', machineId)
      .eq('week_id', weekId)
      .eq('day_of_week', dayOfWeek)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Machine already allocated on this day' });
    }

    const { data: allocation, error } = await supabase
      .from('machine_allocations')
      .insert([
        {
          machine_id: machineId,
          site_id: siteId,
          week_id: weekId,
          day_of_week: dayOfWeek,
          created_by_id: req.user!.userId,
        },
      ])
      .select(`
        id,
        machine_id,
        site_id,
        week_id,
        day_of_week,
        created_by_id,
        created_at,
        machine:machines(*),
        site:tasks(id, name)
      `)
      .single();

    if (error) throw error;

    res.status(201).json({ data: allocation });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/machines/allocations/:id
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
