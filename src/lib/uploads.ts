import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const UPLOAD_DIR =
  process.env.UPLOAD_DIR && process.env.UPLOAD_DIR.length > 0
    ? process.env.UPLOAD_DIR
    : path.resolve(process.cwd(), "uploads");

export class UploadError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "UploadError";
  }
}

export async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return "";
  }
}

export interface SavedFile {
  filename: string;
  storedAs: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export async function saveImageFile(file: File): Promise<SavedFile> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new UploadError(`Unsupported file type: ${file.type}`);
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new UploadError(`File too large (>${MAX_SIZE_BYTES / 1024 / 1024} MB)`);
  }
  await ensureUploadDir();

  const ext = extFromMime(file.type) || path.extname(file.name) || "";
  const storedAs = `${randomBytes(16).toString("hex")}${ext}`;
  const dest = path.join(UPLOAD_DIR, storedAs);

  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(dest, buf);

  return {
    filename: file.name || `upload${ext}`,
    storedAs,
    mimeType: file.type,
    sizeBytes: file.size,
    url: `/api/uploads/${storedAs}`,
  };
}

export async function deleteStoredFile(storedAs: string): Promise<void> {
  const safe = path.basename(storedAs);
  const dest = path.join(UPLOAD_DIR, safe);
  try {
    await fs.unlink(dest);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`deleteStoredFile failed for ${safe}:`, err);
    }
  }
}

export function resolveStoredPath(filename: string): string {
  const safe = path.basename(filename);
  return path.join(UPLOAD_DIR, safe);
}

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}
