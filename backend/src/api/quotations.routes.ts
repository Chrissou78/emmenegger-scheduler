import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';

export const quotationsRouter = Router();

// GET /api/v1/quotations
quotationsRouter.get('/', async (req, res, next) => {
  try {
    const { customer_id, status, search, limit, offset } = req.query;

    let query = supabase
      .from('quotations')
      .select(`
        *,
        customer:customers(id, name, city),
        contact:contacts(id, first_name, last_name),
        items:quotation_items(*)
      `, { count: 'exact' });

    if (customer_id) query = query.eq('customer_id', customer_id);
    if (status && typeof status === 'string') query = query.eq('status', status.toUpperCase());
    if (search && typeof search === 'string' && search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.or(`quote_number.ilike.${s},title.ilike.${s}`);
    }

    const lim = Math.min(parseInt(String(limit)) || 50, 200);
    const off = parseInt(String(offset)) || 0;

    const { data, error, count } = await query
      .order('quote_date', { ascending: false })
      .range(off, off + lim - 1);

    if (error) throw error;
    res.json({ data: data || [], meta: { total: count || 0, limit: lim, offset: off } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/quotations/:id
quotationsRouter.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('quotations')
      .select(`
        *,
        customer:customers(id, name, company_name, street, postal_code, city, canton, email, phone, vat_number),
        contact:contacts(id, first_name, last_name, email, phone),
        items:quotation_items(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Quotation not found' });

    // Sort items by sort_order
    if (data.items) {
      data.items.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/quotations
quotationsRouter.post('/', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const {
      customer_id, contact_id, title, description, status,
      valid_until, notes, currency, payment_terms, items,
    } = req.body;

    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });

    // Generate quote number
    const { data: numResult } = await supabase.rpc('next_quote_number');
    const quote_number = numResult || `OFF-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    // Calculate totals from items
    const lineItems = items || [];
    const subtotal = lineItems.reduce((sum: number, it: any) => {
      const qty = parseFloat(it.quantity) || 0;
      const price = parseFloat(it.unit_price) || 0;
      const disc = parseFloat(it.discount_percent) || 0;
      return sum + (qty * price * (1 - disc / 100));
    }, 0);

    const totalVat = lineItems.reduce((sum: number, it: any) => {
      const qty = parseFloat(it.quantity) || 0;
      const price = parseFloat(it.unit_price) || 0;
      const disc = parseFloat(it.discount_percent) || 0;
      const vatRate = parseFloat(it.vat_rate) || 8.1;
      const lineTotal = qty * price * (1 - disc / 100);
      return sum + (lineTotal * vatRate / 100);
    }, 0);

    // Insert quotation
    const { data: quotation, error: qError } = await supabase
      .from('quotations')
      .insert([{
        quote_number,
        customer_id,
        contact_id: contact_id || null,
        title: title || `Offerte ${quote_number}`,
        description,
        status: status || 'DRAFT',
        quote_date: new Date().toISOString().split('T')[0],
        valid_until: valid_until || null,
        subtotal: Math.round(subtotal * 100) / 100,
        vat_amount: Math.round(totalVat * 100) / 100,
        total_gross: Math.round((subtotal + totalVat) * 100) / 100,
        discount_amount: 0,
        currency: currency || 'CHF',
        payment_terms: payment_terms || 30,
        notes,
        created_by: req.user?.userId,
      }])
      .select()
      .single();

    if (qError) throw qError;

    // Insert items
    if (lineItems.length > 0 && quotation) {
      const itemRows = lineItems.map((it: any, idx: number) => ({
        quotation_id: quotation.id,
        sort_order: idx + 1,
        line_type: it.line_type || 'SERVICE', 
        spare_part_id: it.spare_part_id || null, 
        description: it.description || '',
        detail: it.detail || null,
        quantity: parseFloat(it.quantity) || 1,
        unit: it.unit || 'Std',
        unit_price: parseFloat(it.unit_price) || 0,
        discount_percent: parseFloat(it.discount_percent) || 0,
        vat_rate: parseFloat(it.vat_rate) || 8.1,
        total: Math.round(
          (parseFloat(it.quantity) || 1) *
          (parseFloat(it.unit_price) || 0) *
          (1 - (parseFloat(it.discount_percent) || 0) / 100) * 100
        ) / 100,
        task_id: it.task_id || null,
      }));

      const { error: iError } = await supabase
        .from('quotation_items')
        .insert(itemRows);

      if (iError) throw iError;
    }

    res.status(201).json({ data: quotation });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/quotations/:id
quotationsRouter.put('/:id', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const {
      customer_id, contact_id, title, description, status,
      valid_until, notes, currency, payment_terms, items,
      discount_amount,
    } = req.body;

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };

    if (customer_id !== undefined) updateData.customer_id = customer_id;
    if (contact_id !== undefined) updateData.contact_id = contact_id;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (notes !== undefined) updateData.notes = notes;
    if (currency !== undefined) updateData.currency = currency;
    if (payment_terms !== undefined) updateData.payment_terms = payment_terms;
    if (valid_until !== undefined) updateData.valid_until = valid_until;
    if (discount_amount !== undefined) updateData.discount_amount = discount_amount;

    if (status) {
      updateData.status = status;
      if (status === 'SENT') updateData.sent_date = new Date().toISOString().split('T')[0];
      if (status === 'ACCEPTED') updateData.accepted_date = new Date().toISOString().split('T')[0];
    }

    // Recalculate totals if items provided
    if (items && Array.isArray(items)) {
      const subtotal = items.reduce((sum: number, it: any) => {
        const qty = parseFloat(it.quantity) || 0;
        const price = parseFloat(it.unit_price) || 0;
        const disc = parseFloat(it.discount_percent) || 0;
        return sum + (qty * price * (1 - disc / 100));
      }, 0);

      const totalVat = items.reduce((sum: number, it: any) => {
        const qty = parseFloat(it.quantity) || 0;
        const price = parseFloat(it.unit_price) || 0;
        const disc = parseFloat(it.discount_percent) || 0;
        const vatRate = parseFloat(it.vat_rate) || 8.1;
        const lineTotal = qty * price * (1 - disc / 100);
        return sum + (lineTotal * vatRate / 100);
      }, 0);

      const da = parseFloat(discount_amount) || 0;
      updateData.subtotal = Math.round(subtotal * 100) / 100;
      updateData.vat_amount = Math.round(totalVat * 100) / 100;
      updateData.total_gross = Math.round((subtotal + totalVat - da) * 100) / 100;

      // Replace items: delete old, insert new
      await supabase
        .from('quotation_items')
        .delete()
        .eq('quotation_id', req.params.id);

      if (items.length > 0) {
        const itemRows = items.map((it: any, idx: number) => ({
          quotation_id: req.params.id,
          sort_order: idx + 1,
          description: it.description || '',
          detail: it.detail || null,
          quantity: parseFloat(it.quantity) || 1,
          unit: it.unit || 'Std',
          unit_price: parseFloat(it.unit_price) || 0,
          discount_percent: parseFloat(it.discount_percent) || 0,
          vat_rate: parseFloat(it.vat_rate) || 8.1,
          total: Math.round(
            (parseFloat(it.quantity) || 1) *
            (parseFloat(it.unit_price) || 0) *
            (1 - (parseFloat(it.discount_percent) || 0) / 100) * 100
          ) / 100,
          task_id: it.task_id || null,
        }));

        await supabase.from('quotation_items').insert(itemRows);
      }
    }

    const { data, error } = await supabase
      .from('quotations')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/quotations/:id
quotationsRouter.delete('/:id', requireRole('GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    // Delete items first
    await supabase.from('quotation_items').delete().eq('quotation_id', req.params.id);
    const { error } = await supabase.from('quotations').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/quotations/:id/convert-to-invoice — convert accepted quote to invoice
quotationsRouter.post('/:id/convert-to-invoice', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    // Get quotation with items
    const { data: quote, error: qErr } = await supabase
      .from('quotations')
      .select('*, items:quotation_items(*)')
      .eq('id', req.params.id)
      .single();

    if (qErr || !quote) return res.status(404).json({ error: 'Quotation not found' });

    // Generate invoice number
    const { data: invNum } = await supabase.rpc('next_invoice_number');
    const invoice_number = invNum || `RE-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    // Create invoice
    const { data: invoice, error: iErr } = await supabase
      .from('invoices')
      .insert([{
        invoice_number,
        quotation_id: quote.id,
        customer_id: quote.customer_id,
        contact_id: quote.contact_id,
        title: quote.title?.replace('Offerte', 'Rechnung') || `Rechnung ${invoice_number}`,
        description: quote.description,
        status: 'DRAFT',
        invoice_date: new Date().toISOString().split('T')[0],
        subtotal: quote.subtotal,
        vat_amount: quote.vat_amount,
        discount_amount: quote.discount_amount || 0,
        total_gross: quote.total_gross,
        currency: quote.currency,
        payment_terms: quote.payment_terms,
        notes: quote.notes,
        created_by: req.user?.userId,
      }])
      .select()
      .single();

    if (iErr) throw iErr;

    // Copy items
    if (quote.items && quote.items.length > 0 && invoice) {
      const invoiceItems = quote.items.map((it: any) => ({
        invoice_id: invoice.id,
        sort_order: it.sort_order,
        line_type: it.line_type || 'SERVICE',
        spare_part_id: it.spare_part_id || null,
        description: it.description,
        detail: it.detail,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        discount_percent: it.discount_percent,
        vat_rate: it.vat_rate,
        total: it.total,
        task_id: it.task_id,
      }));

      await supabase.from('invoice_items').insert(invoiceItems);
    }

    // Mark quotation as converted
    await supabase
      .from('quotations')
      .update({ status: 'INVOICED', updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    res.status(201).json({ data: invoice });
  } catch (err) {
    next(err);
  }
});

quotationsRouter.post('/field', async (req, res, next) => {
  try {
    const {
      customer_id, title, description, notes,
      items, signature_data, job_id,
    } = req.body;

    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'At least one item is required' });

    // Generate quote number
    const { data: numResult } = await supabase.rpc('next_quote_number');
    const quote_number = numResult || `OFF-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    // Calculate totals
    const lineItems = items || [];
    const subtotal = lineItems.reduce((sum: number, it: any) => {
      const qty = parseFloat(it.quantity) || 0;
      const price = parseFloat(it.unit_price) || 0;
      const disc = parseFloat(it.discount_percent) || 0;
      return sum + (qty * price * (1 - disc / 100));
    }, 0);

    const totalVat = lineItems.reduce((sum: number, it: any) => {
      const qty = parseFloat(it.quantity) || 0;
      const price = parseFloat(it.unit_price) || 0;
      const disc = parseFloat(it.discount_percent) || 0;
      const vatRate = parseFloat(it.vat_rate) || 8.1;
      const lineTotal = qty * price * (1 - disc / 100);
      return sum + (lineTotal * vatRate / 100);
    }, 0);

    // Insert quotation
    const { data: quotation, error: qError } = await supabase
      .from('quotations')
      .insert([{
        quote_number,
        customer_id,
        title: title || `Offerte ${quote_number}`,
        description: description || null,
        status: signature_data ? 'ACCEPTED' : 'DRAFT',
        quote_date: new Date().toISOString().split('T')[0],
        valid_until: null,
        subtotal: Math.round(subtotal * 100) / 100,
        vat_amount: Math.round(totalVat * 100) / 100,
        total_gross: Math.round((subtotal + totalVat) * 100) / 100,
        discount_amount: 0,
        currency: 'CHF',
        payment_terms: 30,
        notes: notes || null,
        created_by: req.user?.userId,
        signature_data: signature_data || null,
        accepted_date: signature_data ? new Date().toISOString().split('T')[0] : null,
        source: 'FIELD',
        job_id: job_id || null,
      }])
      .select()
      .single();

    if (qError) throw qError;

    // Insert items
    if (lineItems.length > 0 && quotation) {
      const itemRows = lineItems.map((it: any, idx: number) => ({
        quotation_id: quotation.id,
        sort_order: idx + 1,
        description: it.description || '',
        detail: it.detail || null,
        quantity: parseFloat(it.quantity) || 1,
        unit: it.unit || 'Std',
        unit_price: parseFloat(it.unit_price) || 0,
        discount_percent: parseFloat(it.discount_percent) || 0,
        vat_rate: parseFloat(it.vat_rate) || 8.1,
        total: Math.round(
          (parseFloat(it.quantity) || 1) *
          (parseFloat(it.unit_price) || 0) *
          (1 - (parseFloat(it.discount_percent) || 0) / 100) * 100
        ) / 100,
        task_id: it.task_id || null,
      }));

      const { error: iError } = await supabase.from('quotation_items').insert(itemRows);
      if (iError) throw iError;
    }

    res.status(201).json({ data: quotation });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/quotations/consumables — sellable consumable parts for quotation line picker
quotationsRouter.get('/consumables', async (req, res, next) => {
  try {
    const { search, category } = req.query;

    let query = supabase
      .from('spare_parts')
      .select('id, part_number, name, category, unit, unit_price, selling_price, stock_qty, is_sellable, is_active')
      .eq('part_type', 'CONSUMABLE')
      .eq('is_sellable', true)
      .eq('is_active', true);

    if (category && typeof category === 'string') {
      query = query.eq('category', category);
    }
    if (search && typeof search === 'string' && search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.or(`name.ilike.${s},part_number.ilike.${s}`);
    }

    const { data, error } = await query.order('name').limit(200);
    if (error) throw error;

    res.json({ data: data || [] });
  } catch (err) {
    next(err);
  }
});
