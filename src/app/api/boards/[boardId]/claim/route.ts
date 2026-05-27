// POST /api/boards/:boardId/claim — атомарно захватить задачу из статуса.
// Тело: { fromStatus, agentId }. Возвращает 200 с задачей или 204 если задач нет.
//
// Атомарность гарантируется Prisma-транзакцией (SQLite сериализует writes).
// Берётся самая ранняя по createdAt карточка в нужной колонке, у которой agentId IS NULL.

import { prisma } from "@/lib/db";
import { requireBearer, readJson, jsonResponse, BadRequest } from "@/lib/agent-auth";
import { cardToTask } from "@/lib/agent-tasks";
import { publishEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ boardId: string }>;
}

export async function POST(req: Request, ctx: RouteCtx) {
  const authErr = requireBearer(req);
  if (authErr) return authErr;

  try {
    const { boardId } = await ctx.params;
    const body = await readJson(req);
    const fromStatus = typeof body.fromStatus === "string" ? body.fromStatus : "";
    const agentId = typeof body.agentId === "string" ? body.agentId : "";

    if (!fromStatus || !agentId) {
      return jsonResponse(400, { error: "fromStatus и agentId обязательны" });
    }

    const claimed = await prisma.$transaction(async (tx) => {
      const candidate = await tx.card.findFirst({
        where: {
          agentId: null,
          isSystem: false,
          column: { boardId, name: fromStatus },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (!candidate) return null;

      // Проверка через updateMany защищает от гонок: если другой воркер успел
      // захватить эту же карточку, обновление с условием agentId IS NULL вернёт count=0.
      const result = await tx.card.updateMany({
        where: { id: candidate.id, agentId: null, isSystem: false },
        data: { agentId },
      });
      if (result.count === 0) return null;

      return tx.card.findUnique({
        where: { id: candidate.id },
        include: { column: true },
      });
    });

    if (!claimed) return jsonResponse(204);

    await publishEvent({
      type: "card.claimed",
      boardId: claimed.column.boardId,
      taskId: claimed.id,
      status: claimed.column.name,
      agentId: claimed.agentId,
      projectId: claimed.projectId,
      isSystem: claimed.isSystem,
    });

    return jsonResponse(200, cardToTask(claimed));
  } catch (err) {
    if (err instanceof BadRequest) return jsonResponse(400, { error: err.message });
    console.error("POST /api/boards/:boardId/claim", err);
    return jsonResponse(500, { error: "Внутренняя ошибка сервера" });
  }
}
