"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { resolveSharedBoardId } from "@/lib/shared-board";
import { saveImageFile, deleteStoredFile, UploadError } from "@/lib/uploads";
import type { AttachmentDTO } from "@/types/board";

async function assertSharedCard(cardId: string) {
  const sharedId = await resolveSharedBoardId();
  if (!sharedId) throw new Error("FORBIDDEN");
  const card = await prisma.card.findFirst({
    where: { id: cardId, column: { boardId: sharedId } },
    select: { id: true },
  });
  if (!card) throw new Error("FORBIDDEN");
}

async function assertSharedAttachment(attachmentId: string) {
  const sharedId = await resolveSharedBoardId();
  if (!sharedId) throw new Error("FORBIDDEN");
  const a = await prisma.attachment.findFirst({
    where: { id: attachmentId, card: { column: { boardId: sharedId } } },
    select: { id: true, storedAs: true },
  });
  if (!a) throw new Error("FORBIDDEN");
  return a;
}

export type UploadResult =
  | { ok: true; attachment: AttachmentDTO }
  | { ok: false; error: string };

export async function uploadAttachment(formData: FormData): Promise<UploadResult> {
  await requireUser();
  const cardId = String(formData.get("cardId") ?? "");
  const file = formData.get("file");

  if (!cardId) return { ok: false, error: "cardId required" };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Файл не выбран" };
  }

  try {
    await assertSharedCard(cardId);
    const saved = await saveImageFile(file);
    const created = await prisma.attachment.create({
      data: {
        cardId,
        filename: saved.filename,
        storedAs: saved.storedAs,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        url: saved.url,
      },
    });
    revalidatePath("/");
    return {
      ok: true,
      attachment: {
        id: created.id,
        cardId: created.cardId,
        filename: created.filename,
        url: created.url,
        mimeType: created.mimeType,
        sizeBytes: created.sizeBytes,
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch (err) {
    if (err instanceof UploadError) return { ok: false, error: err.message };
    if ((err as Error).message === "FORBIDDEN") return { ok: false, error: "Нет доступа" };
    console.error("uploadAttachment failed:", err);
    return { ok: false, error: "Не удалось загрузить файл" };
  }
}

export async function deleteAttachment(id: string): Promise<void> {
  await requireUser();
  const found = await assertSharedAttachment(id);
  await prisma.attachment.delete({ where: { id } });
  await deleteStoredFile(found.storedAs);
  revalidatePath("/");
}
