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

/* ★ Normalize role — map new role names to legacy equivalents for permission checks */
function normalizeRoleForAuth(role: string): string[] {
  const upper = (role || '').toUpperCase();
  // Return the role itself PLUS any legacy equivalents
  switch (upper) {
    case 'CEO':
      return ['CEO', 'GLOBAL_MANAGER'];
    case 'ADMIN':
      return ['ADMIN', 'GLOBAL_MANAGER'];
    case 'EXECUTIVE':
      return ['EXECUTIVE', 'GLOBAL_MANAGER'];
    case 'MANAGER':
      return ['MANAGER', 'LOCAL_MANAGER'];
    case 'GLOBAL_MANAGER':
      return ['GLOBAL_MANAGER', 'ADMIN'];
    case 'LOCAL_MANAGER':
      return ['LOCAL_MANAGER', 'MANAGER'];
    default:
      return [upper];
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

// ★ Updated: Role guard now understands both old and new role names
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all equivalent roles for the user's actual role
    const userRoles = normalizeRoleForAuth(req.user.role);

    // Check if ANY of the user's equivalent roles match ANY of the required roles
    const hasRole = roles.some(requiredRole =>
      userRoles.some(ur => ur.toUpperCase() === requiredRole.toUpperCase())
    );

    if (!hasRole) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Requires role: ${roles.join(' or ')} (your role: ${req.user.role})`,
      });
    }
    next();
  };
}

export function requireScopeOrSelf(paramName = 'userId') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const targetId = req.params[paramName] || req.body?.[paramName];

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
