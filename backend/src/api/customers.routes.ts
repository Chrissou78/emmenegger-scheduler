import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';

export const customersRouter = Router();

// GET /api/v1/customers — list with filters, search, pagination
customersRouter.get('/', async (req, res, next) => {
  try {
    const { search, status, customer_type, limit, offset, includeInactive } = req.query;

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' });

    // By default only active, unless explicitly requested
    if (includeInactive !== 'true') {
      query = query.eq('is_active', true);
    }

    if (status && typeof status === 'string') {
      query = query.eq('status', status.toUpperCase());
    }

    if (customer_type && typeof customer_type === 'string') {
      query = query.eq('customer_type', customer_type.toUpperCase());
    }

    if (search && typeof search === 'string' && search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.or(`name.ilike.${s},company_name.ilike.${s},contact_name.ilike.${s},city.ilike.${s},email.ilike.${s}`);
    }

    const lim = Math.min(parseInt(String(limit)) || 50, 200);
    const off = parseInt(String(offset)) || 0;

    const { data, error, count } = await query
      .order('name', { ascending: true })
      .range(off, off + lim - 1);

    if (error) throw error;

    res.json({ data: data || [], meta: { total: count || 0, limit: lim, offset: off } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/customers/:id — single customer with contacts
customersRouter.get('/:id', async (req, res, next) => {
  try {
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Fetch contacts
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('customer_id', req.params.id)
      .order('is_primary', { ascending: false })
      .order('last_name', { ascending: true });

    // Fetch task count
    const { count: taskCount } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', req.params.id);

    // Fetch quotation count and total
    const { data: quoteStats } = await supabase
      .from('quotations')
      .select('id, total_gross')
      .eq('customer_id', req.params.id);

    // Fetch invoice count and totals
    const { data: invoiceStats } = await supabase
      .from('invoices')
      .select('id, total_gross, status')
      .eq('customer_id', req.params.id);

    const totalRevenue = (invoiceStats || [])
      .filter(i => i.status === 'PAID')
      .reduce((sum, i) => sum + (parseFloat(i.total_gross) || 0), 0);

    const totalOutstanding = (invoiceStats || [])
      .filter(i => ['SENT', 'OVERDUE'].includes(i.status))
      .reduce((sum, i) => sum + (parseFloat(i.total_gross) || 0), 0);

    res.json({
      data: {
        ...customer,
        contacts: contacts || [],
        stats: {
          taskCount: taskCount || 0,
          quoteCount: (quoteStats || []).length,
          quoteTotal: (quoteStats || []).reduce((s, q) => s + (parseFloat(q.total_gross) || 0), 0),
          invoiceCount: (invoiceStats || []).length,
          totalRevenue,
          totalOutstanding,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/customers
customersRouter.post('/', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const {
      name, customer_type, company_name, street, postal_code, city, canton,
      country, address, contact_name, phone, email, website, notes,
      contact_phone, contact_email, status, tags, language,
      payment_terms, vat_number, discount_percent,
    } = req.body;

    const { data: customer, error } = await supabase
      .from('customers')
      .insert([{
        name: name || company_name,
        customer_type: customer_type || 'PRIVAT',
        company_name,
        street,
        postal_code,
        city,
        canton,
        country: country || 'CH',
        address: address || [street, `${postal_code || ''} ${city || ''}`.trim()].filter(Boolean).join(', '),
        contact_name,
        contact_phone: contact_phone || phone,
        contact_email: contact_email || email,
        phone,
        email,
        website,
        notes,
        status: status || 'ACTIVE',
        tags: tags || [],
        language: language || 'de',
        payment_terms: payment_terms || 30,
        vat_number,
        discount_percent: discount_percent || 0,
        is_active: true,
      }])
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
    const {
      name, customer_type, company_name, street, postal_code, city, canton,
      country, address, contact_name, phone, email, website, notes,
      contact_phone, contact_email, status, tags, language, is_active,
      payment_terms, vat_number, discount_percent,
    } = req.body;

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };

    // Only set fields that are explicitly provided
    if (name !== undefined) updateData.name = name;
    if (customer_type !== undefined) updateData.customer_type = customer_type;
    if (company_name !== undefined) updateData.company_name = company_name;
    if (street !== undefined) updateData.street = street;
    if (postal_code !== undefined) updateData.postal_code = postal_code;
    if (city !== undefined) updateData.city = city;
    if (canton !== undefined) updateData.canton = canton;
    if (country !== undefined) updateData.country = country;
    if (address !== undefined) updateData.address = address;
    if (contact_name !== undefined) updateData.contact_name = contact_name;
    if (contact_phone !== undefined) updateData.contact_phone = contact_phone;
    if (contact_email !== undefined) updateData.contact_email = contact_email;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (website !== undefined) updateData.website = website;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;
    if (tags !== undefined) updateData.tags = tags;
    if (language !== undefined) updateData.language = language;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (payment_terms !== undefined) updateData.payment_terms = payment_terms;
    if (vat_number !== undefined) updateData.vat_number = vat_number;
    if (discount_percent !== undefined) updateData.discount_percent = discount_percent;

    const { data: customer, error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ data: customer });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/customers/:id (soft delete)
customersRouter.delete('/:id', requireRole('GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('customers')
      .update({ is_active: false, status: 'INACTIVE', updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
