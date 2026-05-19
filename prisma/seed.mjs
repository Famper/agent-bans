import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  if (process.env.SEED_DEMO_USER !== "1") {
    console.log("SEED_DEMO_USER!=1 — skipping demo user seed.");
    return;
  }

  const email = "demo@example.com";
  const password = "demo1234";
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Demo", passwordHash },
  });

  let board = await prisma.board.findFirst({ where: { userId: user.id } });
  if (!board) {
    board = await prisma.board.create({
      data: { userId: user.id, name: "My Board" },
    });
  }

  const defaults = [
    { name: "To Do", color: "#94a3b8", sortOrder: "a0" },
    { name: "In Progress", color: "#3b82f6", sortOrder: "a1" },
    { name: "Done", color: "#22c55e", sortOrder: "a2" },
  ];

  for (const c of defaults) {
    await prisma.column.upsert({
      where: { boardId_name: { boardId: board.id, name: c.name } },
      update: { color: c.color, sortOrder: c.sortOrder },
      create: { ...c, boardId: board.id },
    });
  }

  console.log(`Seeded demo user: ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
