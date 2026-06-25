/**
 * On-device SQLite layer for the standalone Android build.
 *
 * Replaces the PostgreSQL + Express backend: when the app runs natively
 * (Capacitor), all `/api/*` calls are served locally against this database
 * so the POS works fully offline with no server.
 */
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

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
  productType TEXT NOT NULL DEFAULT 'UNIT',
  size TEXT,
  color TEXT,
  costPrice REAL NOT NULL,
  sellingPrice REAL NOT NULL,
  gst REAL NOT NULL DEFAULT 0,
  stock REAL NOT NULL DEFAULT 0,
  minSellWeight REAL,
  supplier TEXT,
  expiryDate TEXT,
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
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  refundedAt TEXT,
  customerName TEXT,
  customerMobile TEXT,
  customerId TEXT,
  userId TEXT
);
CREATE TABLE IF NOT EXISTS OrderItem (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL,
  productId TEXT NOT NULL,
  quantity REAL NOT NULL,
  price REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS Customer (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS Supplier (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS StoreSettings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'My Store',
  address TEXT NOT NULL DEFAULT '',
  nif TEXT NOT NULL DEFAULT '',
  nis TEXT NOT NULL DEFAULT '',
  rc TEXT NOT NULL DEFAULT '',
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
  await migrateSchema();
  await seedDefaults();
}

/**
 * Additive migration for devices that already have an older database. SQLite
 * only supports ADD COLUMN, which is all we need — every new column is nullable
 * or has a default, so existing rows stay valid.
 */
async function migrateSchema(): Promise<void> {
  const addColumn = async (table: string, column: string, decl: string) => {
    const info = await query<{ name: string }>(`PRAGMA table_info("${table}")`);
    if (!info.some((c) => c.name === column)) {
      await db!.execute(`ALTER TABLE "${table}" ADD COLUMN ${column} ${decl};`);
    }
  };

  await addColumn('Product', 'productType', `TEXT NOT NULL DEFAULT 'UNIT'`);
  await addColumn('Product', 'minSellWeight', 'REAL');
  await addColumn('Product', 'expiryDate', 'TEXT');
  await addColumn('Order', 'status', `TEXT NOT NULL DEFAULT 'COMPLETED'`);
  await addColumn('Order', 'refundedAt', 'TEXT');
  await addColumn('Order', 'customerId', 'TEXT');
  // Algeria localization: replace GSTIN/UPI with NIF/NIS/RC.
  await addColumn('StoreSettings', 'nif', `TEXT NOT NULL DEFAULT ''`);
  await addColumn('StoreSettings', 'nis', `TEXT NOT NULL DEFAULT ''`);
  await addColumn('StoreSettings', 'rc', `TEXT NOT NULL DEFAULT ''`);
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Seeds store settings on first launch. There is intentionally NO default admin
 * account: onboarding is via the Sign Up screen, where the first account created
 * on the device automatically becomes ADMIN.
 */
async function seedDefaults(): Promise<void> {
  const settings = await query<{ c: number }>(`SELECT COUNT(*) AS c FROM StoreSettings`);
  if ((settings[0]?.c ?? 0) === 0) {
    await run(
      `INSERT INTO StoreSettings (id, name, address, nif, nis, rc, phone, cashierPassword, updatedAt)
       VALUES ('1', 'My Store', '', '', '', '', '', NULL, ?)`,
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
