import { del, get, list, put, type BlobAccessType } from "@vercel/blob";
import path from "node:path";
import { createPreviewToken } from "@/app/_lib/auth";
import {
  getDefaultExtension,
  getMediaKind,
  getMediaMimeType,
  type MediaKind,
} from "@/app/_lib/media";

export type StoredImage = {
  id: string;
  name: string;
  mediaType: MediaKind;
  mimeType: string;
  url: string;
  originalUrl: string;
  uploadedAt: string;
  uploadedAtLabel: string;
  size: number;
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

function getBlobAccess(): BlobAccessType {
  const access = process.env.BLOB_ACCESS?.trim().toLowerCase();

  if (access === "public" || access === "private") {
    return access;
  }

  return "private";
}

function getBlobPrefix() {
  return "uploads/";
}

function decodePathname(name: string) {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

export async function saveUpload(file: File) {
  const now = new Date();
  const originalName = file.name || "media";
  const extension =
    path.extname(originalName).toLowerCase() || getDefaultExtension(file.type);
  const baseName =
    sanitizeBaseName(path.basename(originalName, extension)) || "media";
  const pathname = `${getBlobPrefix()}${formatStamp(now)}-${baseName}${extension}`;

  const blob = await put(pathname, file, {
    access: getBlobAccess(),
    addRandomSuffix: false,
    contentType: file.type || undefined,
  });

  return blob.pathname;
}

export async function listImages(): Promise<StoredImage[]> {
  const { blobs } = await list({
    prefix: getBlobPrefix(),
    limit: 1000,
  });

  return blobs
    .map((blob) => {
      const encodedPath = encodeURIComponent(blob.pathname);
      const previewToken = createPreviewToken(blob.pathname);
      const mimeType = getMediaMimeType(null, blob.pathname);

      return {
        id: blob.pathname,
        name: path.basename(blob.pathname),
        mediaType: getMediaKind(mimeType, blob.pathname),
        mimeType,
        url: `/api/images/${encodedPath}?preview=1&token=${previewToken}`,
        originalUrl: `/api/images/${encodedPath}`,
        uploadedAt: blob.uploadedAt.toISOString(),
        uploadedAtLabel: formatLabel(blob.uploadedAt),
        size: blob.size,
      };
    })
    .sort((left, right) => {
      return (
        new Date(right.uploadedAt).getTime() -
        new Date(left.uploadedAt).getTime()
      );
    });
}

export async function readImage(name: string, range?: string | null) {
  const pathname = decodePathname(name);
  const result = await get(pathname, {
    access: getBlobAccess(),
    headers: range ? { Range: range } : undefined,
  });

  if (!result || result.statusCode !== 200) {
    throw new Error("Blob not found");
  }

  return {
    stream: result.stream,
    fileName: path.basename(result.blob.pathname),
    mimeType: result.blob.contentType,
    size: result.blob.size,
    acceptRanges: result.headers.get("accept-ranges"),
    contentRange: result.headers.get("content-range"),
  };
}

export async function removeImage(name: string) {
  const pathname = decodePathname(name);
  await del(pathname);
}
