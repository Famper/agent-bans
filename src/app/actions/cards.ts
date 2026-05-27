"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { keyBetween } from "@/lib/ordering";
import { publishEvent } from "@/lib/events";
import type { CardDTO } from "@/types/board";

async function userOwnsColumn(columnId: string, userId: string) {
  const col = await prisma.column.findFirst({
    where: { id: columnId, board: { userId } },
    select: { id: true, boardId: true, name: true },
  });
  if (!col) throw new Error("FORBIDDEN");
  return col;
}

async function userOwnsCard(cardId: string, userId: string) {
  const card = await prisma.card.findFirst({
    where: { id: cardId, column: { board: { userId } } },
    select: {
      id: true,
      columnId: true,
      projectId: true,
      isSystem: true,
      column: { select: { boardId: true, name: true } },
    },
  });
  if (!card) throw new Error("FORBIDDEN");
  return card;
}

const createSchema = z.object({
  columnId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(50_000).optional(),
});

export async function createCard(input: z.infer<typeof createSchema>): Promise<CardDTO> {
  const user = await requireUser();
  const parsed = createSchema.parse(input);
  await userOwnsColumn(parsed.columnId, user.id);

  const last = await prisma.card.findFirst({
    where: { columnId: parsed.columnId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = keyBetween(last?.sortOrder ?? null, null);

  const created = await prisma.card.create({
    data: {
      columnId: parsed.columnId,
      title: parsed.title,
      body: parsed.body ?? "",
      sortOrder,
    },
  });
  revalidatePath("/");
  return {
    id: created.id,
    columnId: created.columnId,
    title: created.title,
    body: created.body,
    sortOrder: created.sortOrder,
    isSystem: created.isSystem,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
    comments: [],
    attachments: [],
  };
}

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().max(50_000).optional(),
});

export async function updateCard(input: z.infer<typeof updateSchema>) {
  const user = await requireUser();
  const parsed = updateSchema.parse(input);
  const card = await userOwnsCard(parsed.id, user.id);

  const updated = await prisma.card.update({
    where: { id: parsed.id },
    data: {
      ...(parsed.title !== undefined && { title: parsed.title }),
      ...(parsed.body !== undefined && { body: parsed.body }),
    },
  });
  revalidatePath("/");

  // Событие для агентов: TL отредактировал карточку (например, дополнил описание).
  await publishEvent({
    type: "card.updated",
    boardId: card.column.boardId,
    taskId: card.id,
    status: card.column.name,
    projectId: card.projectId,
    isSystem: card.isSystem,
  });

  return updated;
}

const moveSchema = z.object({
  id: z.string().min(1),
  columnId: z.string().min(1),
  sortOrder: z.string().min(1),
});

export async function moveCard(input: z.infer<typeof moveSchema>) {
  const user = await requireUser();
  const parsed = moveSchema.parse(input);
  const card = await userOwnsCard(parsed.id, user.id);
  const targetCol = await userOwnsColumn(parsed.columnId, user.id);

  await prisma.card.update({
    where: { id: parsed.id },
    data: { columnId: parsed.columnId, sortOrder: parsed.sortOrder },
  });
  revalidatePath("/");

  // Событие для агентов: TL перетащил карточку. Если сменилась колонка (статус) —
  // это card.moved с prevStatus, иначе просто переупорядочивание внутри колонки.
  const statusChanged = targetCol.name !== card.column.name;
  await publishEvent({
    type: statusChanged ? "card.moved" : "card.updated",
    boardId: targetCol.boardId,
    taskId: card.id,
    status: targetCol.name,
    prevStatus: statusChanged ? card.column.name : undefined,
    projectId: card.projectId,
    isSystem: card.isSystem,
  });
}

export async function deleteCard(id: string) {
  const user = await requireUser();
  const card = await userOwnsCard(id, user.id);
  await prisma.card.delete({ where: { id } });
  revalidatePath("/");

  await publishEvent({
    type: "card.deleted",
    boardId: card.column.boardId,
    taskId: card.id,
    status: card.column.name,
    projectId: card.projectId,
    isSystem: card.isSystem,
  });
}
