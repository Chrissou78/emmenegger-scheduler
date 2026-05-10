import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';

export const settingsRouter = Router();

// ─── GET /roles — returns RoleDefinition[] ───
settingsRouter.get('/roles', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('sort_order');

    if (error) throw error;

    res.json({ data: data || [] });
  } catch (err: any) {
    console.error('GET /settings/roles error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /roles/:id ───
settingsRouter.get('/roles/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Role not found' });

    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /roles — create a new role (GLOBAL_MANAGER only) ───
settingsRouter.post('/roles', requireRole('GLOBAL_MANAGER'), async (req: any, res) => {
  try {
    const { name, label_de, label_en, label_fr, label_pt, permissions, sort_order } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    const { data, error } = await supabase
      .from('roles')
      .insert({
        name: name.toUpperCase().replace(/\s+/g, '_'),
        label_de: label_de || name,
        label_en: label_en || name,
        label_fr: label_fr || name,
        label_pt: label_pt || name,
        permissions: permissions || [],
        is_system: false,
        is_active: true,
        sort_order: sort_order ?? 99,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data });
  } catch (err: any) {
    console.error('POST /settings/roles error:', err);
    if (err.message?.includes('duplicate key')) {
      return res.status(409).json({ error: 'A role with this name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /roles/:id — update a role (GLOBAL_MANAGER only) ───
settingsRouter.put('/roles/:id', requireRole('GLOBAL_MANAGER'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { label_de, label_en, label_fr, label_pt, permissions, is_active, sort_order } = req.body;

    const updates: any = { updated_at: new Date().toISOString() };
    if (label_de !== undefined) updates.label_de = label_de;
    if (label_en !== undefined) updates.label_en = label_en;
    if (label_fr !== undefined) updates.label_fr = label_fr;
    if (label_pt !== undefined) updates.label_pt = label_pt;
    if (permissions !== undefined) updates.permissions = permissions;
    if (is_active !== undefined) updates.is_active = is_active;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    const { data, error } = await supabase
      .from('roles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (err: any) {
    console.error('PUT /settings/roles/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /roles/:id — only non-system roles (GLOBAL_MANAGER only) ───
settingsRouter.delete('/roles/:id', requireRole('GLOBAL_MANAGER'), async (req: any, res) => {
  try {
    const { data: role } = await supabase
      .from('roles')
      .select('is_system, name')
      .eq('id', req.params.id)
      .single();

    if (role?.is_system) {
      return res.status(403).json({ error: 'Cannot delete system roles' });
    }

    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('role', role?.name)
      .limit(1);

    if (users && users.length > 0) {
      return res.status(409).json({
        error: 'Cannot delete role — users are still assigned to it',
      });
    }

    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ message: 'Role deleted' });
  } catch (err: any) {
    console.error('DELETE /settings/roles/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/*  Language Settings                                                   */
/* ------------------------------------------------------------------ */

settingsRouter.get('/languages', async (_req, res) => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('key', 'language_config')
    .single();

  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ error: error.message });
  }

  const config = data?.value ?? {
    enabled_languages: ['de', 'en', 'fr', 'pt'],
    default_language: 'de',
  };

  res.json(config);
});

settingsRouter.put('/languages', async (req, res) => {
  const { enabled_languages, default_language } = req.body;

  if (!Array.isArray(enabled_languages) || enabled_languages.length === 0) {
    return res.status(400).json({ error: 'At least one language must be enabled' });
  }

  if (!enabled_languages.includes(default_language)) {
    return res.status(400).json({ error: 'Default language must be in enabled list' });
  }

  const value = { enabled_languages, default_language };

  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { key: 'language_config', value },
      { onConflict: 'key' }
    );

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true, ...value });
});

/* ------------------------------------------------------------------ */
/*  VAT Rates                                                          */
/* ------------------------------------------------------------------ */

settingsRouter.get('/vat-rates', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('vat_rates')
      .select('*')
      .order('rate', { ascending: true });

    if (error) {
      // Table may not exist yet — return Swiss defaults
      return res.json([
        { id: 1, label: 'Normal', rate: 8.1 },
        { id: 2, label: 'Reduziert', rate: 2.6 },
        { id: 3, label: 'Sonder', rate: 3.8 },
      ]);
    }

    res.json(data || []);
  } catch (err: any) {
    console.error('GET /settings/vat-rates error:', err);
    res.status(500).json({ error: err.message });
  }
});

settingsRouter.put('/vat-rates', requireRole('GLOBAL_MANAGER'), async (req: any, res) => {
  try {
    const rates = req.body; // array of { id?, label, rate }

    if (!Array.isArray(rates)) {
      return res.status(400).json({ error: 'Body must be an array of VAT rates' });
    }

    const { data, error } = await supabase
      .from('vat_rates')
      .upsert(rates, { onConflict: 'id' })
      .select();

    if (error) throw error;

    res.json(data);
  } catch (err: any) {
    console.error('PUT /settings/vat-rates error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/*  Company Settings                                                    */
/* ------------------------------------------------------------------ */

settingsRouter.get('/company', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .single();

    if (error || !data) {
      // Return sensible defaults
      return res.json({
        name: 'Emmenegger AG',
        address: '',
        zip: '',
        city: '',
        country: 'CH',
        phone: '',
        email: '',
        website: '',
        uid: '',
        iban: '',
        bic: '',
        logo_url: '',
      });
    }

    res.json(data);
  } catch (err: any) {
    console.error('GET /settings/company error:', err);
    res.status(500).json({ error: err.message });
  }
});

settingsRouter.put('/company', requireRole('GLOBAL_MANAGER'), async (req: any, res) => {
  try {
    const settings = req.body;

    const { data, error } = await supabase
      .from('company_settings')
      .upsert(
        { id: 1, ...settings, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err: any) {
    console.error('PUT /settings/company error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/*  Cross-Border Settings                                               */
/* ------------------------------------------------------------------ */

settingsRouter.get('/cross-border', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('cross_border_settings')
      .select('*')
      .single();

    if (error || !data) {
      return res.json({
        enabled: false,
        default_country: 'CH',
        countries: ['CH', 'DE', 'FR', 'IT', 'AT'],
        tax_rules: [],
      });
    }

    res.json(data);
  } catch (err: any) {
    console.error('GET /settings/cross-border error:', err);
    res.status(500).json({ error: err.message });
  }
});

settingsRouter.put('/cross-border', requireRole('GLOBAL_MANAGER'), async (req: any, res) => {
  try {
    const settings = req.body;

    const { data, error } = await supabase
      .from('cross_border_settings')
      .upsert(
        { id: 1, ...settings, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err: any) {
    console.error('PUT /settings/cross-border error:', err);
    res.status(500).json({ error: err.message });
  }
});

settingsRouter.get('/config/:category', async (req, res) => {
  try {
    const { category } = req.params;
    
    const validCategories = [
      'contract_types', 'salary_types', 'schedule_types',
      'absence_types', 'absence_codes',
      'machine_categories', 'machine_operators',
    ];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: `Invalid category: ${category}` });
    }

    const { data, error } = await supabase
      .from('config_items')
      .select('*')
      .eq('category', category)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    res.json({ data: data || [] });
  } catch (err: any) {
    console.error(`GET /settings/config/${req.params.category} error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/settings/config/:category — create a new item
settingsRouter.post('/config/:category', requireRole('GLOBAL_MANAGER'), async (req: any, res) => {
  try {
    const { category } = req.params;
    const { key, label, sort_order, meta } = req.body;

    if (!key || !label) {
      return res.status(400).json({ error: 'Key and label are required' });
    }

    const { data, error } = await supabase
      .from('config_items')
      .insert({
        category,
        key: key.toUpperCase().replace(/\s+/g, '_'),
        label,
        sort_order: sort_order ?? 0,
        meta: meta ?? {},
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.message?.includes('duplicate key') || error.code === '23505') {
        return res.status(409).json({ error: 'An item with this key already exists in this category' });
      }
      throw error;
    }

    res.status(201).json({ data });
  } catch (err: any) {
    console.error(`POST /settings/config/${req.params.category} error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/settings/config/:category/:id — update an item
settingsRouter.put('/config/:category/:id', requireRole('GLOBAL_MANAGER'), async (req: any, res) => {
  try {
    const { category, id } = req.params;
    const { key, label, sort_order, meta, is_active } = req.body;

    const updates: any = { updated_at: new Date().toISOString() };
    if (key !== undefined) updates.key = key.toUpperCase().replace(/\s+/g, '_');
    if (label !== undefined) updates.label = label;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (meta !== undefined) updates.meta = meta;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from('config_items')
      .update(updates)
      .eq('id', id)
      .eq('category', category)
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (err: any) {
    console.error(`PUT /settings/config/${req.params.category}/${req.params.id} error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/settings/config/:category/:id
settingsRouter.delete('/config/:category/:id', requireRole('GLOBAL_MANAGER'), async (req: any, res) => {
  try {
    const { category, id } = req.params;

    const { error } = await supabase
      .from('config_items')
      .delete()
      .eq('id', id)
      .eq('category', category);

    if (error) throw error;

    res.json({ message: 'Deleted' });
  } catch (err: any) {
    console.error(`DELETE /settings/config/${req.params.category}/${req.params.id} error:`, err);
    res.status(500).json({ error: err.message });
  }
});
