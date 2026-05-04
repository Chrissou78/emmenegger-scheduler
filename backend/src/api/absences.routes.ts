import { Router } from 'express';
import { prisma } from '../db/client';
import { requireRole } from '../middleware/auth';

export const absencesRouter = Router();

absencesRouter.get('/', async (req, res, next) => {
  try {
    const { userId, startDate, endDate } = req.query;
    const where: any = {};
    if (req.user?.role === 'ARBEITER') where.userId = req.user.userId;
    else if (userId) where.userId = userId;
    if (startDate && endDate) where.date = { gte: new Date(startDate as string), lte: new Date(endDate as string) };
    const absences = await prisma.absence.findMany({ where, include: { user: { select: { id:true, firstName:true, lastName:true } } }, orderBy: { date: 'asc' } });
    res.json({ data: absences });
  } catch (err) { next(err); }
});

absencesRouter.post('/', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const absence = await prisma.absence.create({ data: { ...req.body, date: new Date(req.body.date) } });
    res.status(201).json({ data: absence });
  } catch (err) { next(err); }
});

absencesRouter.delete('/:id', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    await prisma.absence.delete({ where: { id: req.params.id } });
    res.json({ data: { deleted: true } });
  } catch (err) { next(err); }
});
