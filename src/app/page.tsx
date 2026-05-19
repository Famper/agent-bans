import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getBoard } from "@/app/actions/board";
import { BoardClient } from "@/components/board/BoardClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const board = await getBoard();
  const userLabel = session.user.name ?? session.user.email ?? "Аккаунт";

  return <BoardClient initialBoard={board} userLabel={userLabel} />;
}
