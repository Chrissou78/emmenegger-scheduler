import { Router } from 'express';
import { prisma } from '../db/client';
import { requireRole } from '../middleware/auth';

export const weeksRouter = Router();

weeksRouter.get('/', async (req, res, next) => {
  try {
    const { year, scheduleType } = req.query;
    const where: any = {};
    if (year) where.year = Number(year);
    if (scheduleType) where.scheduleType = scheduleType;
    const weeks = await prisma.week.findMany({ where, orderBy: { weekNumber: 'asc' } });
    res.json({ data: weeks });
  } catch (err) { next(err); }
});

weeksRouter.post('/', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const week = await prisma.week.upsert({
      where: { year_weekNumber_scheduleType: { year: req.body.year, weekNumber: req.body.weekNumber, scheduleType: req.body.scheduleType } },
      create: { ...req.body, createdById: req.user!.userId },
      update: {},
    });
    res.json({ data: week });
  } catch (err) { next(err); }
});

weeksRouter.put('/:id/status', requireRole('GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const update: any = { status };
    if (status === 'PUBLISHED') update.publishedAt = new Date();
    if (status === 'LOCKED') update.lockedAt = new Date();
    const week = await prisma.week.update({ where: { id: req.params.id }, data: update });
    res.json({ data: week });
  } catch (err) { next(err); }
});
