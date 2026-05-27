// GET    /api/tasks/:id — получить задачу.
// PATCH  /api/tasks/:id — обновить поля задачи. Если приходит `status` — карточка
// перемещается в колонку с этим именем (создаётся, если её нет).

import { prisma } from "@/lib/db";
import { keyBetween } from "@/lib/ordering";
import { requireBearer, readJson, jsonResponse, BadRequest } from "@/lib/agent-auth";
import {
  cardToTask,
  ensureColumnByName,
  getCardWithColumn,
  HERMES_FIELD_MAP,
} from "@/lib/agent-tasks";
import { publishEvent } from "@/lib/events";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: RouteCtx) {
  const authErr = requireBearer(req);
  if (authErr) return authErr;

  const { id } = await ctx.params;
  const card = await getCardWithColumn(id);
  if (!card) return jsonResponse(404, { error: "Задача не найдена" });
  return jsonResponse(200, cardToTask(card));
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const authErr = requireBearer(req);
  if (authErr) return authErr;

  try {
    const { id } = await ctx.params;
    const body = await readJson(req);

    const existing = await getCardWithColumn(id);
    if (!existing) return jsonResponse(404, { error: "Задача не найдена" });

    const data: Prisma.CardUpdateInput = {};
    for (const [key, value] of Object.entries(body)) {
      if (key === "status") continue; // обрабатывается отдельно
      const field = HERMES_FIELD_MAP[key];
      if (!field) continue;
      (data as Record<string, unknown>)[field as string] = value;
    }

    const targetStatus =
      typeof body.status === "string" && body.status !== existing.column.name
        ? body.status
        : null;

    const updated = await prisma.$transaction(async (tx) => {
      if (targetStatus) {
        const column = await ensureColumnByName(tx, existing.column.boardId, targetStatus);
        const last = await tx.card.findFirst({
          where: { columnId: column.id },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });
        data.column = { connect: { id: column.id } };
        data.sortOrder = keyBetween(last?.sortOrder ?? null, null);
      }
      return tx.card.update({
        where: { id },
        data,
        include: { column: true },
      });
    });

    await publishEvent({
      type: targetStatus ? "card.moved" : "card.updated",
      boardId: updated.column.boardId,
      taskId: updated.id,
      status: updated.column.name,
      prevStatus: targetStatus ? existing.column.name : undefined,
      agentId: updated.agentId,
      projectId: updated.projectId,
      isSystem: updated.isSystem,
    });

    return jsonResponse(200, cardToTask(updated));
  } catch (err) {
    if (err instanceof BadRequest) return jsonResponse(400, { error: err.message });
    console.error("PATCH /api/tasks/:id", err);
    return jsonResponse(500, { error: "Внутренняя ошибка сервера" });
  }
}
