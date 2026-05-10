import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireRole } from '../middleware/auth';

export const crmRouter = Router();

/* ================================================================== */
/*  DASHBOARD                                                          */
/* ================================================================== */

crmRouter.get('/dashboard', async (req: any, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const userId = req.user.id;
    const role = (req.user.role || '').toUpperCase();
    const isSales = role === 'SALES';

    // My customers count
    let customerQuery = supabase.from('customers').select('id', { count: 'exact', head: true });
    if (isSales) customerQuery = customerQuery.eq('sales_id', userId);
    const { count: customerCount } = await customerQuery;

    // Open opportunities — wrap in try/catch in case table doesn't exist
    let openOpps: any[] = [];
    try {
      let oppQuery = supabase
        .from('crm_opportunities')
        .select('*')
        .not('stage', 'in', '(WON,LOST)');
      if (isSales) oppQuery = oppQuery.eq('sales_id', userId);
      const { data } = await oppQuery;
      openOpps = data || [];
    } catch { /* table may not exist yet */ }

    const pipelineValue = openOpps.reduce((sum, o) => sum + Number(o.estimated_value || 0), 0);
    const weightedValue = openOpps.reduce(
      (sum, o) => sum + Number(o.estimated_value || 0) * (Number(o.probability || 0) / 100), 0
    );

    // Upcoming follow-ups (next 7 days)
    let followUps: any[] = [];
    try {
      const now = new Date();
      const in7 = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
      const todayStr = now.toISOString().slice(0, 10);

      let fuQuery = supabase
        .from('crm_activities')
        .select('*, customers(name)')
        .eq('is_completed', false)
        .not('next_action_date', 'is', null)
        .lte('next_action_date', in7)
        .gte('next_action_date', todayStr)
        .order('next_action_date');
      if (isSales) fuQuery = fuQuery.eq('user_id', userId);
      const { data } = await fuQuery;
      followUps = data || [];
    } catch { /* table may not exist yet */ }

    // Won this month
    let wonValue = 0;
    try {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      let wonQuery = supabase
        .from('crm_opportunities')
        .select('estimated_value')
        .eq('stage', 'WON')
        .gte('actual_close_date', monthStart);
      if (isSales) wonQuery = wonQuery.eq('sales_id', userId);
      const { data } = await wonQuery;
      wonValue = (data || []).reduce((s, o) => s + Number(o.estimated_value || 0), 0);
    } catch { /* */ }

    res.json({
      customerCount: customerCount || 0,
      openOpportunities: openOpps.length,
      pipelineValue,
      weightedValue,
      wonThisMonth: wonValue,
      upcomingFollowUps: followUps,
    });
  } catch (err: any) {
    console.error('GET /crm/dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ================================================================== */
/*  CUSTOMERS                                                          */
/* ================================================================== */

crmRouter.get('/customers', async (req: any, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const userId = req.user.id;
    const role = (req.user.role || '').toUpperCase();
    const { search, sort, order } = req.query;

    // Simple query first — avoid foreign key joins that may not exist yet
    let query = supabase.from('customers').select('*');

    // Sales sees only their customers
    if (role === 'SALES') {
      query = query.eq('sales_id', userId);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%`);
    }

    query = query.order(sort as string || 'name', { ascending: order !== 'desc' });

    const { data, error } = await query;
    if (error) throw error;

    // Enrich with sales/TL names if columns exist
    const userIds = new Set<string>();
    (data || []).forEach((c: any) => {
      if (c.sales_id) userIds.add(c.sales_id);
      if (c.team_leader_id) userIds.add(c.team_leader_id);
    });

    let userMap: Record<string, any> = {};
    if (userIds.size > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', [...userIds]);
      (users || []).forEach(u => { userMap[u.id] = u; });
    }

    const enriched = (data || []).map((c: any) => ({
      ...c,
      sales: c.sales_id ? userMap[c.sales_id] || null : null,
      team_leader: c.team_leader_id ? userMap[c.team_leader_id] || null : null,
    }));

    res.json({ data: enriched });
  } catch (err: any) {
    console.error('GET /crm/customers error:', err);
    res.status(500).json({ error: err.message });
  }
});

crmRouter.put('/customers/:id/assign', async (req: any, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { id } = req.params;
    const { sales_id, team_leader_id } = req.body;

    const updates: any = {};
    if (sales_id !== undefined) updates.sales_id = sales_id || null;
    if (team_leader_id !== undefined) updates.team_leader_id = team_leader_id || null;

    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err: any) {
    console.error('PUT /crm/customers/:id/assign error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ================================================================== */
/*  ACTIVITIES                                                         */
/* ================================================================== */

crmRouter.get('/activities', async (req: any, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const userId = req.user.id;
    const role = (req.user.role || '').toUpperCase();
    const { customer_id, type, limit: lim } = req.query;

    let query = supabase
      .from('crm_activities')
      .select('*, customers(id, name)')
      .order('activity_date', { ascending: false });

    if (role === 'SALES') query = query.eq('user_id', userId);
    if (customer_id) query = query.eq('customer_id', customer_id);
    if (type) query = query.eq('type', type);
    if (lim) query = query.limit(Number(lim));

    const { data, error } = await query;

    if (error) {
      // Table may not exist — return empty
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return res.json({ data: [] });
      }
      throw error;
    }

    res.json({ data: data || [] });
  } catch (err: any) {
    console.error('GET /crm/activities error:', err);
    res.status(500).json({ error: err.message });
  }
});

crmRouter.post('/activities', async (req: any, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const userId = req.user.id;
    const {
      customer_id, type, subject, description,
      activity_date, duration_minutes, outcome,
      next_action, next_action_date,
    } = req.body;

    if (!customer_id || !type || !subject) {
      return res.status(400).json({ error: 'customer_id, type, and subject are required' });
    }

    const { data, error } = await supabase
      .from('crm_activities')
      .insert({
        customer_id,
        user_id: userId,
        type,
        subject,
        description: description || null,
        activity_date: activity_date || new Date().toISOString(),
        duration_minutes: duration_minutes || null,
        outcome: outcome || null,
        next_action: next_action || null,
        next_action_date: next_action_date || null,
        is_completed: false,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err: any) {
    console.error('POST /crm/activities error:', err);
    res.status(500).json({ error: err.message });
  }
});

crmRouter.put('/activities/:id', async (req: any, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { id } = req.params;
    const updates: any = { updated_at: new Date().toISOString() };

    const fields = [
      'subject', 'description', 'type', 'activity_date',
      'duration_minutes', 'outcome', 'next_action', 'next_action_date', 'is_completed',
    ];
    fields.forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const { data, error } = await supabase
      .from('crm_activities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err: any) {
    console.error('PUT /crm/activities/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

crmRouter.delete('/activities/:id', async (req: any, res) => {
  try {
    const { error } = await supabase
      .from('crm_activities')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================================================== */
/*  OPPORTUNITIES                                                      */
/* ================================================================== */

crmRouter.get('/opportunities', async (req: any, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const userId = req.user.id;
    const role = (req.user.role || '').toUpperCase();
    const { customer_id, stage } = req.query;

    let query = supabase
      .from('crm_opportunities')
      .select('*, customers(id, name)')
      .order('created_at', { ascending: false });

    if (role === 'SALES') query = query.eq('sales_id', userId);
    if (customer_id) query = query.eq('customer_id', customer_id);
    if (stage) query = query.eq('stage', stage);

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return res.json({ data: [] });
      }
      throw error;
    }

    res.json({ data: data || [] });
  } catch (err: any) {
    console.error('GET /crm/opportunities error:', err);
    res.status(500).json({ error: err.message });
  }
});

crmRouter.post('/opportunities', async (req: any, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const userId = req.user.id;
    const {
      customer_id, title, description, stage,
      estimated_value, probability, expected_close_date,
    } = req.body;

    if (!customer_id || !title) {
      return res.status(400).json({ error: 'customer_id and title are required' });
    }

    const { data, error } = await supabase
      .from('crm_opportunities')
      .insert({
        customer_id,
        sales_id: userId,
        title,
        description: description || null,
        stage: stage || 'LEAD',
        estimated_value: estimated_value || 0,
        probability: probability || 0,
        expected_close_date: expected_close_date || null,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err: any) {
    console.error('POST /crm/opportunities error:', err);
    res.status(500).json({ error: err.message });
  }
});

crmRouter.put('/opportunities/:id', async (req: any, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { id } = req.params;
    const updates: any = { updated_at: new Date().toISOString() };

    const fields = [
      'title', 'description', 'stage', 'estimated_value',
      'probability', 'expected_close_date', 'actual_close_date', 'lost_reason',
    ];
    fields.forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    if (updates.stage === 'WON' || updates.stage === 'LOST') {
      updates.actual_close_date = updates.actual_close_date || new Date().toISOString().slice(0, 10);
    }

    const { data, error } = await supabase
      .from('crm_opportunities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err: any) {
    console.error('PUT /crm/opportunities/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

crmRouter.delete('/opportunities/:id', async (req: any, res) => {
  try {
    const { error } = await supabase
      .from('crm_opportunities')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================================================== */
/*  PERFORMANCE                                                        */
/* ================================================================== */

crmRouter.get('/performance/:customerId', async (req: any, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { customerId } = req.params;
    const { months } = req.query;

    const monthsBack = Number(months) || 12;
    const from = new Date();
    from.setMonth(from.getMonth() - monthsBack);
    const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-01`;

    let performance: any[] = [];
    try {
      const { data } = await supabase
        .from('crm_customer_performance')
        .select('*')
        .eq('customer_id', customerId)
        .gte('period_month', fromStr)
        .order('period_month', { ascending: true });
      performance = data || [];
    } catch { /* table may not exist */ }

    let oppSummary = { total: 0, won: 0, lost: 0, open: 0, totalValue: 0, wonValue: 0 };
    try {
      const { data: opps } = await supabase
        .from('crm_opportunities')
        .select('stage, estimated_value')
        .eq('customer_id', customerId);
      const list = opps || [];
      oppSummary = {
        total: list.length,
        won: list.filter(o => o.stage === 'WON').length,
        lost: list.filter(o => o.stage === 'LOST').length,
        open: list.filter(o => !['WON', 'LOST'].includes(o.stage)).length,
        totalValue: list.reduce((s, o) => s + Number(o.estimated_value || 0), 0),
        wonValue: list.filter(o => o.stage === 'WON').reduce((s, o) => s + Number(o.estimated_value || 0), 0),
      };
    } catch { /* */ }

    res.json({ performance, opportunities: oppSummary });
  } catch (err: any) {
    console.error('GET /crm/performance/:customerId error:', err);
    res.status(500).json({ error: err.message });
  }
});
