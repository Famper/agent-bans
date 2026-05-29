#!/bin/sh
set -e

mkdir -p /data/db /data/uploads

echo "==> prisma migrate deploy"
npx prisma migrate deploy --schema=./prisma/schema.prisma

# Bootstrap агентского борда: если задан AGENT_BOARD_ID — это агентский деплой
# (ai-revolution), создаём доску с Hermes-колонками. Скрипт идемпотентный (upsert),
# безопасно гонять на каждом старте. Без AGENT_BOARD_ID — обычный kanban, пропускаем.
if [ -n "$AGENT_BOARD_ID" ]; then
  echo "==> seed agent board (AGENT_BOARD_ID=$AGENT_BOARD_ID)"
  node prisma/seed-agent-board.mjs
fi

echo "==> starting Next.js"
exec "$@"
