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
    // Check if system role
    const { data: role } = await supabase
      .from('roles')
      .select('is_system, name')
      .eq('id', req.params.id)
      .single();

    if (role?.is_system) {
      return res.status(403).json({ error: 'Cannot delete system roles' });
    }

    // Check if any users still have this role
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

// GET /api/v1/settings/languages
settingsRouter.get('/languages', async (_req, res) => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('key', 'language_config')
    .single();

  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ error: error.message });
  }

  // Return defaults if no setting exists yet
  const config = data?.value ?? {
    enabled_languages: ['de', 'en', 'fr', 'pt'],
    default_language: 'de',
  };

  res.json(config);
});

// PUT /api/v1/settings/languages
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
