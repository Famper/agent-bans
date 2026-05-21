-- AlterTable: extend Card with Hermes/agent fields.
-- SQLite supports ALTER TABLE ADD COLUMN, so the existing rows pick up the column defaults.
ALTER TABLE "Card" ADD COLUMN "agentType" TEXT;
ALTER TABLE "Card" ADD COLUMN "agentComplexity" TEXT;
ALTER TABLE "Card" ADD COLUMN "agentId" TEXT;
ALTER TABLE "Card" ADD COLUMN "model" TEXT;
ALTER TABLE "Card" ADD COLUMN "iterations" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Card" ADD COLUMN "maxIterations" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Card" ADD COLUMN "costUsd" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Card" ADD COLUMN "maxCostUsd" REAL NOT NULL DEFAULT 10;
ALTER TABLE "Card" ADD COLUMN "prUrl" TEXT;
ALTER TABLE "Card" ADD COLUMN "errorLog" TEXT;
ALTER TABLE "Card" ADD COLUMN "notionCardId" TEXT;
ALTER TABLE "Card" ADD COLUMN "notionTlNotified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Card" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Card" ADD COLUMN "parentCardId" TEXT REFERENCES "Card" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for agent-driven queries.
CREATE INDEX "Card_projectId_idx" ON "Card" ("projectId");
CREATE INDEX "Card_parentCardId_idx" ON "Card" ("parentCardId");
