import { prisma } from "@/lib/db";
import { keysBetween } from "@/lib/ordering";

// Колонки для холодного старта — только если в БД нет ни одной доски и общую
// надо создать с нуля.
const DEFAULT_COLUMNS: { name: string; color: string }[] = [
  { name: "To Do", color: "#94a3b8" },
  { name: "In Progress", color: "#3b82f6" },
  { name: "Done", color: "#22c55e" },
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

  const orders = keysBetween(null, null, DEFAULT_COLUMNS.length);
  await prisma.column.createMany({
    data: DEFAULT_COLUMNS.map((c, i) => ({
      boardId: created.id,
      name: c.name,
      color: c.color,
      sortOrder: orders[i],
    })),
  });

  return created.id;
}
