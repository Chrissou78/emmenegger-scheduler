import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { authRouter } from './api/auth.routes';
import { passwordResetRouter } from './api/password-reset.routes';
import { usersRouter } from './api/users.routes';
import { tasksRouter } from './api/tasks.routes';
import { allocationsRouter } from './api/allocations.routes';
import { absencesRouter } from './api/absences.routes';
import { machinesRouter } from './api/machines.routes';
import { weeksRouter } from './api/weeks.routes';
import { reportsRouter } from './api/reports.routes';
import { customersRouter } from './api/customers.routes';
import { contactsRouter } from './api/contacts.routes';
import { quotationsRouter } from './api/quotations.routes';
import { invoicesRouter } from './api/invoices.routes';
import { statsRouter } from './api/stats.routes';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { settingsRouter } from './api/settings.routes';
import { crmRouter } from './api/crm.routes';
import { logisticsRouter } from './api/logistics.routes';
import { jobsRouter } from './api/jobs.routes';
import { supabase } from './lib/supabase';

const app = express();

// ─── MIDDLEWARE ───
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(morgan('short'));
app.use(express.json({ limit: '10mb' }));

// ─── HEALTH CHECK (Public) ───
app.get('/api/health', async (_req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// ─── PUBLIC ROUTES ───
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/password-reset', passwordResetRouter);

// ─── PROTECTED ROUTES ───
app.use('/api/v1/users', authMiddleware, usersRouter);
app.use('/api/v1/tasks', authMiddleware, tasksRouter);
app.use('/api/v1/allocations', authMiddleware, allocationsRouter);
app.use('/api/v1/absences', authMiddleware, absencesRouter);
app.use('/api/v1/machines', authMiddleware, machinesRouter);
app.use('/api/v1/weeks', authMiddleware, weeksRouter);
app.use('/api/v1/reports', authMiddleware, reportsRouter);
app.use('/api/v1/customers', authMiddleware, customersRouter);
app.use('/api/v1/contacts', authMiddleware, contactsRouter);
app.use('/api/v1/quotations', authMiddleware, quotationsRouter);
app.use('/api/v1/invoices', authMiddleware, invoicesRouter);
app.use('/api/v1/stats', authMiddleware, statsRouter);
app.use('/api/v1/settings', authMiddleware, settingsRouter);
app.use('/api/v1/crm', authMiddleware, crmRouter);
app.use('/api/v1/logistics', authMiddleware, logisticsRouter);
app.use('/api/v1/jobs', authMiddleware, jobsRouter);

// ─── ERROR HANDLER ───
app.use(errorHandler);

export default app;
