import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { AuthenticationError } from '../errors/ApiError.js';

// Module augmentation for Express Request interface
declare module 'express' {
  interface Request {
    userId?: string
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AuthenticationError('Authorization token required'));
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return next(new AuthenticationError('Authorization token required'));
    }

    const decoded = verifyToken(token);
    req.userId = decoded.userId;
    next();
  } catch {
    next(new AuthenticationError('Invalid or expired token'));
  }
}
