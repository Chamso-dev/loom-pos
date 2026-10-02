import { PrismaClient, Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const JWT_SECRET = process.env.JWT_SECRET || 'fallback_super_secret_key_123';

export const prisma = new PrismaClient();

export type Tx = Prisma.TransactionClient;

/**
 * An error the client can translate. `code` is stable and maps to errors.<code>
 * in the i18n dictionaries; `message` is English, for logs.
 */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string, public details?: Record<string, unknown>) {
    super(message ?? code);
  }
}

export function sendError(res: Response, error: unknown, fallbackCode = 'SERVER_ERROR') {
  if (error instanceof ApiError) {
    return res.status(error.status).json({ error: error.message, code: error.code, details: error.details });
  }
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: 'Invalid input', code: 'VALIDATION', issues: error.issues });
  }
  console.error(error);
  return res.status(500).json({ error: 'Unexpected server error', code: fallbackCode });
}

export interface AuthedRequest extends Request<Record<string, string>> {
  user?: { id: string; role: string; name: string; employeeId: string };
}

async function userFromToken(req: Request) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) throw new ApiError(401, 'UNAUTHORIZED', 'Missing token');
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET) as { id: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.isActive) throw new ApiError(401, 'UNAUTHORIZED', 'Unknown or inactive user');
    return user;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'SESSION_EXPIRED', 'Invalid or expired token');
  }
}

/** Any signed-in, active staff member. */
export const requireAuth = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    req.user = await userFromToken(req);
    next();
  } catch (error) {
    sendError(res, error);
  }
};

export const requireAdmin = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await userFromToken(req);
    if (user.role !== 'ADMIN') throw new ApiError(403, 'ADMIN_REQUIRED', 'Admin access required');
    req.user = user;
    next();
  } catch (error) {
    sendError(res, error);
  }
};

/** Admins pass. Cashiers pass when they send the admin's password in x-admin-verification-key. */
export const requireAdminOrKey = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await userFromToken(req);
    req.user = user;
    if (user.role === 'ADMIN') return next();
    const adminKey = req.headers['x-admin-verification-key'];
    if (typeof adminKey === 'string' && adminKey) {
      const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', isActive: true } });
      if (admin && (await bcrypt.compare(adminKey, admin.password))) return next();
    }
    throw new ApiError(403, 'ADMIN_VERIFICATION_REQUIRED', 'Admin verification required');
  } catch (error) {
    sendError(res, error);
  }
};

/** Next sequential document number, e.g. INV-0189, RF-0001, ACH-0001. */
export async function nextNumber(tx: Tx, kind: 'order' | 'refund' | 'purchase') {
  const [prefix, count] =
    kind === 'order'
      ? ['INV', await tx.order.count()]
      : kind === 'refund'
        ? ['RF', await tx.refund.count()]
        : ['ACH', await tx.purchase.count()];
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}

/** Start of the server's local day, n days ago. */
export function startOfLocalDay(daysAgo = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

/** Parses YYYY-MM-DD as the start of that local day. */
export function parseLocalDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Wraps an async route so thrown errors become translated JSON errors. */
export const handle =
  (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) => (req: AuthedRequest, res: Response) =>
    fn(req, res).catch((error) => sendError(res, error));
