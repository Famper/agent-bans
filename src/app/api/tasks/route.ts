// POST /api/tasks — создать задачу (Hermes-совместимый эндпойнт).
//
// Тело: { title, description?, type?, complexity?, status?, parentId?, projectId, boardId? }
// boardId либо передаётся явно, либо берётся из parentId.

import { prisma } from "@/lib/db";
import { keyBetween } from "@/lib/ordering";
import { requireBearer, readJson, jsonResponse, BadRequest } from "@/lib/agent-auth";
import { cardToTask, ensureColumnByName } from "@/lib/agent-tasks";
import { publishEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authErr = requireBearer(req);
  if (authErr) return authErr;

  try {
    const body = await readJson(req);

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!title || !projectId) {
      return jsonResponse(400, { error: "title и projectId обязательны" });
    }

    const description = typeof body.description === "string" ? body.description : "";
    const type = typeof body.type === "string" ? body.type : "bugfix";
    const complexity = typeof body.complexity === "string" ? body.complexity : "simple";
    const status = typeof body.status === "string" ? body.status : "Incoming";
    const isSystem = body.isSystem === true;
    const parentId = typeof body.parentId === "string" ? body.parentId : undefined;
    let boardId = typeof body.boardId === "string" ? body.boardId : undefined;

    if (!boardId && parentId) {
      const parent = await prisma.card.findUnique({
        where: { id: parentId },
        select: { column: { select: { boardId: true } } },
      });
      if (!parent) return jsonResponse(400, { error: "parentId не найден" });
      boardId = parent.column.boardId;
    }
    if (!boardId) {
      return jsonResponse(400, { error: "boardId или parentId обязательны" });
    }

    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) return jsonResponse(404, { error: "Доска не найдена" });

    const created = await prisma.$transaction(async (tx) => {
      const column = await ensureColumnByName(tx, boardId!, status);
      const last = await tx.card.findFirst({
        where: { columnId: column.id },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      const sortOrder = keyBetween(last?.sortOrder ?? null, null);

      const card = await tx.card.create({
        data: {
          columnId: column.id,
          title,
          body: description,
          sortOrder,
          agentType: type,
          agentComplexity: complexity,
          parentCardId: parentId ?? null,
          projectId,
          isSystem,
        },
        include: { column: true },
      });
      return card;
    });

    await publishEvent({
      type: "card.created",
      boardId: created.column.boardId,
      taskId: created.id,
      status: created.column.name,
      projectId: created.projectId,
      isSystem: created.isSystem,
    });

    return jsonResponse(201, cardToTask(created));
  } catch (err) {
    if (err instanceof BadRequest) return jsonResponse(400, { error: err.message });
    console.error("POST /api/tasks", err);
    return jsonResponse(500, { error: "Внутренняя ошибка сервера" });
  }
}
