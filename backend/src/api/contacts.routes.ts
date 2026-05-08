import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';

export const contactsRouter = Router();

// GET /api/v1/contacts?customer_id=xxx
contactsRouter.get('/', async (req, res, next) => {
  try {
    const { customer_id } = req.query;

    let query = supabase.from('contacts').select('*');

    if (customer_id) {
      query = query.eq('customer_id', customer_id);
    }

    const { data, error } = await query
      .order('is_primary', { ascending: false })
      .order('last_name', { ascending: true });

    if (error) throw error;
    res.json({ data: data || [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/contacts
contactsRouter.post('/', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { customer_id, first_name, last_name, role, phone, mobile, email, is_primary, notes } = req.body;

    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });

    // If setting as primary, unset others
    if (is_primary) {
      await supabase
        .from('contacts')
        .update({ is_primary: false })
        .eq('customer_id', customer_id);
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert([{ customer_id, first_name, last_name, role, phone, mobile, email, is_primary: is_primary || false, notes }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/contacts/:id
contactsRouter.put('/:id', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { first_name, last_name, role, phone, mobile, email, is_primary, notes } = req.body;

    // If setting as primary, get the customer_id first then unset others
    if (is_primary) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('customer_id')
        .eq('id', req.params.id)
        .single();

      if (existing) {
        await supabase
          .from('contacts')
          .update({ is_primary: false })
          .eq('customer_id', existing.customer_id);
      }
    }

    const { data, error } = await supabase
      .from('contacts')
      .update({ first_name, last_name, role, phone, mobile, email, is_primary, notes, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/contacts/:id
contactsRouter.delete('/:id', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
