import "server-only";

import path from "node:path";
import { createPreviewToken } from "@/app/_lib/auth";
import {
  ALLOWED_UPLOAD_CONTENT_TYPES,
  getDefaultExtension,
  getMediaKind,
  getMediaMimeType,
  type MediaKind,
} from "@/app/_lib/media";
import {
  getStorageProvider,
  type StorageAccess,
} from "@/app/_lib/storage-providers";

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

export type StorageUsage = {
  totalBytes: number;
  usedBytes: number;
  percent: number;
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

const MAX_UPLOAD_SIZE_IN_BYTES = 1024 * 1024 * 200;

function getStorageAccess(): StorageAccess {
  const access = (process.env.STORAGE_ACCESS ?? process.env.BLOB_ACCESS)
    ?.trim()
    .toLowerCase();

  if (access === "public" || access === "private") {
    return access;
  }

  return "private";
}

function getStoragePrefix() {
  return process.env.STORAGE_PREFIX?.trim() || "uploads/";
}

function parseStorageCapacity(value?: string | null) {
  const normalized = value?.trim();

  if (!normalized) {
    return 0;
  }

  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?$/i);

  if (!match) {
    return 0;
  }

  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase() ?? "b";
  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    tb: 1024 * 1024 * 1024 * 1024,
  };

  return Math.max(0, Math.round(amount * multipliers[unit]));
}

export function getStorageUsage(images: StoredImage[]): StorageUsage {
  const usedBytes = images.reduce((total, image) => total + image.size, 0);
  const totalBytes = parseStorageCapacity(process.env.STORAGE_TOTAL_CAPACITY);
  const percent =
    totalBytes > 0 ? Math.min(100, (usedBytes / totalBytes) * 100) : 0;

  return {
    totalBytes,
    usedBytes,
    percent,
  };
}

function decodePathname(name: string) {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function assertUploadFileAllowed(file: File) {
  if (file.size > MAX_UPLOAD_SIZE_IN_BYTES) {
    throw new Error("单文件大小不能超过 200MB");
  }

  if (
    file.type &&
    !file.type.startsWith("image/") &&
    !file.type.startsWith("video/")
  ) {
    throw new Error("仅支持上传图片或视频文件");
  }
}

export async function saveUpload(file: File) {
  assertUploadFileAllowed(file);

  const now = new Date();
  const originalName = file.name || "media";
  const extension =
    path.extname(originalName).toLowerCase() || getDefaultExtension(file.type);
  const baseName =
    sanitizeBaseName(path.basename(originalName, extension)) || "media";
  const pathname = `${getStoragePrefix()}${formatStamp(now)}-${baseName}${extension}`;
  const storageProvider = await getStorageProvider();

  const storedObject = await storageProvider.put(pathname, file, {
    access: getStorageAccess(),
    addRandomSuffix: false,
    contentType: file.type || undefined,
  });

  return storedObject.pathname;
}

export async function listImages(): Promise<StoredImage[]> {
  const storageProvider = await getStorageProvider();
  const objects = await storageProvider.list({
    prefix: getStoragePrefix(),
    limit: 1000,
  });

  return objects
    .map((object) => {
      const encodedPath = encodeURIComponent(object.pathname);
      const previewToken = createPreviewToken(object.pathname);
      const mimeType = getMediaMimeType(object.contentType, object.pathname);

      return {
        id: object.pathname,
        name: path.basename(object.pathname),
        mediaType: getMediaKind(mimeType, object.pathname),
        mimeType,
        url: `/api/images/${encodedPath}?preview=1&token=${previewToken}`,
        originalUrl: `/api/images/${encodedPath}`,
        uploadedAt: object.uploadedAt.toISOString(),
        uploadedAtLabel: formatLabel(object.uploadedAt),
        size: object.size,
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
  const storageProvider = await getStorageProvider();
  const result = await storageProvider.read(pathname, {
    access: getStorageAccess(),
    range,
  });

  const statusCode = result?.statusCode;

  if (
    !result ||
    !result.stream ||
    (statusCode !== 200 && statusCode !== 206)
  ) {
    throw new Error("Blob not found");
  }

  const contentRange = result.headers.get("content-range");

  return {
    stream: result.stream,
    fileName: path.basename(result.pathname),
    mimeType: getMediaMimeType(result.contentType, result.pathname),
    size: result.size,
    statusCode: contentRange ? 206 : statusCode,
    acceptRanges: result.headers.get("accept-ranges"),
    contentLength: result.headers.get("content-length"),
    contentRange,
  };
}

export async function removeImage(name: string) {
  const pathname = decodePathname(name);
  const storageProvider = await getStorageProvider();
  await storageProvider.delete(pathname);
}

export async function handleUploadRequest(
  request: Request,
  body: unknown,
  authorize: () => Promise<boolean>,
) {
  const storageProvider = await getStorageProvider();

  if (!storageProvider.handleClientUpload) {
    throw new Error("当前存储提供方不支持客户端直传。");
  }

  return storageProvider.handleClientUpload({
    body,
    request,
    getUploadConstraints: async () => {
      if (!(await authorize())) {
        throw new Error("未授权");
      }

      return {
        allowedContentTypes: ALLOWED_UPLOAD_CONTENT_TYPES,
        addRandomSuffix: false,
        maximumSizeInBytes: MAX_UPLOAD_SIZE_IN_BYTES,
      };
    },
  });
}
