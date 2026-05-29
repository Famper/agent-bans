"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { resolveSharedBoardId } from "@/lib/shared-board";
import { publishEvent } from "@/lib/events";

async function assertSharedCard(cardId: string) {
  const sharedId = await resolveSharedBoardId();
  if (!sharedId) throw new Error("FORBIDDEN");
  const card = await prisma.card.findFirst({
    where: { id: cardId, column: { boardId: sharedId } },
    select: { id: true, projectId: true, column: { select: { boardId: true, name: true } } },
  });
  if (!card) throw new Error("FORBIDDEN");
  return card;
}

async function assertSharedComment(commentId: string) {
  const sharedId = await resolveSharedBoardId();
  if (!sharedId) throw new Error("FORBIDDEN");
  const c = await prisma.comment.findFirst({
    where: { id: commentId, card: { column: { boardId: sharedId } } },
    select: { id: true },
  });
  if (!c) throw new Error("FORBIDDEN");
}

const addSchema = z.object({
  cardId: z.string().min(1),
  text: z.string().trim().min(1).max(5000),
});

export async function addComment(input: z.infer<typeof addSchema>) {
  const user = await requireUser();
  const parsed = addSchema.parse(input);
  const card = await assertSharedCard(parsed.cardId);

  const created = await prisma.comment.create({
    data: {
      cardId: parsed.cardId,
      text: parsed.text,
      authorId: user.id,
      authorName: user.name ?? user.email,
    },
  });
  revalidatePath("/");

  // Событие для агентов: TL ответил в треде — агент сможет прочитать и продолжить.
  await publishEvent({
    type: "comment.added",
    boardId: card.column.boardId,
    taskId: card.id,
    status: card.column.name,
    agentId: user.name ?? user.email,
    projectId: card.projectId,
  });

  return created;
}

export async function deleteComment(id: string) {
  await requireUser();
  await assertSharedComment(id);
  await prisma.comment.delete({ where: { id } });
  revalidatePath("/");
}
