-- Источник заказа: откуда пришёл покупатель (ChatGPT, Яндекс, Google, Telegram, прямой заход…).
ALTER TABLE "Order" ADD COLUMN "trafficSource" TEXT;
ALTER TABLE "Order" ADD COLUMN "trafficInfo" TEXT;
CREATE INDEX "Order_trafficSource_idx" ON "Order"("trafficSource");
