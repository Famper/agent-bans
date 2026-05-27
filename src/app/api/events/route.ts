// GET /api/events — SSE-поток доменных событий доски для браузера.
//
// Подписывается на тот же Redis-канал, что и агенты (agent-bans:events), и
// проксирует события текущему залогиненному пользователю — но только по ЕГО
// доске. Браузер (BoardClient) на каждое событие делает router.refresh(), и
// доска оживает без ручной перезагрузки.
//
// Dual-mode: если REDIS_URL не задан или Redis недоступен — поток всё равно
// открывается и шлёт только heartbeat'ы (никаких событий). Поведение тогда
// деградирует до сегодняшнего (ручной reload), но соединение не падает.

import Redis from "ioredis";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EVENTS_CHANNEL, type AgentEvent } from "@/lib/events";

export const dynamic = "force-dynamic";
// Node-рантайм обязателен: ioredis использует TCP-сокеты (в edge их нет).
export const runtime = "nodejs";

const HEARTBEAT_MS = 25_000;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Доска юзера: события фильтруем по boardId, чтобы не текли чужие доски.
  const board = await prisma.board.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  const boardId = board?.id ?? null;

  const redisUrl = process.env.REDIS_URL;
  const encoder = new TextEncoder();

  let subscriber: Redis | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Контроллер уже закрыт (клиент отвалился) — игнорируем.
        }
      };

      // Стартовый комментарий + ретрай-интервал для EventSource.
      send(`retry: 3000\n: connected\n\n`);
      heartbeat = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS);

      if (redisUrl && boardId) {
        subscriber = new Redis(redisUrl, {
          maxRetriesPerRequest: null,
          retryStrategy: (times) => Math.min(times * 200, 5000),
        });
        subscriber.on("error", (err) => {
          console.error(
            "[events-sse] redis error:",
            err instanceof Error ? err.message : err,
          );
        });
        subscriber.subscribe(EVENTS_CHANNEL, (err) => {
          if (err) {
            console.error("[events-sse] subscribe failed:", err.message);
          }
        });
        subscriber.on("message", (_channel, message) => {
          let ev: AgentEvent;
          try {
            ev = JSON.parse(message) as AgentEvent;
          } catch {
            return;
          }
          if (ev.boardId !== boardId) return; // чужая доска — не наше дело
          send(`data: ${message}\n\n`);
        });
      }

      // Клиент закрыл вкладку / разорвал соединение — чистим ресурсы.
      const onAbort = () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // уже закрыт
        }
      };
      req.signal.addEventListener("abort", onAbort);
    },
    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    if (subscriber) {
      subscriber.disconnect();
      subscriber = null;
    }
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Просим nginx НЕ буферизировать этот ответ (на случай дефолтной буферизации).
      "X-Accel-Buffering": "no",
    },
  });
}
