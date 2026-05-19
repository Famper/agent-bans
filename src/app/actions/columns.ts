"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { keyBetween } from "@/lib/ordering";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Цвет должен быть в формате #RRGGBB");

async function userOwnsBoard(boardId: string, userId: string) {
  const board = await prisma.board.findFirst({
    where: { id: boardId, userId },
    select: { id: true },
  });
  if (!board) throw new Error("FORBIDDEN");
}

async function userOwnsColumn(columnId: string, userId: string) {
  const column = await prisma.column.findFirst({
    where: { id: columnId, board: { userId } },
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

export async function createColumn(input: z.infer<typeof createSchema>) {
  const user = await requireUser();
  const parsed = createSchema.parse(input);
  await userOwnsBoard(parsed.boardId, user.id);

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
  return created;
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  color: hexColor.optional(),
  wipLimit: z.number().int().positive().nullable().optional(),
});

export async function updateColumn(input: z.infer<typeof updateSchema>) {
  const user = await requireUser();
  const parsed = updateSchema.parse(input);
  await userOwnsColumn(parsed.id, user.id);

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
  const user = await requireUser();
  const parsed = moveSchema.parse(input);
  await userOwnsColumn(parsed.id, user.id);

  await prisma.column.update({
    where: { id: parsed.id },
    data: { sortOrder: parsed.sortOrder },
  });
  revalidatePath("/");
}

export async function deleteColumn(id: string) {
  const user = await requireUser();
  await userOwnsColumn(id, user.id);
  await prisma.column.delete({ where: { id } });
  revalidatePath("/");
}
