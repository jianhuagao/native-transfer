import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const UPLOAD_DIR = path.join(process.cwd(), "storage", "uploads");

export type StoredImage = {
  id: string;
  name: string;
  url: string;
  originalUrl: string;
  uploadedAt: string;
  uploadedAtLabel: string;
  size: number;
};

const MIME_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function formatStamp(date: Date) {
  return [
    date.getFullYear().toString(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    "-",
    date.getMilliseconds().toString().padStart(3, "0"),
  ].join("");
}

function formatLabel(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function sanitizeBaseName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function getMimeType(fileName: string) {
  return MIME_TYPES[path.extname(fileName).toLowerCase()] ?? "application/octet-stream";
}

export async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

export async function saveUpload(file: File) {
  await ensureUploadDir();

  const now = new Date();
  const originalName = file.name || "image";
  const extension = path.extname(originalName).toLowerCase() || ".jpg";
  const baseName = sanitizeBaseName(path.basename(originalName, extension)) || "image";
  const safeFileName = `${formatStamp(now)}-${baseName}${extension}`;
  const filePath = path.join(UPLOAD_DIR, safeFileName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(filePath, buffer);

  return safeFileName;
}

export async function listImages(): Promise<StoredImage[]> {
  await ensureUploadDir();

  const entries = await readdir(UPLOAD_DIR, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const filePath = path.join(UPLOAD_DIR, entry.name);
        const details = await stat(filePath);
        const uploadedAt = details.birthtimeMs > 0 ? new Date(details.birthtimeMs) : details.mtime;

        return {
          id: entry.name,
          name: entry.name,
          url: `/api/images/${encodeURIComponent(entry.name)}`,
          originalUrl: `/api/images/${encodeURIComponent(entry.name)}`,
          uploadedAt: uploadedAt.toISOString(),
          uploadedAtLabel: formatLabel(uploadedAt),
          size: details.size,
        } satisfies StoredImage;
      })
  );

  return files.sort((left, right) => {
    return new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime();
  });
}

export async function readImage(name: string) {
  const filePath = path.join(UPLOAD_DIR, path.basename(name));
  const buffer = await readFile(filePath);

  return {
    buffer,
    fileName: path.basename(filePath),
    mimeType: getMimeType(filePath),
  };
}

export async function removeImage(name: string) {
  const filePath = path.join(UPLOAD_DIR, path.basename(name));
  await rm(filePath, { force: true });
}
