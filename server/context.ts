import { PrismaClient, Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Days, hours and "today" in reports follow the shop's clock, not the host's. Hosting
// providers usually run in UTC, which would put 00:00-01:00 sales on the wrong day in
// Algeria. Set TZ to override.
process.env.TZ ||= 'Africa/Algiers';

const PLACEHOLDER_SECRETS = new Set(['', 'your_jwt_secret_here', 'fallback_super_secret_key_123', 'changeme', 'secret']);

/**
 * Signs and checks session tokens. A missing or example secret would let anyone forge a
 * manager's session, so production refuses to start without a real one. In development a
 * random secret is used for this run only (sessions end when the server restarts).
 */
export const JWT_SECRET = (() => {
  const configured = process.env.JWT_SECRET?.trim() ?? '';
  if (!PLACEHOLDER_SECRETS.has(configured) && configured.length >= 16) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set to a long random value (at least 16 characters) in production.');
  }
  console.warn('[security] JWT_SECRET is missing or weak; using a random secret for this run. Set it in .env.');
  return crypto.randomBytes(32).toString('hex');
})();

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

/** Known database errors become clear, translatable answers instead of "server error". */
function fromDatabaseError(error: unknown): ApiError | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (error.code === 'P2025') return new ApiError(404, 'NOT_FOUND', 'Record not found');
  if (error.code === 'P2003') return new ApiError(409, 'IN_USE', 'Record is still referenced');
  if (error.code === 'P2002') {
    const target = String((error.meta?.target as string[] | string | undefined) ?? '');
    if (target.includes('employeeId')) return new ApiError(409, 'EMPLOYEE_ID_TAKEN');
    if (target.includes('barcode')) return new ApiError(409, 'BARCODE_TAKEN');
    if (target.includes('phone')) return new ApiError(409, 'ALREADY_EXISTS', 'Phone already used');
    return new ApiError(409, 'ALREADY_EXISTS', 'Duplicate value');
  }
  return null;
}

export function sendError(res: Response, error: unknown, fallbackCode = 'SERVER_ERROR') {
  error = fromDatabaseError(error) ?? error;
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

/** The signed-in user when a valid token is sent, otherwise null. Never throws. */
export async function optionalUser(req: Request) {
  try {
    return await userFromToken(req);
  } catch {
    return null;
  }
}

/** Admins pass. Cashiers pass when they send any active manager's password in x-admin-verification-key. */
export const requireAdminOrKey = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await userFromToken(req);
    req.user = user;
    if (user.role === 'ADMIN') return next();
    const adminKey = req.headers['x-admin-verification-key'];
    if (typeof adminKey === 'string' && adminKey) {
      const limitKey = `admin-key:${user.id}`;
      passwordAttempts.check(limitKey, req);
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true } });
      for (const admin of admins) {
        if (await bcrypt.compare(adminKey, admin.password)) {
          passwordAttempts.succeeded(limitKey, req);
          return next();
        }
      }
      passwordAttempts.failed(limitKey, req);
    }
    throw new ApiError(403, 'ADMIN_VERIFICATION_REQUIRED', 'Admin verification required');
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * Slows down password guessing. Wrong passwords are counted per account and caller
 * (10 per 15 minutes) and per account overall (30 per 15 minutes, against guessing from
 * many addresses). A correct password clears that caller's count. Kept in memory: a
 * restart resets the counts, which is acceptable for a single shop server.
 */
function createAttemptLimiter(windowMs = 15 * 60_000, perCaller = 10, perAccount = 30) {
  const counts = new Map<string, { n: number; until: number }>();
  const bump = (key: string) => {
    const now = Date.now();
    const entry = counts.get(key);
    if (!entry || entry.until < now) counts.set(key, { n: 1, until: now + windowMs });
    else entry.n += 1;
  };
  const over = (key: string, max: number) => {
    const entry = counts.get(key);
    return Boolean(entry && entry.until >= Date.now() && entry.n >= max);
  };
  const callerKey = (key: string, req: Request) => `${key}|${req.ip ?? 'unknown'}`;
  // Forget old entries now and then so the map cannot grow without bound.
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of counts) if (v.until < now) counts.delete(k);
  }, windowMs).unref();
  return {
    check(key: string, req: Request) {
      if (over(callerKey(key, req), perCaller) || over(key, perAccount)) {
        throw new ApiError(429, 'TOO_MANY_ATTEMPTS', 'Too many failed attempts');
      }
    },
    failed(key: string, req: Request) {
      bump(callerKey(key, req));
      bump(key);
    },
    succeeded(key: string, req: Request) {
      counts.delete(callerKey(key, req));
    },
  };
}

export const passwordAttempts = createAttemptLimiter();

/** Next sequential document number, e.g. INV-0189, RF-0001, ACH-0001. */
export async function nextNumber(tx: Tx, kind: 'order' | 'refund' | 'purchase') {
  // Two tills saving at the same moment would otherwise read the same count and collide on
  // the unique number. The lock is held until this transaction ends, so numbers are handed
  // out one at a time and stay gap-free.
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('loompos:number:${kind}'))`);
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

// Always lock in this order across routes, so two requests never wait on each other in a
// circle: customer or supplier, then sales or purchases, then products, then numbering.
const LOCKABLE = { product: 'Product', customer: 'Customer', order: 'Order', supplier: 'Supplier', purchase: 'Purchase' } as const;

/**
 * Locks rows until the end of the transaction (SELECT ... FOR UPDATE), in a fixed order to
 * avoid deadlocks. Read the rows AFTER locking: the values are then current, and no other
 * sale, refund or payment can change them until this one commits. Without this, two tills
 * could both read stock 10 and both write 9, or two repayments could both pass the balance
 * check.
 */
export async function lockRows(tx: Tx, kind: keyof typeof LOCKABLE, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))].sort();
  if (!unique.length) return;
  await tx.$queryRawUnsafe(`SELECT id FROM "${LOCKABLE[kind]}" WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`, unique);
}

/** Client-chosen id that makes a retried request safe: the same id never records twice. */
export const requestIdSchema = z.string().trim().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/).nullish();

/** True when the error is a unique-constraint clash on requestId (a concurrent retry won the race). */
export const isRequestIdClash = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002' &&
  String(error.meta?.target ?? '').includes('requestId');
