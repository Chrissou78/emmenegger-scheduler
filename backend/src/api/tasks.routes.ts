import { Router } from 'express';
import { prisma } from '../db/client';
import { requireRole } from '../middleware/auth';

export const tasksRouter = Router();

tasksRouter.get('/', async (req, res, next) => {
  try {
    const { scheduleType, status, recurring } = req.query;
    const where: any = {};
    if (scheduleType) where.scheduleType = scheduleType;
    if (status) where.status = status;
    if (recurring !== undefined) where.isRecurring = recurring === 'true';

    const tasks = await prisma.task.findMany({
      where, include: { customer: { select: { id:true, name:true } } },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ data: tasks });
  } catch (err) { next(err); }
});

tasksRouter.post('/', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const task = await prisma.task.create({ data: req.body });
    res.status(201).json({ data: task });
  } catch (err) { next(err); }
});

tasksRouter.put('/:id', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const task = await prisma.task.update({ where: { id: req.params.id }, data: req.body });
    res.json({ data: task });
  } catch (err) { next(err); }
});

tasksRouter.delete('/:id', requireRole('GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ data: { deleted: true } });
  } catch (err) { next(err); }
});
