// Хелперы для Hermes REST API: маппинг Card ⇄ HermesTask, статус ⇄ колонка.
//
// Card.column.name выступает источником истины для статуса — это позволяет
// тимлиду двигать карточки drag-and-drop'ом, и агенты увидят новый статус.

import type { Card, Column, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { keyBetween } from "./ordering";

export type HermesStatus =
  | "Incoming"
  | "Architect"
  | "AwaitingTLApproval"
  | "Development"
  | "Testing"
  | "TLDecision"
  | "Done"
  | "Rejected"
  | "Blocked";

export const HERMES_STATUSES: HermesStatus[] = [
  "Incoming",
  "Architect",
  "AwaitingTLApproval",
  "Development",
  "Testing",
  "TLDecision",
  "Done",
  "Rejected",
  "Blocked",
];

const STATUS_COLORS: Record<HermesStatus, string> = {
  Incoming: "#94a3b8",
  Architect: "#a855f7",
  AwaitingTLApproval: "#eab308",
  Development: "#3b82f6",
  Testing: "#06b6d4",
  TLDecision: "#f97316",
  Done: "#22c55e",
  Rejected: "#ef4444",
  Blocked: "#dc2626",
};

export interface HermesTaskDTO {
  id: string;
  title: string;
  description: string;
  type: string;
  complexity: string;
  status: string;
  parentId?: string;
  agentId?: string;
  model?: string;
  iterations: number;
  maxIterations: number;
  costUsd: number;
  maxCostUsd: number;
  prUrl?: string;
  errorLog?: string;
  notionCardId?: string;
  notionTlNotified?: boolean;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

type CardWithColumn = Card & { column: Column };

export function cardToTask(card: CardWithColumn): HermesTaskDTO {
  return {
    id: card.id,
    title: card.title,
    description: card.body,
    type: card.agentType ?? "bugfix",
    complexity: card.agentComplexity ?? "simple",
    status: card.column.name,
    parentId: card.parentCardId ?? undefined,
    agentId: card.agentId ?? undefined,
    model: card.model ?? undefined,
    iterations: card.iterations,
    maxIterations: card.maxIterations,
    costUsd: card.costUsd,
    maxCostUsd: card.maxCostUsd,
    prUrl: card.prUrl ?? undefined,
    errorLog: card.errorLog ?? undefined,
    notionCardId: card.notionCardId ?? undefined,
    notionTlNotified: card.notionTlNotified ? true : undefined,
    projectId: card.projectId ?? "",
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

// Возвращает колонку с заданным именем (= статусом). Создаёт, если нет.
// Цвет берётся из STATUS_COLORS если имя — известный статус Hermes.
export async function ensureColumnByName(
  tx: Prisma.TransactionClient | typeof prisma,
  boardId: string,
  name: string,
): Promise<Column> {
  const existing = await tx.column.findUnique({
    where: { boardId_name: { boardId, name } },
  });
  if (existing) return existing;

  const last = await tx.column.findFirst({
    where: { boardId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const color = STATUS_COLORS[name as HermesStatus] ?? "#4f86ff";
  const sortOrder = keyBetween(last?.sortOrder ?? null, null);

  return tx.column.create({
    data: { boardId, name, color, sortOrder },
  });
}

// Бросает 404 если карточка не найдена.
export async function getCardWithColumn(id: string): Promise<CardWithColumn | null> {
  return prisma.card.findUnique({
    where: { id },
    include: { column: true },
  });
}

// camelCase → колонки Prisma. Используется в PATCH /api/tasks/:id.
// `status` обрабатывается отдельно (миграция между колонками).
// Тип Record<string, string>, потому что parentCardId не входит в CardUpdateInput
// (доступен только через UncheckedUpdateInput, но Prisma его примет).
export const HERMES_FIELD_MAP: Record<string, string> = {
  title: "title",
  description: "body",
  type: "agentType",
  complexity: "agentComplexity",
  agentId: "agentId",
  model: "model",
  iterations: "iterations",
  maxIterations: "maxIterations",
  costUsd: "costUsd",
  maxCostUsd: "maxCostUsd",
  prUrl: "prUrl",
  errorLog: "errorLog",
  notionCardId: "notionCardId",
  notionTlNotified: "notionTlNotified",
  projectId: "projectId",
  parentId: "parentCardId",
};
