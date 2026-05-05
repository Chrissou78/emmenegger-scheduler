import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
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
import { statsRouter } from './api/stats.routes';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { supabase } from './lib/supabase';

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true },
});

// ─── MIDDLEWARE ───
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(morgan('short'));
app.use(express.json({ limit: '10mb' }));

// ─── HEALTH CHECK (Public) ───
app.get('/api/health', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

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

// ─── PUBLIC ROUTES (NO AUTH REQUIRED) ───
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/password-reset', passwordResetRouter);

// ─── PROTECTED ROUTES (AUTH REQUIRED) ───
app.use('/api/v1/users', authMiddleware, usersRouter);
app.use('/api/v1/tasks', authMiddleware, tasksRouter);
app.use('/api/v1/allocations', authMiddleware, allocationsRouter);
app.use('/api/v1/absences', authMiddleware, absencesRouter);
app.use('/api/v1/machines', authMiddleware, machinesRouter);
app.use('/api/v1/weeks', authMiddleware, weeksRouter);
app.use('/api/v1/reports', authMiddleware, reportsRouter);
app.use('/api/v1/customers', authMiddleware, customersRouter);
app.use('/api/v1/stats', authMiddleware, statsRouter);

// ─── ERROR HANDLER ───
app.use(errorHandler);

// ─── WEBSOCKET (for live updates) ───
io.on('connection', (socket) => {
  console.log(`📡 Client connected: ${socket.id}`);

  socket.on('join-schedule', (data: { scheduleType: string; weekId: string }) => {
    socket.join(`schedule:${data.scheduleType}:${data.weekId}`);
    console.log(`✅ Socket ${socket.id} joined schedule:${data.scheduleType}:${data.weekId}`);
  });

  socket.on('join-reports', (data: { weekId: string }) => {
    socket.join(`reports:${data.weekId}`);
    console.log(`✅ Socket ${socket.id} joined reports:${data.weekId}`);
  });

  socket.on('disconnect', () => {
    console.log(`📡 Client disconnected: ${socket.id}`);
  });

  socket.on('error', (err) => {
    console.error(`❌ Socket error for ${socket.id}:`, err);
  });
});

// Export io for route handlers
export { io };

// ─── START SERVER ───
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Emmenegger API running on port ${PORT}`);
  console.log(`📊 Supabase: ${process.env.SUPABASE_URL}`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down gracefully...');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
