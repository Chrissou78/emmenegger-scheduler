import { Router } from 'express';
import { prisma } from '../db/client';

export const reportsRouter = Router();

reportsRouter.get('/', async (req, res, next) => {
  try {
    const { userId, startDate, endDate, status } = req.query;
    const where: any = {};
    if (req.user?.role === 'ARBEITER') where.userId = req.user.userId;
    else if (userId) where.userId = userId;
    if (status) where.status = status;
    if (startDate && endDate) where.date = { gte: new Date(startDate as string), lte: new Date(endDate as string) };
    const reports = await prisma.timeReport.findMany({
      where, include: { task: { select: { id:true, name:true, code:true, color:true } }, user: { select: { id:true, firstName:true, lastName:true } } },
      orderBy: { date: 'desc' },
    });
    res.json({ data: reports });
  } catch (err) { next(err); }
});

// Workers submit their own reports
reportsRouter.post('/', async (req, res, next) => {
  try {
    const report = await prisma.timeReport.create({
      data: { ...req.body, userId: req.user!.userId, date: new Date(req.body.date), submittedAt: new Date() },
    });
    res.status(201).json({ data: report });
  } catch (err) { next(err); }
});

reportsRouter.put('/:id', async (req, res, next) => {
  try {
    const report = await prisma.timeReport.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'Not found' });
    if (req.user?.role === 'ARBEITER' && report.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const updated = await prisma.timeReport.update({ where: { id: req.params.id }, data: { ...req.body, date: req.body.date ? new Date(req.body.date) : undefined } });
    res.json({ data: updated });
  } catch (err) { next(err); }
});
