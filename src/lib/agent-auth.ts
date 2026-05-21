// Bearer-token авторизация для REST API агентов (`/api/tasks`, `/api/boards/*`).
// Контракт совместим с kanban-server из ai-revolution: заголовок `Authorization: Bearer <KANBAN_API_KEY>`.

const API_KEY = process.env.KANBAN_API_KEY;

export function requireBearer(req: Request): Response | null {
  if (!API_KEY) return null; // dev-режим без ключа — пропускаем
  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${API_KEY}`) return null;
  return jsonResponse(401, { error: "Unauthorized" });
}

export function jsonResponse(status: number, body?: unknown): Response {
  if (status === 204 || body === undefined) {
    return new Response(null, { status });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new BadRequest("Некорректный JSON");
  }
}

export class BadRequest extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequest";
  }
}
