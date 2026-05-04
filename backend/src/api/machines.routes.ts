import { Router } from 'express';
import { prisma } from '../db/client';
import { requireRole } from '../middleware/auth';

export const machinesRouter = Router();

machinesRouter.get('/', async (req, res, next) => {
  try {
    const { category, active } = req.query;
    const where: any = {};
    if (category) where.category = category;
    if (active !== undefined) where.isActive = active === 'true';
    const machines = await prisma.machine.findMany({ where, orderBy: [{ category: 'asc' }, { tonnage: 'asc' }] });
    res.json({ data: machines });
  } catch (err) { next(err); }
});

machinesRouter.post('/', requireRole('GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const machine = await prisma.machine.create({ data: req.body });
    res.status(201).json({ data: machine });
  } catch (err) { next(err); }
});

machinesRouter.get('/allocations', async (req, res, next) => {
  try {
    const { weekId } = req.query;
    const where: any = {};
    if (weekId) where.weekId = weekId;
    const allocs = await prisma.machineAllocation.findMany({
      where, include: { machine: true, site: { select: { id:true, name:true, location:true } } },
      orderBy: [{ dayOfWeek: 'asc' }],
    });
    res.json({ data: allocs });
  } catch (err) { next(err); }
});

machinesRouter.post('/allocations', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { machineId, siteId, weekId, dayOfWeek } = req.body;
    const existing = await prisma.machineAllocation.findUnique({
      where: { machineId_weekId_dayOfWeek: { machineId, weekId, dayOfWeek } },
    });
    if (existing) return res.status(409).json({ error: 'Machine already allocated on this day' });
    const alloc = await prisma.machineAllocation.create({
      data: { machineId, siteId, weekId, dayOfWeek, createdById: req.user!.userId },
      include: { machine: true, site: { select: { id:true, name:true } } },
    });
    res.status(201).json({ data: alloc });
  } catch (err) { next(err); }
});
