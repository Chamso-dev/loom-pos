-- Data-integrity hardening (audit 2026-10-03). Additive only: no existing data is changed.
--
-- 1. requestId on sales, refunds, repayments, purchases and supplier payments: the app sends
--    one id per attempt, so a request retried after a dropped connection is recorded once.
-- 2. Indexes on foreign keys that PostgreSQL does not index on its own (sale lines, refund
--    lines, purchase lines, payments by customer...), for customer accounts, refunds and reports.
-- 3. A last line of defence against overselling: stock can no longer go below zero. NOT VALID
--    leaves existing rows unchecked, so this migration cannot fail on old data.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "requestId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "requestId" TEXT;

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "requestId" TEXT;

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "requestId" TEXT;

-- AlterTable
ALTER TABLE "SupplierPayment" ADD COLUMN     "requestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_requestId_key" ON "Order"("requestId");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_requestId_key" ON "Payment"("requestId");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_requestId_key" ON "Purchase"("requestId");

-- CreateIndex
CREATE INDEX "Purchase_supplierId_idx" ON "Purchase"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseItem_productId_idx" ON "PurchaseItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_requestId_key" ON "Refund"("requestId");

-- CreateIndex
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");

-- CreateIndex
CREATE INDEX "RefundItem_refundId_idx" ON "RefundItem"("refundId");

-- CreateIndex
CREATE INDEX "RefundItem_orderItemId_idx" ON "RefundItem"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_requestId_key" ON "SupplierPayment"("requestId");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierPayment_createdAt_idx" ON "SupplierPayment"("createdAt");


-- Stock never below zero (checked on every new write).
ALTER TABLE "Product" ADD CONSTRAINT "Product_stock_non_negative" CHECK ("stock" >= 0) NOT VALID;
