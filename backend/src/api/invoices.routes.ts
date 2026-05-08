import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';

export const invoicesRouter = Router();

// GET /api/v1/invoices
invoicesRouter.get('/', async (req, res, next) => {
  try {
    const { customer_id, status, search, limit, offset } = req.query;

    let query = supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(id, name, city),
        contact:contacts(id, first_name, last_name)
      `, { count: 'exact' });

    if (customer_id) query = query.eq('customer_id', customer_id);
    if (status && typeof status === 'string') query = query.eq('status', status.toUpperCase());
    if (search && typeof search === 'string' && search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.or(`invoice_number.ilike.${s},title.ilike.${s}`);
    }

    const lim = Math.min(parseInt(String(limit)) || 50, 200);
    const off = parseInt(String(offset)) || 0;

    const { data, error, count } = await query
      .order('invoice_date', { ascending: false })
      .range(off, off + lim - 1);

    if (error) throw error;
    res.json({ data: data || [], meta: { total: count || 0, limit: lim, offset: off } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/invoices/:id
invoicesRouter.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(id, name, company_name, street, postal_code, city, canton, email, phone, vat_number),
        contact:contacts(id, first_name, last_name, email, phone),
        items:invoice_items(*),
        payments:payments(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Invoice not found' });

    if (data.items) data.items.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
    if (data.payments) data.payments.sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/invoices
invoicesRouter.post('/', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const {
      customer_id, contact_id, title, description, notes,
      currency, payment_terms, items, qr_iban, qr_reference,
    } = req.body;

    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });

    const { data: invNum } = await supabase.rpc('next_invoice_number');
    const invoice_number = invNum || `RE-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

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
      return sum + ((qty * price * (1 - disc / 100)) * vatRate / 100);
    }, 0);

    const { data: invoice, error: iErr } = await supabase
      .from('invoices')
      .insert([{
        invoice_number,
        customer_id,
        contact_id: contact_id || null,
        title: title || `Rechnung ${invoice_number}`,
        description,
        status: 'DRAFT',
        invoice_date: new Date().toISOString().split('T')[0],
        subtotal: Math.round(subtotal * 100) / 100,
        vat_amount: Math.round(totalVat * 100) / 100,
        total_gross: Math.round((subtotal + totalVat) * 100) / 100,
        discount_amount: 0,
        amount_paid: 0,
        amount_due: Math.round((subtotal + totalVat) * 100) / 100,
        currency: currency || 'CHF',
        payment_terms: payment_terms || 30,
        qr_iban: qr_iban || null,
        qr_reference: qr_reference || null,
        notes,
        created_by: req.user?.userId,
      }])
      .select()
      .single();

    if (iErr) throw iErr;

    if (lineItems.length > 0 && invoice) {
      const itemRows = lineItems.map((it: any, idx: number) => ({
        invoice_id: invoice.id,
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

      await supabase.from('invoice_items').insert(itemRows);
    }

    res.status(201).json({ data: invoice });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/invoices/:id
invoicesRouter.put('/:id', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const {
      customer_id, contact_id, title, description, status,
      notes, currency, payment_terms, items, discount_amount,
      qr_iban, qr_reference,
    } = req.body;

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };

    if (customer_id !== undefined) updateData.customer_id = customer_id;
    if (contact_id !== undefined) updateData.contact_id = contact_id;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (notes !== undefined) updateData.notes = notes;
    if (currency !== undefined) updateData.currency = currency;
    if (payment_terms !== undefined) updateData.payment_terms = payment_terms;
    if (qr_iban !== undefined) updateData.qr_iban = qr_iban;
    if (qr_reference !== undefined) updateData.qr_reference = qr_reference;
    if (discount_amount !== undefined) updateData.discount_amount = discount_amount;

    if (status) {
      updateData.status = status;
      if (status === 'SENT') updateData.sent_date = new Date().toISOString().split('T')[0];
      if (status === 'PAID') updateData.paid_date = new Date().toISOString().split('T')[0];
    }

    // Recalculate if items provided
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
        return sum + ((qty * price * (1 - disc / 100)) * vatRate / 100);
      }, 0);

      const da = parseFloat(discount_amount) || 0;
      updateData.subtotal = Math.round(subtotal * 100) / 100;
      updateData.vat_amount = Math.round(totalVat * 100) / 100;
      updateData.total_gross = Math.round((subtotal + totalVat - da) * 100) / 100;

      // Get current amount_paid to recalculate amount_due
      const { data: current } = await supabase.from('invoices').select('amount_paid').eq('id', req.params.id).single();
      updateData.amount_due = Math.round((updateData.total_gross - (current?.amount_paid || 0)) * 100) / 100;

      // Replace items
      await supabase.from('invoice_items').delete().eq('invoice_id', req.params.id);

      if (items.length > 0) {
        const itemRows = items.map((it: any, idx: number) => ({
          invoice_id: req.params.id,
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

        await supabase.from('invoice_items').insert(itemRows);
      }
    }

    const { data, error } = await supabase
      .from('invoices')
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

// POST /api/v1/invoices/:id/payments — record a payment
invoicesRouter.post('/:id/payments', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { amount, payment_date, method, reference, notes } = req.body;

    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount is required' });

    const { data: payment, error: pErr } = await supabase
      .from('payments')
      .insert([{
        invoice_id: req.params.id,
        amount: parseFloat(amount),
        payment_date: payment_date || new Date().toISOString().split('T')[0],
        method: method || 'BANK_TRANSFER',
        reference,
        notes,
        created_by: req.user?.userId,
      }])
      .select()
      .single();

    if (pErr) throw pErr;

    // Update invoice totals
    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .eq('invoice_id', req.params.id);

    const totalPaid = (payments || []).reduce((s, p) => s + parseFloat(p.amount), 0);

    const { data: invoice } = await supabase
      .from('invoices')
      .select('total_gross')
      .eq('id', req.params.id)
      .single();

    const totalGross = parseFloat(invoice?.total_gross) || 0;
    const amountDue = Math.round((totalGross - totalPaid) * 100) / 100;

    const invoiceUpdate: Record<string, any> = {
      amount_paid: Math.round(totalPaid * 100) / 100,
      amount_due: amountDue,
      updated_at: new Date().toISOString(),
    };

    if (amountDue <= 0) {
      invoiceUpdate.status = 'PAID';
      invoiceUpdate.paid_date = new Date().toISOString().split('T')[0];
    }

    await supabase.from('invoices').update(invoiceUpdate).eq('id', req.params.id);

    res.status(201).json({ data: payment });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/invoices/:id
invoicesRouter.delete('/:id', requireRole('GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    await supabase.from('payments').delete().eq('invoice_id', req.params.id);
    await supabase.from('invoice_items').delete().eq('invoice_id', req.params.id);
    const { error } = await supabase.from('invoices').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
