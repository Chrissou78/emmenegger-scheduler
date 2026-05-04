import { Router } from 'express';
import { prisma } from '../db/client';
import { requireRole } from '../middleware/auth';

export const customersRouter = Router();

customersRouter.get('/', async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json({ data: customers });
  } catch (err) { next(err); }
});

customersRouter.post('/', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const customer = await prisma.customer.create({ data: req.body });
    res.status(201).json({ data: customer });
  } catch (err) { next(err); }
});

customersRouter.put('/:id', requireRole('LOCAL_MANAGER', 'GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const customer = await prisma.customer.update({ where: { id: req.params.id }, data: req.body });
    res.json({ data: customer });
  } catch (err) { next(err); }
});
