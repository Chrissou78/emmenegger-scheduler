import { Router } from 'express';
import { prisma } from '../db/client';
import { requireRole } from '../middleware/auth';
import { io } from '../server';

export const allocationsRouter = Router();

// GET /api/v1/allocations?weekId=xxx&scheduleType=xxx
allocationsRouter.get('/', async (req, res, next) => {
  try {
    const { weekId, userId, scheduleType, year, weekNumber } = req.query;

    const where: any = {};
    if (weekId) where.weekId = weekId;
    if (userId) where.userId = userId;

    // Workers can only see their own allocations
    if (req.user?.role === 'ARBEITER') {
      where.userId = req.user.userId;
    }

    // If year+weekNumber provided, find the week first
    if (year && weekNumber && scheduleType) {
      const week = await prisma.week.findUnique({
        where: {
          year_weekNumber_scheduleType: {
            year: Number(year),
            weekNumber: Number(weekNumber),
            scheduleType: scheduleType as any,
          },
        },
      });
      if (week) where.weekId = week.id;
    }

    const allocations = await prisma.allocation.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true, departments: true } },
        task: { select: { id: true, code: true, name: true, color: true, location: true, scheduleType: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { timeSlot: 'asc' }],
    });

    res.json({ data: allocations });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/allocations (create with conflict check)
allocationsRouter.post('/',
  requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'),
  async (req, res, next) => {
    try {
      const { userId, taskId, weekId, dayOfWeek, timeSlot } = req.body;

      // Check for absence on this day
      const week = await prisma.week.findUnique({ where: { id: weekId } });
      if (!week) return res.status(404).json({ error: 'Week not found' });

      // Calculate date from week + dayOfWeek
      const jan4 = new Date(week.year, 0, 4);
      const dayOfYear = (week.weekNumber - 1) * 7 + dayOfWeek;
      const monday = new Date(jan4);
      monday.setDate(jan4.getDate() - jan4.getDay() + 1 + (week.weekNumber - 1) * 7);
      const targetDate = new Date(monday);
      targetDate.setDate(monday.getDate() + dayOfWeek);

      const absence = await prisma.absence.findFirst({
        where: {
          userId,
          date: targetDate,
        },
      });

      if (absence) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Employee has an absence on this day',
          conflict: { type: 'ABSENCE_OVERLAP', absenceCode: absence.absenceCode },
        });
      }

      // Check for existing allocation in same slot
      const existing = await prisma.allocation.findUnique({
        where: {
          userId_weekId_dayOfWeek_timeSlot: { userId, weekId, dayOfWeek, timeSlot },
        },
      });

      if (existing) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Employee already allocated in this time slot',
          conflict: { type: 'DOUBLE_BOOKING', existingTaskId: existing.taskId },
        });
      }

      const allocation = await prisma.allocation.create({
        data: {
          userId,
          taskId,
          weekId,
          dayOfWeek,
          timeSlot,
          createdById: req.user!.userId,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          task: { select: { id: true, code: true, name: true, color: true } },
        },
      });

      // Broadcast to live dashboard viewers
      io.to(`schedule:${week.scheduleType}:${weekId}`).emit('allocation:created', allocation);

      res.status(201).json({ data: allocation });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/allocations/:id
allocationsRouter.delete('/:id',
  requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'),
  async (req, res, next) => {
    try {
      const allocation = await prisma.allocation.delete({
        where: { id: req.params.id },
        include: { week: true },
      });

      io.to(`schedule:${allocation.week.scheduleType}:${allocation.weekId}`).emit('allocation:deleted', {
        id: allocation.id,
        weekId: allocation.weekId,
      });

      res.json({ data: { deleted: true } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/allocations/copy-week
allocationsRouter.post('/copy-week',
  requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'),
  async (req, res, next) => {
    try {
      const { sourceWeekId, targetWeekId, includeAbsences = false } = req.body;

      const sourceAllocations = await prisma.allocation.findMany({
        where: { weekId: sourceWeekId },
      });

      const created = await prisma.allocation.createMany({
        data: sourceAllocations.map(a => ({
          userId: a.userId,
          taskId: a.taskId,
          weekId: targetWeekId,
          dayOfWeek: a.dayOfWeek,
          timeSlot: a.timeSlot,
          createdById: req.user!.userId,
        })),
        skipDuplicates: true,
      });

      res.json({ data: { copied: created.count } });
    } catch (err) {
      next(err);
    }
  }
);
