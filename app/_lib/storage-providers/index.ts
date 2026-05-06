import "server-only";

import { cookies } from "next/headers";
import { storageSourceDefinitions } from "@/storage-sources.config";
import type {
  PublicStorageSource,
  StorageAccess,
  StorageProviderName,
  StorageProvider,
  StorageSourceConfig,
  StorageUploadMode,
} from "@/app/_lib/storage-providers/types";

export const STORAGE_SOURCE_COOKIE_NAME = "native-transfer-storage-source";

const providerPromises = new Map<string, Promise<StorageProvider>>();

type S3SourceDefinition = Omit<
  NonNullable<StorageSourceConfig["s3"]>,
  "accessKeyId" | "secretAccessKey" | "endpoint"
> & {
  endpoint?: string;
  endpointEnv?: string;
  accessKeyIdEnv: string;
  secretAccessKeyEnv: string;
};

type StorageSourceDefinition = Omit<
  StorageSourceConfig,
  "provider" | "access" | "uploadMode" | "token" | "s3"
> & {
  provider: StorageProviderName;
  access: StorageAccess;
  uploadMode: StorageUploadMode;
  tokenEnv?: string;
  s3?: S3SourceDefinition;
};

const configuredStorageSourceDefinitions =
  storageSourceDefinitions as readonly StorageSourceDefinition[];

function readOptionalEnv(name?: string) {
  if (!name) {
    return undefined;
  }

  return process.env[name];
}

function requireEnv(name: string, sourceId: string) {
  const value = readOptionalEnv(name);

  if (!value) {
    throw new Error(`Missing environment variable ${name} for ${sourceId}.`);
  }

  return value;
}

function requireConfigValue(
  value: string | undefined,
  envName: string | undefined,
  fieldName: string,
  sourceId: string,
) {
  if (envName) {
    return requireEnv(envName, sourceId);
  }

  if (!value) {
    throw new Error(`Missing ${fieldName} for ${sourceId}.`);
  }

  return value;
}

function buildStorageSource(
  definition: StorageSourceDefinition,
): StorageSourceConfig {
  const { tokenEnv, s3, ...source } = definition;

  return {
    ...source,
    token: tokenEnv ? requireEnv(tokenEnv, definition.id) : undefined,
    s3: s3
      ? {
          bucket: s3.bucket,
          endpoint: requireConfigValue(
            s3.endpoint,
            s3.endpointEnv,
            "S3 endpoint",
            definition.id,
          ),
          region: s3.region,
          forcePathStyle: s3.forcePathStyle,
          accessKeyId: requireEnv(s3.accessKeyIdEnv, definition.id),
          secretAccessKey: requireEnv(s3.secretAccessKeyEnv, definition.id),
        }
      : undefined,
  };
}

export function getStorageSources(): StorageSourceConfig[] {
  const sources = configuredStorageSourceDefinitions.map(buildStorageSource);

  if (sources.length === 0) {
    throw new Error("No storage sources configured.");
  }

  return sources;
}

export function getPublicStorageSources(): PublicStorageSource[] {
  return getStorageSources().map((source) => ({
    id: source.id,
    label: source.label,
    prefix: source.prefix,
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
