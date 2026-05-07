import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';

export const tasksRouter = Router();

// GET /api/v1/tasks
tasksRouter.get('/', async (req, res, next) => {
  try {
    const { scheduleType, status, customerId, code } = req.query;

    let query = supabase.from('tasks').select(`
      id,
      code,
      name,
      description,
      color,
      schedule_type,
      status,
      estimated_hours,
      sort_order,
      is_recurring,
      recurrence_type,
      customer:customers(id, name),
      created_at,
      updated_at
    `);

    if (code) query = query.eq('code', code);
    if (scheduleType) query = query.eq('schedule_type', scheduleType);
    if (status) query = query.eq('status', status);
    if (customerId) query = query.eq('customer_id', customerId);

    const { data: tasks, error } = await query.order('sort_order', { ascending: true });
    if (error) throw error;

    res.json({ success: true, data: tasks || [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tasks
tasksRouter.post('/', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const {
      customerId, code, name, description, location, scheduleType,
      isRecurring, recurrenceType, recurrenceWeeks, seasonalTasks,
      estimatedHours, machines, materials, color, sortOrder,
    } = req.body;

    const { data: task, error } = await supabase
      .from('tasks')
      .insert([{
        customer_id: customerId,
        code, name, description, location,
        schedule_type: scheduleType,
        is_recurring: isRecurring || false,
        recurrence_type: recurrenceType || 'NONE',
        recurrence_weeks: recurrenceWeeks || [],
        seasonal_tasks: seasonalTasks || [],
        estimated_hours: estimatedHours,
        machines: machines || [],
        materials,
        color: color || '#8B7355',
        sort_order: sortOrder || 0,
        status: 'ACTIVE',
      }])
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data: task });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/tasks/:id
tasksRouter.put('/:id', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { name, description, location, status, color, sortOrder, machines, estimatedHours } = req.body;

    const { data: task, error } = await supabase
      .from('tasks')
      .update({
        name, description, location, status, color,
        sort_order: sortOrder,
        machines,
        estimated_hours: estimatedHours,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/tasks/:id
tasksRouter.delete('/:id', requireRole('GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
