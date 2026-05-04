import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../../../shared/types';

const JWT_SECRET = process.env.JWT_SECRET || 'emmenegger-dev-secret-change-in-production';

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
  departments: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing token' });
  }

  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
  }
}

// Role guard: requires one of the specified roles
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Requires role: ${roles.join(' or ')}`,
      });
    }
    next();
  };
}

// Scope guard: managers see team/company, workers see only self
export function requireScopeOrSelf(paramName = 'userId') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const targetId = req.params[paramName] || req.body?.[paramName];

    // Workers can only access their own data
    if (req.user.role === 'ARBEITER' && targetId && targetId !== req.user.userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Workers can only access their own data',
      });
    }
    next();
  };
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}
