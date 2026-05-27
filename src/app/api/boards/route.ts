// GET  /api/boards?name=<optional> — список досок (для воркеров: все "AI Revolution").
// POST /api/boards — создать доску с колонками за один вызов (идемпотентно по owner+name).
//
// Закрывает прямой Prisma-доступ внешних сервисов к БД: раньше multi-tenant
// сервис создавал доски напрямую через Prisma и публиковал список через файл.

import { prisma } from "@/lib/db";
import { keysBetween } from "@/lib/ordering";
import { requireBearer, readJson, jsonResponse, BadRequest } from "@/lib/agent-auth";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

interface BoardColumnInput {
  name: string;
  color?: string;
  sortOrder?: string;
}

export async function GET(req: Request) {
  const authErr = requireBearer(req);
  if (authErr) return authErr;

  const name = new URL(req.url).searchParams.get("name");

  const boards = await prisma.board.findMany({
    where: name ? { name } : undefined,
    select: {
      id: true,
      name: true,
      userId: true,
      createdAt: true,
      user: { select: { email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return jsonResponse(
    200,
    boards.map((b) => ({
      id: b.id,
      name: b.name,
      userId: b.userId,
      ownerEmail: b.user?.email ?? null,
      createdAt: b.createdAt.toISOString(),
    })),
  );
}

export async function POST(req: Request) {
  const authErr = requireBearer(req);
  if (authErr) return authErr;

  try {
    const body = await readJson(req);

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return jsonResponse(400, { error: "name обязателен" });

    const userId = typeof body.userId === "string" ? body.userId : undefined;
    const ownerEmail = typeof body.ownerEmail === "string" ? body.ownerEmail : undefined;
    const fixedId = typeof body.id === "string" ? body.id : undefined;

    const rawColumns = Array.isArray(body.columns) ? body.columns : [];
    const columns: BoardColumnInput[] = rawColumns
      .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
      .map((c) => ({
        name: typeof c.name === "string" ? c.name.trim() : "",
        color: typeof c.color === "string" ? c.color : undefined,
        sortOrder: typeof c.sortOrder === "string" ? c.sortOrder : undefined,
      }))
      .filter((c) => c.name.length > 0);

    // Резолв владельца: по userId, иначе по email. Пользователя НЕ создаём.
    let resolvedUserId = userId;
    if (!resolvedUserId && ownerEmail) {
      const user = await prisma.user.findUnique({
        where: { email: ownerEmail },
        select: { id: true },
      });
      if (!user) {
        return jsonResponse(400, { error: `Пользователь не найден: ${ownerEmail}` });
      }
      resolvedUserId = user.id;
    }
    if (!resolvedUserId) {
      return jsonResponse(400, { error: "userId или ownerEmail обязателен" });
    }

    // Идемпотентность: доска с таким именем у владельца уже есть — вернуть её.
    const existing = await prisma.board.findFirst({
      where: { userId: resolvedUserId, name },
      include: {
        columns: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, color: true, sortOrder: true } },
        user: { select: { email: true } },
      },
    });
    if (existing) {
      return jsonResponse(200, {
        id: existing.id,
        name: existing.name,
        userId: existing.userId,
        ownerEmail: existing.user?.email ?? null,
        columns: existing.columns,
      });
    }

    // sortOrder для колонок без явного значения — генерируем по порядку.
    const generated = columns.length > 0 ? keysBetween(null, null, columns.length) : [];

    const created = await prisma.$transaction(async (tx) => {
      const board = await tx.board.create({
        data: {
          ...(fixedId ? { id: fixedId } : {}),
          userId: resolvedUserId!,
          name,
        },
      });

      if (columns.length > 0) {
        const data: Prisma.ColumnCreateManyInput[] = columns.map((c, i) => ({
          boardId: board.id,
          name: c.name,
          color: c.color ?? "#4f86ff",
          sortOrder: c.sortOrder ?? generated[i],
        }));
        await tx.column.createMany({ data });
      }

      return tx.board.findUniqueOrThrow({
        where: { id: board.id },
        include: {
          columns: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, color: true, sortOrder: true } },
          user: { select: { email: true } },
        },
      });
    });

    return jsonResponse(201, {
      id: created.id,
      name: created.name,
      userId: created.userId,
      ownerEmail: created.user?.email ?? null,
      columns: created.columns,
    });
  } catch (err) {
    if (err instanceof BadRequest) return jsonResponse(400, { error: err.message });
    console.error("POST /api/boards", err);
    return jsonResponse(500, { error: "Внутренняя ошибка сервера" });
  }
}
