/**
 * On-device SQLite layer for the standalone Android build.
 *
 * Replaces the PostgreSQL + Express backend: when the app runs natively
 * (Capacitor), all `/api/*` calls are served locally against this database
 * so the POS works fully offline with no server.
 */
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import bcrypt from 'bcryptjs';

const DB_NAME = 'loompos';
const sqlite = new SQLiteConnection(CapacitorSQLite);
let db: SQLiteDBConnection | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY,
  employeeId TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'CASHIER',
  phone TEXT,
  password TEXT NOT NULL,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS Product (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  barcode TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  size TEXT,
  color TEXT,
  costPrice REAL NOT NULL,
  sellingPrice REAL NOT NULL,
  gst REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  supplier TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS "Order" (
  id TEXT PRIMARY KEY,
  invoiceNo TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  totalAmount REAL NOT NULL,
  gstAmount REAL NOT NULL,
  paymentMethod TEXT NOT NULL,
  customerName TEXT,
  customerMobile TEXT,
  userId TEXT
);
CREATE TABLE IF NOT EXISTS OrderItem (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL,
  productId TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS StoreSettings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'LOOMPOS',
  address TEXT NOT NULL DEFAULT '',
  gstin TEXT NOT NULL DEFAULT '',
  upiId TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  cashierPassword TEXT,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_product_barcode ON Product(barcode);
CREATE INDEX IF NOT EXISTS idx_order_date ON "Order"(date);
CREATE INDEX IF NOT EXISTS idx_orderitem_order ON OrderItem(orderId);
`;

export async function initDatabase(): Promise<void> {
  if (db) return;

  const isConn = (await sqlite.isConnection(DB_NAME, false)).result;
  db = isConn
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);

  await db.open();
  await db.execute(SCHEMA);
  await seedDefaults();
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Seeds the default admin account and store settings on first launch. */
async function seedDefaults(): Promise<void> {
  const admin = await query<{ c: number }>(`SELECT COUNT(*) AS c FROM User WHERE employeeId = ?`, ['admin']);
  if ((admin[0]?.c ?? 0) === 0) {
    const hashed = await bcrypt.hash('admin123', 10);
    const ts = nowIso();
    await run(
      `INSERT INTO User (id, employeeId, name, role, phone, password, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, 'ADMIN', NULL, ?, 1, ?, ?)`,
      [crypto.randomUUID(), 'admin', 'System Admin', hashed, ts, ts]
    );
  }

  const settings = await query<{ c: number }>(`SELECT COUNT(*) AS c FROM StoreSettings`);
  if ((settings[0]?.c ?? 0) === 0) {
    await run(
      `INSERT INTO StoreSettings (id, name, address, gstin, upiId, phone, cashierPassword, updatedAt)
       VALUES ('1', 'LOOMPOS', '123 Trend Avenue, Mumbai', '27AAAAA0000A1Z5', 'store@upi', '+91 98765 43210', NULL, ?)`,
      [nowIso()]
    );
  }
}

function requireDb(): SQLiteDBConnection {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const res = await requireDb().query(sql, params);
  return (res.values ?? []) as T[];
}

export async function run(sql: string, params: any[] = [], transaction = true): Promise<void> {
  await requireDb().run(sql, params, transaction);
}

/** Runs `work` inside a single SQLite transaction, rolling back on any error. */
export async function transaction<T>(work: () => Promise<T>): Promise<T> {
  const conn = requireDb();
  await conn.beginTransaction();
  try {
    const result = await work();
    await conn.commitTransaction();
    return result;
  } catch (err) {
    if ((await conn.isTransactionActive()).result) {
      await conn.rollbackTransaction();
    }
    throw err;
  }
}
