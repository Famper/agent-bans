import { prisma } from "@/lib/db";

// Колонки для холодного старта — только если в БД нет ни одной доски и общую
// надо создать с нуля. Набор синхронизирован с агентским пайплайном
// ai-revolution (docker/scripts/multi-tenant-guardian.mjs / seed-agent-board.mjs):
// Draft самый левый — sortOrder "Z0" сортируется до "a0" (Z < a), агенты его не
// опрашивают; задачу готовят в Draft и тянут в Incoming.
const DEFAULT_COLUMNS: { name: string; color: string; sortOrder: string }[] = [
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

// Одна общая доска на весь инстанс. Раньше каждому юзеру при первом заходе на
// дашборд создавалась своя — теперь все видят и редактируют одну. Какую именно:
//   1. SHARED_BOARD_ID из env, если задан и доска существует — пин к конкретной
//      доске (для ai-revolution: тот же id, что HERMES_BOARD_ID агентской доски);
//   2. иначе самая ранняя по createdAt — на проде это агентская доска, её сидят
//      на bootstrap'е раньше, чем регистрируется первый человек.
// Ничего не создаёт: только резолв. Возвращает null, если досок нет вообще.
export async function resolveSharedBoardId(): Promise<string | null> {
  const pinned = process.env.SHARED_BOARD_ID?.trim();
  if (pinned) {
    const board = await prisma.board.findUnique({
      where: { id: pinned },
      select: { id: true },
    });
    if (board) return board.id;
  }

  const earliest = await prisma.board.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return earliest?.id ?? null;
}

// То же, что resolveSharedBoardId, но на пустой БД создаёт общую доску с
// дефолтными колонками. Вызывается только из getBoard() — точки входа дашборда.
export async function ensureSharedBoard(bootstrapOwnerId: string): Promise<string> {
  const existing = await resolveSharedBoardId();
  if (existing) return existing;

  const created = await prisma.board.create({
    data: { userId: bootstrapOwnerId, name: "My Board" },
  });

  await prisma.column.createMany({
    data: DEFAULT_COLUMNS.map((c) => ({
      boardId: created.id,
      name: c.name,
      color: c.color,
      sortOrder: c.sortOrder,
    })),
  });

  return created.id;
}
