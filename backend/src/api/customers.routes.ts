import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';

export const customersRouter = Router();

// GET /api/v1/customers
customersRouter.get('/', async (req, res, next) => {
  try {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    res.json({ data: customers || [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/customers
customersRouter.post('/', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { name, address, contactName, contactPhone, contactEmail, notes } = req.body;

    const { data: customer, error } = await supabase
      .from('customers')
      .insert([
        {
          name,
          address,
          contact_name: contactName,
          contact_phone: contactPhone,
          contact_email: contactEmail,
          notes,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data: customer });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/customers/:id
customersRouter.put('/:id', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { name, address, contactName, contactPhone, contactEmail, notes, isActive } = req.body;

    const { data: customer, error } = await supabase
      .from('customers')
      .update({
        name,
        address,
        contact_name: contactName,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        notes,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ data: customer });
  } catch (err) {
    next(err);
  }
});
