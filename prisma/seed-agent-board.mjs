// Bootstrap для агентского борда. Запуск: `npm run db:seed:agent-board`.
//
// Создаёт системного пользователя + доску с фиксированным id (из env AGENT_BOARD_ID),
// плюс все Hermes-колонки. Идемпотентно — повторный запуск ничего не сломает.
//
// Используется ai-revolution: agent'ы видят эту доску через HERMES_BOARD_ID.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

// sortOrder задан явно (не индексом): иначе при 11+ колонках "a10" лексикографически
// уходит раньше "a2" и порядок ломается. Draft — "Z0" (Z < a) ставит его самым левым,
// агенты его НЕ опрашивают: задачу сочиняют тут, в Incoming тянут готовой. Набор
// синхронизирован с ai-revolution (docker/scripts/multi-tenant-guardian.mjs).
const STATUSES = [
  { name: "Draft",              color: "#64748b", sortOrder: "Z0" },
  { name: "Incoming",           color: "#94a3b8", sortOrder: "a0" },
  { name: "Architect",          color: "#a855f7", sortOrder: "a1" },
  { name: "AwaitingTLApproval", color: "#eab308", sortOrder: "a2" },
  { name: "Development",        color: "#3b82f6", sortOrder: "a3" },
  { name: "Testing",            color: "#06b6d4", sortOrder: "a4" },
  { name: "Review",             color: "#a78bfa", sortOrder: "a45" },
  { name: "TLDecision",         color: "#f97316", sortOrder: "a5" },
  { name: "Done",               color: "#22c55e", sortOrder: "a6" },
  { name: "Rejected",           color: "#ef4444", sortOrder: "a7" },
  { name: "Blocked",            color: "#dc2626", sortOrder: "a8" },
];

async function main() {
  const email = process.env.AGENT_BOARD_OWNER_EMAIL ?? "agent-bot@local";
  const boardId = process.env.AGENT_BOARD_ID;
  const boardName = process.env.AGENT_BOARD_NAME ?? "AI Revolution";

  // 1. Системный пользователь (паролем не пользуется — Auth.js его не пустит без email-логина).
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Agent Bot", passwordHash },
  });

  // 2. Доска. Если AGENT_BOARD_ID задан — используем его как id, иначе берём существующую или создаём новую.
  let board;
  if (boardId) {
    board = await prisma.board.upsert({
      where: { id: boardId },
      update: { name: boardName },
      create: { id: boardId, userId: user.id, name: boardName },
    });
  } else {
    board = await prisma.board.findFirst({ where: { userId: user.id, name: boardName } });
    if (!board) {
      board = await prisma.board.create({ data: { userId: user.id, name: boardName } });
    }
  }

  // 3. Колонки под Hermes-статусы.
  for (const s of STATUSES) {
    await prisma.column.upsert({
      where: { boardId_name: { boardId: board.id, name: s.name } },
      update: { color: s.color, sortOrder: s.sortOrder },
      create: {
        boardId: board.id,
        name: s.name,
        color: s.color,
        sortOrder: s.sortOrder,
      },
    });
  }

  console.log(`Agent board ready.`);
  console.log(`  owner: ${user.email} (${user.id})`);
  console.log(`  board id: ${board.id}`);
  console.log(`  board name: ${board.name}`);
  console.log(`Set HERMES_BOARD_ID=${board.id} in ai-revolution .env.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
