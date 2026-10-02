-- Adapts LoomPOS to Algeria: dinar amounts with tax-included prices, Algerian payment
-- methods with split payments, customer credit, refunds, units sold by weight,
-- suppliers and purchases, and Algerian business identifiers.
-- Existing data is kept and mapped.

-- Order: tax column renamed, settlement columns added.
ALTER TABLE "Order" RENAME COLUMN "gstAmount" TO "taxAmount";
ALTER TABLE "Order"
  ADD COLUMN "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "changeGiven" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "balanceDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "refundedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PAID',
  ADD COLUMN "customerId" TEXT;
ALTER TABLE "Order" ALTER COLUMN "taxAmount" SET DEFAULT 0;

-- OrderItem: decimal quantities and sale-time snapshots.
ALTER TABLE "OrderItem"
  ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION,
  ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'piece',
  ADD COLUMN "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "refundedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Product: tax column renamed, unit added, stock can hold 1.5 kg.
ALTER TABLE "Product" RENAME COLUMN "gst" TO "taxRate";
ALTER TABLE "Product"
  ALTER COLUMN "stock" SET DATA TYPE DOUBLE PRECISION,
  ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'piece',
  ADD COLUMN "supplierId" TEXT;

-- StoreSettings: Indian GSTIN and UPI fields replaced by Algerian identifiers.
ALTER TABLE "StoreSettings"
  DROP COLUMN "gstin",
  DROP COLUMN "upiId",
  ADD COLUMN "nif" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "rc" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "nis" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "articleNo" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'DZD',
  ADD COLUMN "language" TEXT NOT NULL DEFAULT 'ar',
  ADD COLUMN "defaultPaymentMethod" TEXT NOT NULL DEFAULT 'CASH',
  ADD COLUMN "ripAccount" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "ribAccount" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "receiptWidth" INTEGER NOT NULL DEFAULT 80,
  ADD COLUMN "receiptFooter" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "receiptShowTax" BOOLEAN NOT NULL DEFAULT true,
  ALTER COLUMN "name" SET DEFAULT 'LoomPOS',
  ALTER COLUMN "address" SET DEFAULT '',
  ALTER COLUMN "phone" SET DEFAULT '';

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SALE',
    "method" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "tendered" DOUBLE PRECISION,
    "reference" TEXT,
    "orderId" TEXT,
    "customerId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "creditLimit" DOUBLE PRECISION,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "refundNo" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "toCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidOut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL,
    "reason" TEXT,
    "restock" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundItem" (
    "id" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RefundItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "purchaseNo" TEXT NOT NULL,
    "supplierId" TEXT,
    "reference" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "userId" TEXT,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT,
    "purchaseId" TEXT,
    "method" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reference" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_refundNo_key" ON "Refund"("refundNo");

-- CreateIndex
CREATE INDEX "Refund_createdAt_idx" ON "Refund"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_purchaseNo_key" ON "Purchase"("purchaseNo");

-- CreateIndex
CREATE INDEX "Purchase_date_idx" ON "Purchase"("date");

-- CreateIndex
CREATE INDEX "Order_date_idx" ON "Order"("date");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundItem" ADD CONSTRAINT "RefundItem_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundItem" ADD CONSTRAINT "RefundItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Data mapping for sales made before this migration ------------------------------

-- Old line prices excluded tax. Shelf prices are now tax-included, so lines are
-- restated with the tax inside, using the product's rate.
UPDATE "OrderItem" oi SET
  "price" = ROUND((oi."price" * (1 + p."taxRate" / 100))::numeric, 2)::double precision,
  "taxRate" = p."taxRate",
  "costPrice" = p."costPrice"
FROM "Product" p WHERE p."id" = oi."productId";

-- Old totals already included tax and were paid in full.
UPDATE "Order" SET "subtotal" = "totalAmount", "amountPaid" = "totalAmount";

-- Card and UPI become the nearest Algerian methods.
UPDATE "Order" SET "paymentMethod" = 'CIB' WHERE "paymentMethod" = 'CARD';
UPDATE "Order" SET "paymentMethod" = 'BARIDIMOB' WHERE "paymentMethod" = 'UPI';

-- Each old sale gets one payment record for its full amount.
INSERT INTO "Payment" ("id", "kind", "method", "amount", "orderId", "userId", "createdAt")
SELECT 'pay_' || o."id", 'SALE', o."paymentMethod", o."totalAmount", o."id", o."userId", o."date"
FROM "Order" o;

-- Clear the Indian demo defaults if they were never changed.
UPDATE "StoreSettings" SET "address" = '' WHERE "address" = '123 Trend Avenue, Mumbai';
UPDATE "StoreSettings" SET "phone" = '' WHERE "phone" = '+91 98765 43210';
