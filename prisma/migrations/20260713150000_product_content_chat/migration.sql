-- Structured, version-aware product content.
ALTER TABLE "Product"
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "exactVariant" TEXT,
  ADD COLUMN "compatibility" TEXT,
  ADD COLUMN "packageContents" TEXT,
  ADD COLUMN "contentSources" TEXT,
  ADD COLUMN "contentStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "contentReviewNote" TEXT,
  ADD COLUMN "contentVerifiedAt" TIMESTAMP(3);

-- Anonymous and authenticated conversations with the store manager.
CREATE TABLE "ChatConversation" (
  "id" TEXT NOT NULL,
  "publicToken" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "customerName" TEXT,
  "customerContact" TEXT,
  "pagePath" TEXT,
  "userId" TEXT,
  "productId" TEXT,
  "telegramRootMessageId" TEXT,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "sender" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "deliveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "telegramMessageId" TEXT,
  "telegramUpdateId" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatConversation_publicToken_key" ON "ChatConversation"("publicToken");
CREATE INDEX "ChatConversation_status_lastMessageAt_idx" ON "ChatConversation"("status", "lastMessageAt");
CREATE INDEX "ChatConversation_userId_idx" ON "ChatConversation"("userId");
CREATE INDEX "ChatConversation_productId_idx" ON "ChatConversation"("productId");
CREATE UNIQUE INDEX "ChatMessage_telegramMessageId_key" ON "ChatMessage"("telegramMessageId");
CREATE UNIQUE INDEX "ChatMessage_telegramUpdateId_key" ON "ChatMessage"("telegramUpdateId");
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

ALTER TABLE "ChatConversation"
  ADD CONSTRAINT "ChatConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatConversation"
  ADD CONSTRAINT "ChatConversation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatMessage"
  ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
