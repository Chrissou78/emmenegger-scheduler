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
  switch (upper) {
    case 'CEO':            return ['CEO', 'GLOBAL_MANAGER', 'ADMIN'];
    case 'ADMIN':          return ['ADMIN', 'GLOBAL_MANAGER'];
    case 'EXECUTIVE':      return ['EXECUTIVE', 'GLOBAL_MANAGER'];
    case 'MANAGER':        return ['MANAGER', 'LOCAL_MANAGER'];
    case 'GLOBAL_MANAGER': return ['GLOBAL_MANAGER', 'ADMIN', 'CEO'];
    case 'LOCAL_MANAGER':  return ['LOCAL_MANAGER', 'MANAGER'];
    case 'EMPLOYEE':       return ['EMPLOYEE', 'ARBEITER'];
    case 'ARBEITER':       return ['ARBEITER', 'EMPLOYEE'];
    default:               return [upper];
  }
}

/* ★ Helper: check if user's role matches any of the given roles (used in route handlers) */
export function isRoleOneOf(userRole: string, ...roles: string[]): boolean {
  const userRoles = normalizeRoleForAuth(userRole);
  return roles.some(r => userRoles.some(ur => ur.toUpperCase() === r.toUpperCase()));
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

// ★ Role guard — understands both old and new role names
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRoles = normalizeRoleForAuth(req.user.role);
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

    // ★ Check both ARBEITER and EMPLOYEE
    if (isRoleOneOf(req.user.role, 'ARBEITER', 'EMPLOYEE') && targetId && targetId !== req.user.userId) {
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
