import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/client';
import { signToken } from '../middleware/auth';

export const authRouter = Router();

// POST /api/v1/auth/login
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Bad Request', message: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      departments: user.departments,
    });

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          departments: user.departments,
          avatarUrl: user.avatarUrl,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/register (admin only, but open for initial setup)
authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role, departments } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing required fields' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role: role || 'ARBEITER',
        departments: departments || ['GARTEN_TIEFBAU'],
      },
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      departments: user.departments,
    });

    res.status(201).json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          departments: user.departments,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
authRouter.get('/me', async (req, res, next) => {
  try {
    // This route uses a simple token check without the full middleware chain
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const jwt = await import('jsonwebtoken');
    const payload = jwt.default.verify(
      header.split(' ')[1],
      process.env.JWT_SECRET || 'emmenegger-dev-secret-change-in-production'
    ) as any;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, departments: true, avatarUrl: true, phone: true,
      },
    });

    if (!user) return res.status(404).json({ error: 'Not Found' });
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});
