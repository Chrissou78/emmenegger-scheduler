// backend/src/api/logistics.routes.ts
import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';

export const logisticsRouter = Router();

/* ================================================================== */
/*  SPARE PARTS — CRUD                                                 */
/* ================================================================== */

// GET /api/v1/logistics/parts
logisticsRouter.get('/parts', async (req, res, next) => {
  try {
    const { category, active, machine_id, search, low_stock } = req.query;

    let query = supabase
      .from('spare_parts')
      .select('*, machine:machines(id, name, inventory_nr)');

    if (category)   query = query.eq('category', category);
    if (machine_id)  query = query.eq('machine_id', machine_id);
    if (active !== undefined) query = query.eq('is_active', active === 'true');
    if (search) {
      const s = `%${search}%`;
      query = query.or(`name.ilike.${s},part_number.ilike.${s},description.ilike.${s},location.ilike.${s}`);
    }

    // No DB-level low_stock filter — done client-side below
    // because PostgREST can't compare column-to-column (stock_qty <= min_qty)

    const { data, error } = await query.order('category').order('name');
    if (error) throw error;

    let result = data || [];

    if (low_stock === 'true') {
      result = result.filter((p: any) => p.stock_qty <= p.min_qty);
    }

    res.json({ data: result });
  } catch (err) { next(err); }
});

// GET /api/v1/logistics/parts/:id
logisticsRouter.get('/parts/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('spare_parts')
      .select('*, machine:machines(id, name, inventory_nr)')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Part not found' });

    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/v1/logistics/parts
logisticsRouter.post('/parts', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const {
      part_number, name, description, category, unit,
      stock_qty, min_qty, reorder_qty, location, supplier,
      supplier_ref, unit_price, machine_id, qr_code,
      image_url, auto_reorder, notes,
    } = req.body;

    if (!part_number || !name) {
      return res.status(400).json({ error: 'part_number and name are required' });
    }

    const { data, error } = await supabase
      .from('spare_parts')
      .insert({
        part_number, name, description,
        category: category || 'GENERAL',
        unit: unit || 'pcs',
        stock_qty: stock_qty ?? 0,
        min_qty: min_qty ?? 0,
        reorder_qty: reorder_qty ?? 0,
        location, supplier, supplier_ref,
        unit_price: unit_price ?? 0,
        machine_id: machine_id || null,
        qr_code: qr_code || null,
        image_url: image_url || null,
        auto_reorder: auto_reorder ?? false,
        notes,
        is_active: true,
      })
      .select('*, machine:machines(id, name, inventory_nr)')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A part with this number already exists' });
      }
      throw error;
    }

    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// PUT /api/v1/logistics/parts/:id
logisticsRouter.put('/parts/:id', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const updates: any = { updated_at: new Date().toISOString() };
    const allowed = [
      'part_number', 'name', 'description', 'category', 'unit',
      'min_qty', 'reorder_qty', 'location', 'supplier', 'supplier_ref',
      'unit_price', 'machine_id', 'qr_code', 'image_url',
      'auto_reorder', 'is_active', 'notes',
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const { data, error } = await supabase
      .from('spare_parts')
      .update(updates)
      .eq('id', req.params.id)
      .select('*, machine:machines(id, name, inventory_nr)')
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (err) { next(err); }
});

// DELETE /api/v1/logistics/parts/:id
logisticsRouter.delete('/parts/:id', requireRole('GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('spare_parts')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ data: { deleted: true } });
  } catch (err) { next(err); }
});

/* ================================================================== */
/*  STOCK TRANSACTIONS                                                 */
/* ================================================================== */

// GET /api/v1/logistics/transactions
logisticsRouter.get('/transactions', async (req, res, next) => {
  try {
    const { part_id, type, machine_id, from, to, limit: lim } = req.query;

    let query = supabase
      .from('spare_part_transactions')
      .select(`
        *,
        part:spare_parts(id, part_number, name),
        machine:machines(id, name),
        task:tasks(id, code, name),
        user:users(id, first_name, last_name)
      `);

    if (part_id)    query = query.eq('part_id', part_id);
    if (type)       query = query.eq('type', type);
    if (machine_id) query = query.eq('machine_id', machine_id);
    if (from)       query = query.gte('created_at', from);
    if (to)         query = query.lte('created_at', to);

    const pageLimit = Math.min(parseInt(lim as string) || 200, 1000);
    query = query.order('created_at', { ascending: false }).limit(pageLimit);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ data: data || [] });
  } catch (err) { next(err); }
});

// POST /api/v1/logistics/transactions — record a stock movement
logisticsRouter.post('/transactions', async (req, res, next) => {
  try {
    const { part_id, type, qty, unit_price, reference, machine_id, task_id, notes } = req.body;

    if (!part_id || !type || qty === undefined) {
      return res.status(400).json({ error: 'part_id, type, and qty are required' });
    }

    const validTypes = ['CONSUME', 'PURCHASE', 'ADJUST', 'RETURN'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    }

    // For CONSUME, qty in body is positive but we store as negative
    const signedQty = type === 'CONSUME' ? -Math.abs(qty) : Math.abs(qty);

    // Check sufficient stock for consumption
    if (type === 'CONSUME') {
      const { data: part } = await supabase
        .from('spare_parts')
        .select('stock_qty, name')
        .eq('id', part_id)
        .single();

      if (part && part.stock_qty + signedQty < 0) {
        return res.status(409).json({
          error: `Insufficient stock for "${part.name}". Available: ${part.stock_qty}`,
        });
      }
    }

    // If PURCHASE, update the unit_price on the part
    if (type === 'PURCHASE' && unit_price !== undefined) {
      await supabase
        .from('spare_parts')
        .update({ unit_price, updated_at: new Date().toISOString() })
        .eq('id', part_id);
    }

    const { data, error } = await supabase
      .from('spare_part_transactions')
      .insert({
        part_id,
        type,
        qty: signedQty,
        unit_price: unit_price || null,
        reference: reference || null,
        machine_id: machine_id || null,
        task_id: task_id || null,
        user_id: (req as any).user!.userId,
        notes: notes || null,
      })
      .select(`
        *,
        part:spare_parts(id, part_number, name),
        machine:machines(id, name),
        task:tasks(id, code, name),
        user:users(id, first_name, last_name)
      `)
      .single();

    if (error) throw error;

    res.status(201).json({ data });
  } catch (err) { next(err); }
});

/* ================================================================== */
/*  ALERTS                                                             */
/* ================================================================== */

// GET /api/v1/logistics/alerts
logisticsRouter.get('/alerts', async (req, res, next) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('spare_part_alerts')
      .select(`
        *,
        part:spare_parts(id, part_number, name, stock_qty, min_qty, reorder_qty, supplier, auto_reorder)
      `);

    if (status) query = query.eq('status', status);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    res.json({ data: data || [] });
  } catch (err) { next(err); }
});

// PUT /api/v1/logistics/alerts/:id — acknowledge or resolve
logisticsRouter.put('/alerts/:id', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['ACKNOWLEDGED', 'RESOLVED'].includes(status)) {
      return res.status(400).json({ error: 'status must be ACKNOWLEDGED or RESOLVED' });
    }

    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === 'RESOLVED') {
      updates.resolved_by = (req as any).user!.userId;
      updates.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('spare_part_alerts')
      .update(updates)
      .eq('id', req.params.id)
      .select(`
        *,
        part:spare_parts(id, part_number, name, stock_qty, min_qty, reorder_qty, supplier, auto_reorder)
      `)
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (err) { next(err); }
});

/* ================================================================== */
/*  QR CODE LOOKUP                                                     */
/* ================================================================== */

// GET /api/v1/logistics/qr/:code
logisticsRouter.get('/qr/:code', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('spare_parts')
      .select('*, machine:machines(id, name, inventory_nr)')
      .eq('qr_code', req.params.code)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return res.status(404).json({ error: 'No part found for this QR code' });

    res.json({ data });
  } catch (err) { next(err); }
});

/* ================================================================== */
/*  DASHBOARD STATS                                                    */
/* ================================================================== */

// GET /api/v1/logistics/stats
logisticsRouter.get('/stats', async (_req, res, next) => {
  try {
    const { data: parts } = await supabase
      .from('spare_parts')
      .select('id, stock_qty, min_qty, unit_price, is_active')
      .eq('is_active', true);

    const { data: alerts } = await supabase
      .from('spare_part_alerts')
      .select('id, alert_type')
      .eq('status', 'OPEN');

    const { data: recentTx } = await supabase
      .from('spare_part_transactions')
      .select('id, type, qty, unit_price')
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());

    const allParts = parts || [];
    const totalParts = allParts.length;
    const lowStock = allParts.filter(p => p.stock_qty > 0 && p.stock_qty <= p.min_qty).length;
    const outOfStock = allParts.filter(p => p.stock_qty <= 0).length;
    const totalValue = allParts.reduce((s, p) => s + (p.stock_qty * p.unit_price), 0);
    const openAlerts = (alerts || []).length;

    const tx = recentTx || [];
    const consumed30d = tx.filter(t => t.type === 'CONSUME').reduce((s, t) => s + Math.abs(t.qty), 0);
    const purchased30d = tx.filter(t => t.type === 'PURCHASE').reduce((s, t) => s + Math.abs(t.qty), 0);
    const spentValue30d = tx
      .filter(t => t.type === 'PURCHASE' && t.unit_price)
      .reduce((s, t) => s + Math.abs(t.qty) * (t.unit_price || 0), 0);

    res.json({
      totalParts,
      lowStock,
      outOfStock,
      totalValue: Math.round(totalValue * 100) / 100,
      openAlerts,
      consumed30d,
      purchased30d,
      spentValue30d: Math.round(spentValue30d * 100) / 100,
    });
  } catch (err) { next(err); }
});

/* ================================================================== */
/*  CSV IMPORT / UPSERT                                                */
/* ================================================================== */

// POST /api/v1/logistics/parts/import
logisticsRouter.post('/parts/import', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { rows } = req.body; // array of part objects

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'rows array is required' });
    }

    const toUpsert = rows.map((r: any) => ({
      part_number: r.part_number,
      name: r.name,
      description: r.description || null,
      category: r.category || 'GENERAL',
      unit: r.unit || 'pcs',
      stock_qty: parseFloat(r.stock_qty) || 0,
      min_qty: parseFloat(r.min_qty) || 0,
      reorder_qty: parseFloat(r.reorder_qty) || 0,
      location: r.location || null,
      supplier: r.supplier || null,
      supplier_ref: r.supplier_ref || null,
      unit_price: parseFloat(r.unit_price) || 0,
      qr_code: r.qr_code || null,
      auto_reorder: r.auto_reorder === 'true' || r.auto_reorder === true,
      notes: r.notes || null,
      is_active: true,
    }));

    const { data, error } = await supabase
      .from('spare_parts')
      .upsert(toUpsert, { onConflict: 'part_number' })
      .select();

    if (error) throw error;

    res.json({ imported: (data || []).length });
  } catch (err) { next(err); }
});
