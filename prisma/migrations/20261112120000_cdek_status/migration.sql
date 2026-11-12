-- Последний статус отправления СДЭК: по нему автоматически двигается статус заказа.
ALTER TABLE "Order" ADD COLUMN "cdekStatusCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "cdekStatusName" TEXT;
ALTER TABLE "Order" ADD COLUMN "cdekStatusCity" TEXT;
ALTER TABLE "Order" ADD COLUMN "cdekStatusAt" TIMESTAMP(3);
