// Redis pub/sub publisher доменных событий канбана.
//
// Внешние AI-агенты подписываются на канал EVENTS_CHANNEL напрямую и реагируют
// мгновенно (push), вместо polling. Слой полностью ОПЦИОНАЛЕН (dual-mode):
//   - если REDIS_URL не задан — publishEvent это no-op;
//   - любая ошибка Redis ловится и логируется, но НИКОГДА не пробрасывается,
//     чтобы не ломать HTTP-запрос или Server Action.
// Если Redis недоступен, агенты продолжают работать на polling-fallback.

import Redis from "ioredis";

export const EVENTS_CHANNEL = "agent-bans:events";

export type AgentEventType =
  | "card.created"
  | "card.moved"
  | "card.updated"
  | "card.claimed"
  | "card.deleted"
  | "comment.added";

export interface AgentEvent {
  type: AgentEventType;
  boardId: string;
  taskId: string;
  status: string; // имя текущей колонки
  prevStatus?: string; // только для card.moved
  agentId?: string | null;
  projectId?: string | null;
  isSystem?: boolean;
  at: string; // ISO timestamp
}

const REDIS_URL = process.env.REDIS_URL;

// Singleton на globalThis: next dev перезагружает модули, иначе плодятся коннекты.
const globalForRedis = globalThis as unknown as {
  agentBansPublisher?: Redis | null;
};

function getPublisher(): Redis | null {
  if (!REDIS_URL) return null;
  if (globalForRedis.agentBansPublisher !== undefined) {
    return globalForRedis.agentBansPublisher;
  }
  try {
    const client = new Redis(REDIS_URL, {
      // Не копим команды в офлайн-очереди и быстро падаем, если Redis недоступен,
      // — publish тогда сразу отклонится и попадёт в catch ниже (no-op fallback).
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: false,
    });
    client.on("error", (err: unknown) => {
      console.error(
        "[events] redis error:",
        err instanceof Error ? err.message : err,
      );
    });
    globalForRedis.agentBansPublisher = client;
    return client;
  } catch (err) {
    console.error("[events] не смог создать redis-клиент:", err);
    globalForRedis.agentBansPublisher = null;
    return null;
  }
}

export async function publishEvent(
  ev: Omit<AgentEvent, "at"> & { at?: string },
): Promise<void> {
  const client = getPublisher();
  if (!client) return;
  try {
    const payload: AgentEvent = {
      ...ev,
      at: ev.at ?? new Date().toISOString(),
    };
    await client.publish(EVENTS_CHANNEL, JSON.stringify(payload));
  } catch (err) {
    console.error(
      "[events] publish failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
