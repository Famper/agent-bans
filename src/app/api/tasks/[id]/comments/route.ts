// GET  /api/tasks/:id/comments — прочитать тред комментариев (агент читает ответы TL).
//   Query: ?since=<ISO> — вернуть только комментарии новее указанного времени.
// POST /api/tasks/:id/comments — добавить комментарий.
//   Тело: { agentId, text }. `agentId` сохраняется в Comment.authorName, чтобы тимлид видел кто писал.

import { prisma } from "@/lib/db";
import { requireBearer, readJson, jsonResponse, BadRequest } from "@/lib/agent-auth";
import { publishEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: RouteCtx) {
  const authErr = requireBearer(req);
  if (authErr) return authErr;

  const { id } = await ctx.params;

  const card = await prisma.card.findUnique({ where: { id }, select: { id: true } });
  if (!card) return jsonResponse(404, { error: "Задача не найдена" });

  const sinceRaw = new URL(req.url).searchParams.get("since");
  let since: Date | undefined;
  if (sinceRaw) {
    const d = new Date(sinceRaw);
    if (!Number.isNaN(d.getTime())) since = d;
  }

  const comments = await prisma.comment.findMany({
    where: { cardId: id, ...(since ? { createdAt: { gt: since } } : {}) },
    orderBy: { createdAt: "asc" },
  });

  return jsonResponse(
    200,
    comments.map((c) => ({
      id: c.id,
      taskId: c.cardId,
      agentId: c.authorName ?? null,
      authorId: c.authorId ?? null,
      text: c.text,
      createdAt: c.createdAt.toISOString(),
    })),
  );
}

export async function POST(req: Request, ctx: RouteCtx) {
  const authErr = requireBearer(req);
  if (authErr) return authErr;

  try {
    const { id } = await ctx.params;
    const body = await readJson(req);
    const agentId = typeof body.agentId === "string" ? body.agentId : "";
    const text = typeof body.text === "string" ? body.text : "";

    if (!agentId || !text) {
      return jsonResponse(400, { error: "agentId и text обязательны" });
    }

    const card = await prisma.card.findUnique({
      where: { id },
      select: { id: true, projectId: true, column: { select: { boardId: true, name: true } } },
    });
    if (!card) return jsonResponse(404, { error: "Задача не найдена" });

    const created = await prisma.comment.create({
      data: { cardId: id, authorName: agentId, text },
    });

    await publishEvent({
      type: "comment.added",
      boardId: card.column.boardId,
      taskId: card.id,
      status: card.column.name,
      agentId,
      projectId: card.projectId,
    });

    return jsonResponse(201, {
      id: created.id,
      taskId: created.cardId,
      agentId: created.authorName ?? agentId,
      text: created.text,
      createdAt: created.createdAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof BadRequest) return jsonResponse(400, { error: err.message });
    console.error("POST /api/tasks/:id/comments", err);
    return jsonResponse(500, { error: "Внутренняя ошибка сервера" });
  }
}
