-- PostgreSQL assigns public order numbers atomically. The sequence starts after
-- the largest existing number and preserves the historical 1001+ range.
CREATE SEQUENCE IF NOT EXISTS "Order_orderNumber_seq";

SELECT setval(
  '"Order_orderNumber_seq"',
  GREATEST(COALESCE((SELECT MAX("orderNumber") FROM "Order"), 1000) + 1, 1001),
  false
);

ALTER SEQUENCE "Order_orderNumber_seq" OWNED BY "Order"."orderNumber";
ALTER TABLE "Order"
  ALTER COLUMN "orderNumber" SET DEFAULT nextval('"Order_orderNumber_seq"');

-- Existing guest orders remain accessible only through the authenticated
-- account page. Newly created orders receive a CUID from Prisma.
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "accessToken" TEXT,
  ADD COLUMN IF NOT EXISTS "inventoryRestoredAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Order_accessToken_key" ON "Order"("accessToken");
