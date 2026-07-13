-- Диалоги, начатые покупателем прямо в Telegram (личный чат с ботом).
ALTER TABLE "ChatConversation" ADD COLUMN "telegramUserChatId" TEXT;
ALTER TABLE "ChatConversation" ADD COLUMN "telegramUsername" TEXT;

CREATE UNIQUE INDEX "ChatConversation_telegramUserChatId_key" ON "ChatConversation"("telegramUserChatId");
