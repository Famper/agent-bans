"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { resolveSharedBoardId } from "@/lib/shared-board";
import { keyBetween } from "@/lib/ordering";
import type { ColumnDTO } from "@/types/board";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Цвет должен быть в формате #RRGGBB");

// Доступ к доске общий для всех залогиненных, но операции должны бить ровно по
// общей доске — orphan-доски (наследие per-user режима) трогать нельзя.
async function assertSharedBoard(boardId: string) {
  const sharedId = await resolveSharedBoardId();
  if (!sharedId || boardId !== sharedId) throw new Error("FORBIDDEN");
}

async function assertSharedColumn(columnId: string) {
  const sharedId = await resolveSharedBoardId();
  if (!sharedId) throw new Error("FORBIDDEN");
  const column = await prisma.column.findFirst({
    where: { id: columnId, boardId: sharedId },
    select: { id: true, boardId: true },
  });
  if (!column) throw new Error("FORBIDDEN");
  return column;
}

const createSchema = z.object({
  boardId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  color: hexColor,
});

export async function createColumn(input: z.infer<typeof createSchema>): Promise<ColumnDTO> {
  await requireUser();
  const parsed = createSchema.parse(input);
  await assertSharedBoard(parsed.boardId);

  const last = await prisma.column.findFirst({
    where: { boardId: parsed.boardId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const sortOrder = keyBetween(last?.sortOrder ?? null, null);

  const created = await prisma.column.create({
    data: {
      boardId: parsed.boardId,
      name: parsed.name,
      color: parsed.color,
      sortOrder,
    },
  });

  revalidatePath("/");
  return {
    id: created.id,
    boardId: created.boardId,
    name: created.name,
    color: created.color,
    sortOrder: created.sortOrder,
    wipLimit: created.wipLimit,
    cards: [],
  };
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  color: hexColor.optional(),
  wipLimit: z.number().int().positive().nullable().optional(),
});

export async function updateColumn(input: z.infer<typeof updateSchema>) {
  await requireUser();
  const parsed = updateSchema.parse(input);
  await assertSharedColumn(parsed.id);

  const updated = await prisma.column.update({
    where: { id: parsed.id },
    data: {
      ...(parsed.name !== undefined && { name: parsed.name }),
      ...(parsed.color !== undefined && { color: parsed.color }),
      ...(parsed.wipLimit !== undefined && { wipLimit: parsed.wipLimit }),
    },
  });
  revalidatePath("/");
  return updated;
}

const moveSchema = z.object({
  id: z.string().min(1),
  sortOrder: z.string().min(1),
});

export async function moveColumn(input: z.infer<typeof moveSchema>) {
  await requireUser();
  const parsed = moveSchema.parse(input);
  await assertSharedColumn(parsed.id);

  await prisma.column.update({
    where: { id: parsed.id },
    data: { sortOrder: parsed.sortOrder },
  });
  revalidatePath("/");
}

export async function deleteColumn(id: string) {
  await requireUser();
  await assertSharedColumn(id);
  await prisma.column.delete({ where: { id } });
  revalidatePath("/");
}
