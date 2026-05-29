// backend/src/api/jobs.routes.ts
import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';

export const jobsRouter = Router();

// ─── GET /api/v1/jobs?weekId=xxx ───
// Returns all jobs for a week with embedded task, customer, machines
jobsRouter.get('/', async (req, res, next) => {
  try {
    const { weekId, userId } = req.query;
    if (!weekId) return res.status(400).json({ error: 'weekId required' });

    let query = supabase
      .from('jobs')
      .select(`
        *,
        task:tasks ( id, code, name, color, schedule_type, status, customer_id,
          customer:customers ( id, name, company_name, address, city, contact_name, contact_phone )
        ),
        machines:job_machines (
          id,
          machine_id,
          machine:machines ( id, name, category, inventory_nr, tonnage, is_active, status )
        )
      `)
      .eq('week_id', weekId as string);

    if (userId) query = query.eq('user_id', userId as string);

    const { data, error } = await query.order('time_slot', { ascending: true });
    if (error) throw error;

    res.json({ data: data || [] });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/jobs/:id ───
jobsRouter.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        task:tasks ( id, code, name, color, schedule_type, status, customer_id,
          customer:customers ( id, name, company_name, address, city, contact_name, contact_phone )
        ),
        machines:job_machines (
          id,
          machine_id,
          machine:machines ( id, name, category, inventory_nr, tonnage, is_active, status )
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Job not found' });

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/jobs ───
// Creates a job with optional machines in one go
jobsRouter.post('/', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER', 'MANAGER'), async (req, res, next) => {
  try {
    const { weekId, userId, dayOfWeek, timeSlot, taskId, customerId, machineIds, notes } = req.body;

    if (!weekId || !userId || dayOfWeek === undefined || !taskId) {
      return res.status(400).json({ error: 'weekId, userId, dayOfWeek, taskId are required' });
    }

    const slot = timeSlot || 1;

    // Check max 2 jobs per cell
    const { count } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('week_id', weekId)
      .eq('user_id', userId)
      .eq('day_of_week', dayOfWeek);

    if ((count || 0) >= 2) {
      return res.status(409).json({ error: 'Maximum 2 jobs per cell' });
    }

    // Auto-resolve customer from task if not provided
    let resolvedCustomerId = customerId || null;
    if (!resolvedCustomerId) {
      const { data: task } = await supabase
        .from('tasks')
        .select('customer_id')
        .eq('id', taskId)
        .single();
      resolvedCustomerId = task?.customer_id || null;
    }

    // Check machine conflicts (same machine, same day, same week)
    if (machineIds && machineIds.length > 0) {
      const { data: conflicts } = await supabase
        .from('job_machines')
        .select('machine_id, job:jobs!inner( week_id, day_of_week )')
        .in('machine_id', machineIds);

      const conflicting = (conflicts || []).filter((c: any) =>
        c.job?.week_id === weekId && c.job?.day_of_week === dayOfWeek
      );

      if (conflicting.length > 0) {
        return res.status(409).json({
          error: 'Machine conflict',
          conflictingMachineIds: conflicting.map((c: any) => c.machine_id),
        });
      }
    }

    // Insert job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert([{
        week_id: weekId,
        user_id: userId,
        day_of_week: dayOfWeek,
        time_slot: slot,
        task_id: taskId,
        customer_id: resolvedCustomerId,
        notes: notes || null,
      }])
      .select()
      .single();

    if (jobError) throw jobError;

    // Insert machines
    if (machineIds && machineIds.length > 0 && job) {
      const rows = machineIds.map((mid: string) => ({
        job_id: job.id,
        machine_id: mid,
      }));
      const { error: machError } = await supabase
        .from('job_machines')
        .insert(rows);
      if (machError) throw machError;
    }

    // Fetch full job with relations
    const { data: fullJob } = await supabase
      .from('jobs')
      .select(`
        *,
        task:tasks ( id, code, name, color, schedule_type, status, customer_id,
          customer:customers ( id, name, company_name, address, city, contact_name, contact_phone )
        ),
        machines:job_machines (
          id,
          machine_id,
          machine:machines ( id, name, category, inventory_nr, tonnage, is_active, status )
        )
      `)
      .eq('id', job.id)
      .single();

    res.status(201).json({ data: fullJob });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/v1/jobs/:id ───
// Update task, customer, notes, and/or replace machine list
jobsRouter.put('/:id', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER', 'MANAGER'), async (req, res, next) => {
  try {
    const { taskId, customerId, machineIds, notes } = req.body;
    const jobId = req.params.id;

    // Fetch existing job
    const { data: existing, error: fetchErr } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ error: 'Job not found' });

    // Build update
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (taskId !== undefined) update.task_id = taskId;
    if (customerId !== undefined) update.customer_id = customerId || null;
    if (notes !== undefined) update.notes = notes || null;

    const { error: updateErr } = await supabase
      .from('jobs')
      .update(update)
      .eq('id', jobId);

    if (updateErr) throw updateErr;

    // Replace machines if provided
    if (machineIds !== undefined) {
      // Check conflicts
      if (machineIds.length > 0) {
        const { data: conflicts } = await supabase
          .from('job_machines')
          .select('machine_id, job_id, job:jobs!inner( week_id, day_of_week )')
          .in('machine_id', machineIds)
          .neq('job_id', jobId);

        const conflicting = (conflicts || []).filter((c: any) =>
          c.job?.week_id === existing.week_id && c.job?.day_of_week === existing.day_of_week
        );

        if (conflicting.length > 0) {
          return res.status(409).json({
            error: 'Machine conflict',
            conflictingMachineIds: conflicting.map((c: any) => c.machine_id),
          });
        }
      }

      // Delete old machines
      await supabase.from('job_machines').delete().eq('job_id', jobId);

      // Insert new
      if (machineIds.length > 0) {
        const rows = machineIds.map((mid: string) => ({ job_id: jobId, machine_id: mid }));
        const { error: machErr } = await supabase.from('job_machines').insert(rows);
        if (machErr) throw machErr;
      }
    }

    // Fetch full job
    const { data: fullJob } = await supabase
      .from('jobs')
      .select(`
        *,
        task:tasks ( id, code, name, color, schedule_type, status, customer_id,
          customer:customers ( id, name, company_name, address, city, contact_name, contact_phone )
        ),
        machines:job_machines (
          id,
          machine_id,
          machine:machines ( id, name, category, inventory_nr, tonnage, is_active, status )
        )
      `)
      .eq('id', jobId)
      .single();

    res.json({ data: fullJob });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/jobs/:id/machines ───
// Add a single machine to an existing job
jobsRouter.post('/:id/machines', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER', 'MANAGER'), async (req, res, next) => {
  try {
    const jobId = req.params.id;
    const { machineId } = req.body;
    if (!machineId) return res.status(400).json({ error: 'machineId required' });

    // Fetch job
    const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).single();
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Conflict check
    const { data: conflicts } = await supabase
      .from('job_machines')
      .select('machine_id, job:jobs!inner( week_id, day_of_week )')
      .eq('machine_id', machineId);

    const hasConflict = (conflicts || []).some((c: any) =>
      c.job?.week_id === job.week_id && c.job?.day_of_week === job.day_of_week
    );

    if (hasConflict) {
      return res.status(409).json({ error: 'Machine already allocated on this day' });
    }

    const { data, error } = await supabase
      .from('job_machines')
      .insert([{ job_id: jobId, machine_id: machineId }])
      .select(`
        id,
        machine_id,
        machine:machines ( id, name, category, inventory_nr, tonnage, is_active, status )
      `)
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/v1/jobs/:jobId/machines/:machineAllocId ───
jobsRouter.delete('/:jobId/machines/:machineAllocId', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER', 'MANAGER'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('job_machines')
      .delete()
      .eq('id', req.params.machineAllocId)
      .eq('job_id', req.params.jobId);

    if (error) throw error;
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/v1/jobs/:id ───
jobsRouter.delete('/:id', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER', 'MANAGER'), async (req, res, next) => {
  try {
    // job_machines cascade-deletes automatically
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
