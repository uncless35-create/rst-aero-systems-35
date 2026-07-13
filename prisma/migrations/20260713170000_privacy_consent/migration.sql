ALTER TABLE "User"
  ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "privacyPolicyVersion" TEXT;

ALTER TABLE "Order"
  ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "privacyPolicyVersion" TEXT;

ALTER TABLE "ChatConversation"
  ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "privacyPolicyVersion" TEXT;
