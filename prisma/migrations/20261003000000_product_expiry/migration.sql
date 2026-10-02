-- Optional expiry date per product (تاريخ نهاية الصلاحية). Existing products keep none.
ALTER TABLE "Product" ADD COLUMN "expiryDate" DATE;
CREATE INDEX "Product_expiryDate_idx" ON "Product"("expiryDate");
