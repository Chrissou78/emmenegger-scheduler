import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import app from './app';

const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

// ─── WEBSOCKET (dev only — use Supabase Realtime in prod) ───
io.on('connection', (socket) => {
  console.log(`📡 Client connected: ${socket.id}`);

  socket.on('join-schedule', (data: { scheduleType: string; weekId: string }) => {
    socket.join(`schedule:${data.scheduleType}:${data.weekId}`);
  });

  socket.on('join-reports', (data: { weekId: string }) => {
    socket.join(`reports:${data.weekId}`);
  });

  socket.on('disconnect', () => {
    console.log(`📡 Client disconnected: ${socket.id}`);
  });
});

export { io };

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Emmenegger API running on port ${PORT}`);
});
