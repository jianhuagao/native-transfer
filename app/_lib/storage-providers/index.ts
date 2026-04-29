import "server-only";

import { cookies } from "next/headers";
import type {
  PublicStorageSource,
  StorageAccess,
  StorageProvider,
  StorageProviderName,
  StorageSourceConfig,
  StorageUploadMode,
} from "@/app/_lib/storage-providers/types";

const DEFAULT_STORAGE_PROVIDER = "vercel-blob";
export const STORAGE_SOURCE_COOKIE_NAME = "native-transfer-storage-source";

const providerPromises = new Map<string, Promise<StorageProvider>>();

function normalizeEnvSegment(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function getSourceEnv(sourceId: string, key: string) {
  const sourceKey = normalizeEnvSegment(sourceId);

  return (
    process.env[`STORAGE_SOURCE_${sourceKey}_${key}`] ??
    process.env[`STORAGE_${sourceKey}_${key}`]
  );
}

function normalizeAccess(value?: string): StorageAccess {
  const access = value?.trim().toLowerCase();

  if (access === "public" || access === "private") {
    return access;
  }

  return "private";
}

function normalizeProvider(value?: string): StorageProviderName {
  const provider = (value ?? DEFAULT_STORAGE_PROVIDER).trim().toLowerCase();

  if (provider === "local" || provider === "s3" || provider === "vercel-blob") {
    return provider;
  }

  throw new Error(`Unsupported storage provider: ${provider}`);
}

function normalizeUploadMode(
  provider: StorageProviderName,
  value?: string,
): StorageUploadMode {
  const uploadMode = value?.trim().toLowerCase();

  if (uploadMode === "form-data" || uploadMode === "vercel-blob-client") {
    return uploadMode;
  }

  return provider === "vercel-blob" ? "vercel-blob-client" : "form-data";
}

function normalizeBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes"].includes(value.trim().toLowerCase());
}

function getConfiguredSourceIds() {
  return (process.env.STORAGE_SOURCES ?? "")
    .split(",")
    .map((sourceId) => sourceId.trim())
    .filter(Boolean);
}

function buildLegacySource(): StorageSourceConfig {
  const provider = normalizeProvider(process.env.STORAGE_PROVIDER);

  return {
    id: "default",
    label: process.env.STORAGE_LABEL?.trim() || "Default",
    provider,
    access: normalizeAccess(process.env.STORAGE_ACCESS ?? process.env.BLOB_ACCESS),
    prefix: process.env.STORAGE_PREFIX?.trim() || "uploads/",
    totalCapacity: process.env.STORAGE_TOTAL_CAPACITY,
    uploadMode: normalizeUploadMode(
      provider,
      process.env.NEXT_PUBLIC_STORAGE_UPLOAD_MODE,
    ),
    token: process.env.BLOB_READ_WRITE_TOKEN,
    s3:
      provider === "s3"
        ? {
            bucket: process.env.S3_BUCKET ?? "",
            endpoint: process.env.S3_ENDPOINT ?? "",
            region: process.env.S3_REGION ?? "auto",
            accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
            forcePathStyle: normalizeBoolean(process.env.S3_FORCE_PATH_STYLE, true),
          }
        : undefined,
  };
}

function buildConfiguredSource(sourceId: string): StorageSourceConfig {
  const provider = normalizeProvider(getSourceEnv(sourceId, "PROVIDER"));

  return {
    id: sourceId,
    label: getSourceEnv(sourceId, "LABEL")?.trim() || sourceId,
    provider,
    access: normalizeAccess(getSourceEnv(sourceId, "ACCESS")),
    prefix: getSourceEnv(sourceId, "PREFIX")?.trim() || "uploads/",
    totalCapacity: getSourceEnv(sourceId, "TOTAL_CAPACITY"),
    uploadMode: normalizeUploadMode(provider, getSourceEnv(sourceId, "UPLOAD_MODE")),
    token: getSourceEnv(sourceId, "BLOB_READ_WRITE_TOKEN"),
    s3:
      provider === "s3"
        ? {
            bucket: getSourceEnv(sourceId, "S3_BUCKET") ?? "",
            endpoint: getSourceEnv(sourceId, "S3_ENDPOINT") ?? "",
            region: getSourceEnv(sourceId, "S3_REGION") ?? "auto",
            accessKeyId: getSourceEnv(sourceId, "S3_ACCESS_KEY_ID") ?? "",
            secretAccessKey: getSourceEnv(sourceId, "S3_SECRET_ACCESS_KEY") ?? "",
            forcePathStyle: normalizeBoolean(
              getSourceEnv(sourceId, "S3_FORCE_PATH_STYLE"),
              true,
            ),
          }
        : undefined,
  };
}

export function getStorageSources(): StorageSourceConfig[] {
  const sourceIds = getConfiguredSourceIds();
  const sources =
    sourceIds.length > 0
      ? sourceIds.map(buildConfiguredSource)
      : [buildLegacySource()];

  if (sources.length === 0) {
    throw new Error("No storage sources configured.");
  }

  return sources;
}

export function getPublicStorageSources(): PublicStorageSource[] {
  return getStorageSources().map((source) => ({
    id: source.id,
    label: source.label,
    provider: source.provider,
    uploadMode: source.uploadMode,
  }));
}

export function getStorageSource(sourceId?: string | null) {
  const sources = getStorageSources();
  const selectedSource =
    sources.find((source) => source.id === sourceId) ?? sources[0];

  if (!selectedSource) {
    throw new Error("No storage sources configured.");
  }

  return selectedSource;
}

export async function getActiveStorageSourceId(sourceId?: string | null) {
  if (sourceId) {
    return getStorageSource(sourceId).id;
  }

  const cookieStore = await cookies();
  return getStorageSource(cookieStore.get(STORAGE_SOURCE_COOKIE_NAME)?.value).id;
}

export async function setActiveStorageSourceId(sourceId: string) {
  const source = getStorageSource(sourceId);
  const cookieStore = await cookies();

  cookieStore.set(STORAGE_SOURCE_COOKIE_NAME, source.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return source.id;
}

async function createStorageProvider(source: StorageSourceConfig) {
  const providerName = source.provider
    .trim()
    .toLowerCase();

  switch (providerName) {
    case "local": {
      const { createLocalStorageProvider } = await import(
        "@/app/_lib/storage-providers/local"
      );

      return createLocalStorageProvider(source);
    }

    case "s3": {
      const { createS3StorageProvider } = await import(
        "@/app/_lib/storage-providers/s3"
      );

      return createS3StorageProvider(source);
    }

    case "vercel-blob": {
      const { createVercelBlobStorageProvider } = await import(
        "@/app/_lib/storage-providers/vercel-blob"
      );

      return createVercelBlobStorageProvider(source);
    }

    default:
      throw new Error(`Unsupported storage provider: ${providerName}`);
  }
}

export function getStorageProvider(sourceId?: string | null) {
  const source = getStorageSource(sourceId);
  let providerPromise = providerPromises.get(source.id);

  if (!providerPromise) {
    providerPromise = createStorageProvider(source);
    providerPromises.set(source.id, providerPromise);
  }

  return providerPromise;
}

export type {
  PublicStorageSource,
  StorageAccess,
  StorageUploadMode,
} from "@/app/_lib/storage-providers/types";
