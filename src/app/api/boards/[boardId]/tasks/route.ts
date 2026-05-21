// GET /api/boards/:boardId/tasks?status=<HermesStatus> — список задач.
// Без `status` — все задачи доски.

import { prisma } from "@/lib/db";
import { requireBearer, jsonResponse } from "@/lib/agent-auth";
import { cardToTask } from "@/lib/agent-tasks";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ boardId: string }>;
}

export async function GET(req: Request, ctx: RouteCtx) {
  const authErr = requireBearer(req);
  if (authErr) return authErr;

  const { boardId } = await ctx.params;
  const status = new URL(req.url).searchParams.get("status");

  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { id: true } });
  if (!board) return jsonResponse(404, { error: "Доска не найдена" });

  const cards = await prisma.card.findMany({
    where: {
      column: { boardId, ...(status ? { name: status } : {}) },
    },
    include: { column: true },
    orderBy: { createdAt: "asc" },
  });

  return jsonResponse(200, cards.map(cardToTask));
}
