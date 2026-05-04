import { Router } from 'express';
import { prisma } from '../db/client';
import { requireRole } from '../middleware/auth';
import bcrypt from 'bcryptjs';

export const usersRouter = Router();

usersRouter.get('/', async (req, res, next) => {
  try {
    const { department, role, active } = req.query;
    const where: any = {};
    if (department) where.departments = { has: department };
    if (role) where.role = role;
    if (active !== undefined) where.isActive = active === 'true';

    const users = await prisma.user.findMany({
      where,
      select: { id:true, email:true, firstName:true, lastName:true, role:true, departments:true, phone:true, avatarUrl:true, isActive:true, abacusId:true },
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
    });
    res.json({ data: users });
  } catch (err) { next(err); }
});

usersRouter.get('/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { id:true, email:true, firstName:true, lastName:true, role:true, departments:true, phone:true, avatarUrl:true, isActive:true, abacusId:true, createdAt:true },
    });
    res.json({ data: user });
  } catch (err) { next(err); }
});

usersRouter.put('/:id', requireRole('GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { firstName, lastName, role, departments, phone, isActive, abacusId } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { firstName, lastName, role, departments, phone, isActive, abacusId },
    });
    res.json({ data: user });
  } catch (err) { next(err); }
});

usersRouter.post('/', requireRole('GLOBAL_MANAGER'), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role, departments } = req.body;
    const passwordHash = await bcrypt.hash(password || 'temp123', 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, firstName, lastName, role: role || 'ARBEITER', departments: departments || [] },
    });
    res.status(201).json({ data: user });
  } catch (err) { next(err); }
});
