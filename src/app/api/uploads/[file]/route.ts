import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { UPLOAD_DIR } from "@/lib/uploads";

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
  const { file } = await context.params;
  const safe = path.basename(file);
  if (safe !== file) {
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
        "Cache-Control": "private, max-age=3600",
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
