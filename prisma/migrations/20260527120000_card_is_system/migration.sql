-- AlterTable: add isSystem flag to Card.
-- System cards (welcome/onboarding instructions) stay visible on the board for
-- humans but must never be claimed into the agent pipeline. SQLite supports
-- ALTER TABLE ADD COLUMN, so existing rows pick up the default (false).
ALTER TABLE "Card" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;
