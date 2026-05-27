"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { keysBetween } from "@/lib/ordering";
import type { BoardDTO, ColumnDTO, CardDTO } from "@/types/board";

const DEFAULT_COLUMNS: { name: string; color: string }[] = [
  { name: "To Do", color: "#94a3b8" },
  { name: "In Progress", color: "#3b82f6" },
  { name: "Done", color: "#22c55e" },
];

async function ensureBoardForUser(userId: string): Promise<string> {
  const existing = await prisma.board.findFirst({ where: { userId } });
  if (existing) return existing.id;

  const created = await prisma.board.create({
    data: { userId, name: "My Board" },
  });

  const orders = keysBetween(null, null, DEFAULT_COLUMNS.length);
  await prisma.column.createMany({
    data: DEFAULT_COLUMNS.map((c, i) => ({
      boardId: created.id,
      name: c.name,
      color: c.color,
      sortOrder: orders[i],
    })),
  });

  return created.id;
}

export async function getBoard(): Promise<BoardDTO> {
  const user = await requireUser();
  const boardId = await ensureBoardForUser(user.id);

  const board = await prisma.board.findUniqueOrThrow({
    where: { id: boardId },
    include: {
      columns: {
        orderBy: { sortOrder: "asc" },
        include: {
          cards: {
            orderBy: { sortOrder: "asc" },
            include: {
              comments: { orderBy: { createdAt: "asc" } },
              attachments: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      },
    },
  });

  const columns: ColumnDTO[] = board.columns.map((col) => ({
    id: col.id,
    boardId: col.boardId,
    name: col.name,
    color: col.color,
    sortOrder: col.sortOrder,
    wipLimit: col.wipLimit,
    cards: col.cards.map<CardDTO>((card) => ({
      id: card.id,
      columnId: card.columnId,
      title: card.title,
      body: card.body,
      sortOrder: card.sortOrder,
      isSystem: card.isSystem,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
      comments: card.comments.map((c) => ({
        id: c.id,
        cardId: c.cardId,
        text: c.text,
        authorName: c.authorName,
        authorId: c.authorId,
        createdAt: c.createdAt.toISOString(),
      })),
      attachments: card.attachments.map((a) => ({
        id: a.id,
        cardId: a.cardId,
        filename: a.filename,
        url: a.url,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt.toISOString(),
      })),
    })),
  }));

  return { id: board.id, name: board.name, columns };
}
