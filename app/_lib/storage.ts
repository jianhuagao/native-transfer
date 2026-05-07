import "server-only";

import path from "node:path";
import { createPreviewToken, verifyPreviewToken } from "@/app/_lib/auth";
import {
  ALLOWED_UPLOAD_CONTENT_TYPES,
  getDefaultExtension,
  getMediaKind,
  getMediaMimeType,
  type MediaKind,
} from "@/app/_lib/media";
import {
  getActiveStorageSourceId,
  getPublicStorageSources,
  getStorageSource,
  getStorageProvider,
  type PublicStorageSource,
  type StorageAccess,
} from "@/app/_lib/storage-providers";

export type StoredImage = {
  id: string;
  sourceId: string;
  sourceLabel: string;
  name: string;
  mediaType: MediaKind;
  mimeType: string;
  thumbnailUrl?: string;
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

export type StorageImagesPayload = {
  activeSourceId: string;
  images: StoredImage[];
  pagination: {
    hasMore: boolean;
    nextCursor: string | null;
    pageSize: number;
  };
  sources: PublicStorageSource[];
  storageUsage: StorageUsage;
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
const DEFAULT_IMAGES_PAGE_SIZE = 60;
const MAX_IMAGES_PAGE_SIZE = 120;
const MAX_STORAGE_LIST_LIMIT = 1000;
const MAX_TRANSFER_ITEMS = 100;
const THUMBNAIL_DIRECTORY = "~thumbs";

type ImagesPayloadOptions = {
  cursor?: string | null;
  limit?: number | null;
};

export type TransferConflictStrategy = "skip" | "rename" | "overwrite";

export type TransferImageRequest = {
  conflictStrategy: TransferConflictStrategy;
  deleteSourceAfterCopy: boolean;
  fromSourceId: string;
  ids: string[];
  toSourceId: string;
};

export type TransferImageResult = {
  id: string;
  name: string;
  sourcePathname: string;
  status: "copied" | "failed" | "skipped";
  targetPathname?: string;
  message?: string;
  thumbnail?: "copied" | "missing" | "skipped" | "failed";
};

export type TransferImagesSummary = {
  copied: number;
  failed: number;
  skipped: number;
  total: number;
};

export type TransferImagesPayload = {
  results: TransferImageResult[];
  summary: TransferImagesSummary;
};

function getStorageAccess(sourceId?: string | null): StorageAccess {
  return getStorageSource(sourceId).access;
}

function getStorageTotalCapacity(sourceId?: string | null) {
  return getStorageSource(sourceId).totalCapacity;
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

export function getStorageUsage(
  images: StoredImage[],
  sourceId?: string | null,
): StorageUsage {
  const usedBytes = images.reduce((total, image) => total + image.size, 0);
  const totalBytes = parseStorageCapacity(getStorageTotalCapacity(sourceId));
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

function encodePathname(pathname: string) {
  return pathname
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function createSourcePreviewToken(sourceId: string, pathname: string) {
  return createPreviewToken(`${sourceId}:${pathname}`);
}

export function verifySourcePreviewToken(
  sourceId: string,
  pathname: string,
  token: string | null,
) {
  return verifyPreviewToken(`${sourceId}:${pathname}`, token);
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

function normalizeStoragePathname(pathname: string) {
  return pathname.replaceAll("\\", "/").replace(/^\/+/, "");
}

function assertPathnameAllowed(pathname: string, sourcePrefix: string) {
  const normalized = normalizeStoragePathname(pathname);

  if (
    !normalized ||
    normalized.includes("\0") ||
    normalized.split("/").includes("..") ||
    !normalized.startsWith(sourcePrefix)
  ) {
    throw new Error("上传路径无效");
  }

  return normalized;
}

function getAllowedContentTypesForPathname(
  sourcePrefix: string,
  pathname: string,
) {
  return isThumbnailPathname(sourcePrefix, pathname)
    ? ["image/*"]
    : ALLOWED_UPLOAD_CONTENT_TYPES;
}

function getThumbnailPathname(sourcePrefix: string, pathname: string) {
  const normalized = normalizeStoragePathname(pathname);
  const relativePath = normalized.startsWith(sourcePrefix)
    ? normalized.slice(sourcePrefix.length)
    : normalized;
  const directory = path.posix.dirname(relativePath);
  const extension = path.posix.extname(relativePath);
  const baseName = path.posix.basename(relativePath, extension) || "media";
  const thumbnailRelativePath =
    directory === "." ? `${baseName}.jpg` : `${directory}/${baseName}.jpg`;

  return `${sourcePrefix}${THUMBNAIL_DIRECTORY}/${thumbnailRelativePath}`;
}

function isThumbnailPathname(sourcePrefix: string, pathname: string) {
  return normalizeStoragePathname(pathname).startsWith(
    `${sourcePrefix}${THUMBNAIL_DIRECTORY}/`,
  );
}

function getPathnameRelativeToPrefix(pathname: string, prefix: string) {
  const normalized = normalizeStoragePathname(pathname);

  if (!normalized.startsWith(prefix)) {
    throw new Error("文件不属于来源存储源");
  }

  return normalized.slice(prefix.length);
}

function mapPathnameToSourcePrefix(
  pathname: string,
  fromPrefix: string,
  toPrefix: string,
) {
  return `${toPrefix}${getPathnameRelativeToPrefix(pathname, fromPrefix)}`;
}

function appendPathnameSuffix(pathname: string, suffix: string) {
  const directory = path.posix.dirname(pathname);
  const extension = path.posix.extname(pathname);
  const baseName = path.posix.basename(pathname, extension);
  const nextBaseName = `${baseName}${suffix}`;

  return directory === "."
    ? `${nextBaseName}${extension}`
    : `${directory}/${nextBaseName}${extension}`;
}

async function resolveTransferTargetPathname(
  pathname: string,
  exists: (targetPathname: string) => Promise<boolean>,
  conflictStrategy: TransferConflictStrategy,
) {
  if (conflictStrategy === "overwrite") {
    return {
      pathname,
      skipped: false,
    };
  }

  if (!(await exists(pathname))) {
    return {
      pathname,
      skipped: false,
    };
  }

  if (conflictStrategy === "skip") {
    return {
      pathname,
      skipped: true,
    };
  }

  for (let index = 1; index <= 999; index += 1) {
    const suffix = index === 1 ? "-copy" : `-copy-${index}`;
    const nextPathname = appendPathnameSuffix(pathname, suffix);

    if (!(await exists(nextPathname))) {
      return {
        pathname: nextPathname,
        skipped: false,
      };
    }
  }

  throw new Error("无法生成不冲突的目标文件名");
}

function normalizePageSize(limit?: number | null) {
  if (!limit || !Number.isFinite(limit)) {
    return DEFAULT_IMAGES_PAGE_SIZE;
  }

  return Math.min(MAX_IMAGES_PAGE_SIZE, Math.max(1, Math.floor(limit)));
}

function getNextCursor(images: StoredImage[], pageSize: number) {
  return images.length > pageSize ? images[pageSize - 1]?.id ?? null : null;
}

export async function saveUpload(
  file: File,
  sourceId?: string | null,
  requestedPathname?: string | null,
) {
  assertUploadFileAllowed(file);

  const activeSourceId = await getActiveStorageSourceId(sourceId);
  const source = getStorageSource(activeSourceId);
  const now = new Date();
  const originalName = file.name || "media";
  const extension =
    path.extname(originalName).toLowerCase() || getDefaultExtension(file.type);
  const baseName =
    sanitizeBaseName(path.basename(originalName, extension)) || "media";
  const pathname = requestedPathname
    ? assertPathnameAllowed(requestedPathname, source.prefix)
    : `${source.prefix}${formatStamp(now)}-${baseName}${extension}`;
  const storageProvider = await getStorageProvider(source.id);

  if (
    isThumbnailPathname(source.prefix, pathname) &&
    !file.type.startsWith("image/")
  ) {
    throw new Error("缩略图路径仅支持图片文件");
  }

  const storedObject = await storageProvider.put(pathname, file, {
    access: getStorageAccess(source.id),
    addRandomSuffix: false,
    contentType: file.type || undefined,
  });

  return storedObject.pathname;
}

export async function listImages(
  sourceId?: string | null,
): Promise<StoredImage[]> {
  const activeSourceId = await getActiveStorageSourceId(sourceId);
  const source = getStorageSource(activeSourceId);
  const storageProvider = await getStorageProvider(source.id);
  const [objects, thumbnailObjects] = await Promise.all([
    storageProvider.list({
      prefix: source.prefix,
      limit: MAX_STORAGE_LIST_LIMIT,
    }),
    storageProvider.list({
      prefix: `${source.prefix}${THUMBNAIL_DIRECTORY}/`,
      limit: MAX_STORAGE_LIST_LIMIT,
    }),
  ]);
  const thumbnailPathnames = new Set(
    thumbnailObjects.map((object) => normalizeStoragePathname(object.pathname)),
  );

  return objects
    .filter((object) => !isThumbnailPathname(source.prefix, object.pathname))
    .map((object) => {
      const encodedPath = encodePathname(object.pathname);
      const previewToken = createSourcePreviewToken(source.id, object.pathname);
      const mimeType = getMediaMimeType(object.contentType, object.pathname);
      const mediaType = getMediaKind(mimeType, object.pathname);
      const thumbnailPathname = getThumbnailPathname(
        source.prefix,
        object.pathname,
      );
      const hasThumbnail =
        mediaType === "image" && thumbnailPathnames.has(thumbnailPathname);
      const encodedThumbnailPath = encodePathname(thumbnailPathname);
      const thumbnailPreviewToken = createSourcePreviewToken(
        source.id,
        thumbnailPathname,
      );
      const sourceQuery = `source=${encodeURIComponent(source.id)}`;

      return {
        id: object.pathname,
        sourceId: source.id,
        sourceLabel: source.label,
        name: path.basename(object.pathname),
        mediaType,
        mimeType,
        thumbnailUrl: hasThumbnail
          ? `/api/images/${encodedThumbnailPath}?${sourceQuery}&preview=1&token=${thumbnailPreviewToken}`
          : undefined,
        url: `/api/images/${encodedPath}?${sourceQuery}&preview=1&token=${previewToken}`,
        originalUrl: `/api/images/${encodedPath}?${sourceQuery}`,
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

export async function readImage(
  name: string,
  range?: string | null,
  sourceId?: string | null,
) {
  const activeSourceId = await getActiveStorageSourceId(sourceId);
  const pathname = decodePathname(name);
  const storageProvider = await getStorageProvider(activeSourceId);
  const result = await storageProvider.read(pathname, {
    access: getStorageAccess(activeSourceId),
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

export async function removeImage(name: string, sourceId?: string | null) {
  const activeSourceId = await getActiveStorageSourceId(sourceId);
  const source = getStorageSource(activeSourceId);
  const pathname = decodePathname(name);
  const storageProvider = await getStorageProvider(activeSourceId);
  await storageProvider.delete(pathname);
  await storageProvider.delete(getThumbnailPathname(source.prefix, pathname));
}

async function copyStorageObject({
  fromPathname,
  fromSourceId,
  toPathname,
  toSourceId,
}: {
  fromPathname: string;
  fromSourceId: string;
  toPathname: string;
  toSourceId: string;
}) {
  const toSource = getStorageSource(toSourceId);
  const fromProvider = await getStorageProvider(fromSourceId);
  const toProvider = await getStorageProvider(toSourceId);
  const readResult = await fromProvider.read(fromPathname, {
    access: getStorageAccess(fromSourceId),
  });

  if (!readResult?.stream || readResult.statusCode === 304) {
    throw new Error("源文件不存在或无法读取");
  }

  await toProvider.putStream(toPathname, readResult.stream, {
    access: getStorageAccess(toSourceId),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: getMediaMimeType(readResult.contentType, fromPathname),
    size: readResult.size,
  });

  return {
    pathname: toPathname,
    size: readResult.size,
    source: toSource,
  };
}

async function copyStorageThumbnail({
  conflictStrategy,
  fromPathname,
  fromSourceId,
  targetOriginalPathname,
  toSourceId,
}: {
  conflictStrategy: TransferConflictStrategy;
  fromPathname: string;
  fromSourceId: string;
  targetOriginalPathname: string;
  toSourceId: string;
}): Promise<TransferImageResult["thumbnail"]> {
  const fromSource = getStorageSource(fromSourceId);
  const toSource = getStorageSource(toSourceId);
  const fromProvider = await getStorageProvider(fromSourceId);
  const toProvider = await getStorageProvider(toSourceId);
  const fromThumbnailPathname = getThumbnailPathname(
    fromSource.prefix,
    fromPathname,
  );
  const hasThumbnail = await fromProvider.exists(fromThumbnailPathname);

  if (!hasThumbnail) {
    return "missing";
  }

  const targetThumbnailPathname = getThumbnailPathname(
    toSource.prefix,
    targetOriginalPathname,
  );
  const targetThumbnailExists =
    conflictStrategy !== "overwrite" &&
    (await toProvider.exists(targetThumbnailPathname));

  if (targetThumbnailExists) {
    return "skipped";
  }

  try {
    await copyStorageObject({
      fromPathname: fromThumbnailPathname,
      fromSourceId,
      toPathname: targetThumbnailPathname,
      toSourceId,
    });

    return "copied";
  } catch {
    return "failed";
  }
}

export async function transferImages({
  conflictStrategy,
  deleteSourceAfterCopy,
  fromSourceId,
  ids,
  toSourceId,
}: TransferImageRequest): Promise<TransferImagesPayload> {
  if (fromSourceId === toSourceId) {
    throw new Error("来源和目标存储源不能相同");
  }

  if (!ids.length) {
    throw new Error("请选择要迁移的媒体");
  }

  if (ids.length > MAX_TRANSFER_ITEMS) {
    throw new Error(`单次最多迁移 ${MAX_TRANSFER_ITEMS} 个媒体`);
  }

  const fromSource = getStorageSource(fromSourceId);
  const toSource = getStorageSource(toSourceId);
  const toProvider = await getStorageProvider(toSource.id);
  const fromProvider = await getStorageProvider(fromSource.id);
  const results: TransferImageResult[] = [];

  for (const rawId of ids) {
    const sourcePathname = assertPathnameAllowed(
      decodePathname(rawId),
      fromSource.prefix,
    );
    const name = path.basename(sourcePathname);

    if (isThumbnailPathname(fromSource.prefix, sourcePathname)) {
      results.push({
        id: rawId,
        name,
        sourcePathname,
        status: "failed",
        message: "不能直接迁移缩略图路径",
      });
      continue;
    }

    try {
      const desiredTargetPathname = mapPathnameToSourcePrefix(
        sourcePathname,
        fromSource.prefix,
        toSource.prefix,
      );
      const target = await resolveTransferTargetPathname(
        desiredTargetPathname,
        (targetPathname) => toProvider.exists(targetPathname),
        conflictStrategy,
      );

      if (target.skipped) {
        results.push({
          id: rawId,
          name,
          sourcePathname,
          status: "skipped",
          targetPathname: target.pathname,
          message: "目标源已存在同名文件",
          thumbnail: "skipped",
        });
        continue;
      }

      await copyStorageObject({
        fromPathname: sourcePathname,
        fromSourceId: fromSource.id,
        toPathname: target.pathname,
        toSourceId: toSource.id,
      });

      const thumbnail = await copyStorageThumbnail({
        conflictStrategy,
        fromPathname: sourcePathname,
        fromSourceId: fromSource.id,
        targetOriginalPathname: target.pathname,
        toSourceId: toSource.id,
      });

      if (deleteSourceAfterCopy) {
        await fromProvider.delete(sourcePathname);
        await fromProvider.delete(
          getThumbnailPathname(fromSource.prefix, sourcePathname),
        );
      }

      results.push({
        id: rawId,
        name,
        sourcePathname,
        status: "copied",
        targetPathname: target.pathname,
        thumbnail,
      });
    } catch (error) {
      results.push({
        id: rawId,
        name,
        sourcePathname,
        status: "failed",
        message: error instanceof Error ? error.message : "迁移失败",
      });
    }
  }

  return {
    results,
    summary: {
      copied: results.filter((result) => result.status === "copied").length,
      failed: results.filter((result) => result.status === "failed").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      total: results.length,
    },
  };
}

export async function handleUploadRequest(
  request: Request,
  body: unknown,
  authorize: () => Promise<boolean>,
  sourceId?: string | null,
) {
  const activeSourceId = await getActiveStorageSourceId(sourceId);
  const storageProvider = await getStorageProvider(activeSourceId);

  if (!storageProvider.handleClientUpload) {
    throw new Error("当前存储提供方不支持客户端直传。");
  }

  return storageProvider.handleClientUpload({
    body,
    request,
    getUploadConstraints: async (pathname) => {
      if (!(await authorize())) {
        throw new Error("未授权");
      }

      const sourcePrefix = getStorageSource(activeSourceId).prefix;
      assertPathnameAllowed(pathname, sourcePrefix);

      return {
        allowedContentTypes: getAllowedContentTypesForPathname(
          sourcePrefix,
          pathname,
        ),
        addRandomSuffix: false,
        maximumSizeInBytes: MAX_UPLOAD_SIZE_IN_BYTES,
      };
    },
  });
}

export async function createDirectUpload(
  options: {
    pathname: string;
    contentType?: string;
    size: number;
  },
  authorize: () => Promise<boolean>,
  sourceId?: string | null,
) {
  if (!(await authorize())) {
    throw new Error("未授权");
  }

  if (options.size > MAX_UPLOAD_SIZE_IN_BYTES) {
    throw new Error("单文件大小不能超过 200MB");
  }

  if (
    options.contentType &&
    !options.contentType.startsWith("image/") &&
    !options.contentType.startsWith("video/")
  ) {
    throw new Error("仅支持上传图片或视频文件");
  }

  const activeSourceId = await getActiveStorageSourceId(sourceId);
  const source = getStorageSource(activeSourceId);
  const pathname = assertPathnameAllowed(options.pathname, source.prefix);

  if (
    isThumbnailPathname(source.prefix, pathname) &&
    !options.contentType?.startsWith("image/")
  ) {
    throw new Error("缩略图路径仅支持图片文件");
  }

  const storageProvider = await getStorageProvider(activeSourceId);

  if (!storageProvider.createDirectUpload) {
    throw new Error("当前存储提供方不支持直传。");
  }

  return storageProvider.createDirectUpload({
    ...options,
    pathname,
  });
}

export async function getImagesPayload(
  sourceId?: string | null,
  options: ImagesPayloadOptions = {},
): Promise<StorageImagesPayload> {
  const activeSourceId = await getActiveStorageSourceId(sourceId);
  const images = await listImages(activeSourceId);
  const pageSize = normalizePageSize(options.limit);
  const cursorIndex = options.cursor
    ? images.findIndex((image) => image.id === options.cursor)
    : -1;
  const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  const pageImages = images.slice(startIndex, startIndex + pageSize + 1);
  const hasMore = pageImages.length > pageSize;

  return {
    activeSourceId,
    images: pageImages.slice(0, pageSize),
    pagination: {
      hasMore,
      nextCursor: hasMore ? getNextCursor(pageImages, pageSize) : null,
      pageSize,
    },
    sources: getPublicStorageSources(),
    storageUsage: getStorageUsage(images, activeSourceId),
  };
}
