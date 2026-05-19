import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { UPLOAD_DIR } from "@/lib/uploads";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ file: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { file } = await context.params;
  const safe = path.basename(file);
  if (safe !== file) {
    return new Response("Not found", { status: 404 });
  }

  const attachment = await prisma.attachment.findFirst({
    where: {
      storedAs: safe,
      card: { column: { board: { userId: session.user.id } } },
    },
    select: { id: true },
  });
  if (!attachment) {
    return new Response("Not found", { status: 404 });
  }

  const dest = path.join(UPLOAD_DIR, safe);
  try {
    const data = await fs.readFile(dest);
    const ext = path.extname(safe).toLowerCase();
    const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";

    const body = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(data.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response("Not found", { status: 404 });
    }
    console.error("upload read failed:", err);
    return new Response("Server error", { status: 500 });
  }
}
