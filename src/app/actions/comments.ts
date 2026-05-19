"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

async function userOwnsCard(cardId: string, userId: string) {
  const card = await prisma.card.findFirst({
    where: { id: cardId, column: { board: { userId } } },
    select: { id: true },
  });
  if (!card) throw new Error("FORBIDDEN");
}

async function userOwnsComment(commentId: string, userId: string) {
  const c = await prisma.comment.findFirst({
    where: { id: commentId, card: { column: { board: { userId } } } },
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
  await userOwnsCard(parsed.cardId, user.id);

  const created = await prisma.comment.create({
    data: {
      cardId: parsed.cardId,
      text: parsed.text,
      authorId: user.id,
      authorName: user.name ?? user.email,
    },
  });
  revalidatePath("/");
  return created;
}

export async function deleteComment(id: string) {
  const user = await requireUser();
  await userOwnsComment(id, user.id);
  await prisma.comment.delete({ where: { id } });
  revalidatePath("/");
}
