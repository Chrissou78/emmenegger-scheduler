import { Router } from 'express';
import { prisma } from '../db/client';

export const statsRouter = Router();

statsRouter.get('/occupancy', async (req, res, next) => {
  try {
    const { weekId, userId } = req.query;
    const where: any = {};
    if (weekId) where.weekId = weekId;
    if (req.user?.role === 'ARBEITER') where.userId = req.user.userId;
    else if (userId) where.userId = userId;

    const allocations = await prisma.allocation.findMany({ where });
    const week = weekId ? await prisma.week.findUnique({ where: { id: weekId as string } }) : null;

    // Calculate total available slots (6 days x 4 slots per user)
    let userIds: string[];
    if (userId) { userIds = [userId as string]; }
    else {
      const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
      userIds = users.map(u => u.id);
    }

    const totalSlots = userIds.length * 6 * 4;
    const filledSlots = allocations.length;

    // Get absences for the period
    const absenceCount = weekId
      ? await prisma.absence.count({ where: { userId: userId ? userId as string : undefined } })
      : 0;

    res.json({
      data: {
        totalSlots,
        filledSlots,
        absenceSlots: absenceCount,
        occupancyRate: totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0,
        employeeCount: userIds.length,
      },
    });
  } catch (err) { next(err); }
});
