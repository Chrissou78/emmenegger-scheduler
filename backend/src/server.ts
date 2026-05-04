import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import dotenv from 'dotenv';

import { authRouter } from './api/auth.routes';
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

dotenv.config();

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

// ─── PUBLIC ROUTES ───
app.use('/api/v1/auth', authRouter);

// ─── PROTECTED ROUTES ───
app.use('/api/v1/users',       authMiddleware, usersRouter);
app.use('/api/v1/tasks',       authMiddleware, tasksRouter);
app.use('/api/v1/allocations', authMiddleware, allocationsRouter);
app.use('/api/v1/absences',    authMiddleware, absencesRouter);
app.use('/api/v1/machines',    authMiddleware, machinesRouter);
app.use('/api/v1/weeks',       authMiddleware, weeksRouter);
app.use('/api/v1/reports',     authMiddleware, reportsRouter);
app.use('/api/v1/customers',   authMiddleware, customersRouter);
app.use('/api/v1/stats',       authMiddleware, statsRouter);

// ─── HEALTH CHECK ───
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── ERROR HANDLER ───
app.use(errorHandler);

// ─── WEBSOCKET (for live dashboard) ───
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join-schedule', (data: { scheduleType: string; weekId: string }) => {
    socket.join(`schedule:${data.scheduleType}:${data.weekId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Export io for use in route handlers to broadcast changes
export { io };

// ─── START ───
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Emmenegger API running on port ${PORT}`);
});
