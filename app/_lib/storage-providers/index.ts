import "server-only";

import type { StorageProvider } from "@/app/_lib/storage-providers/types";

const DEFAULT_STORAGE_PROVIDER = "vercel-blob";

let providerPromise: Promise<StorageProvider> | null = null;

async function createStorageProvider() {
  const providerName = (
    process.env.STORAGE_PROVIDER ?? DEFAULT_STORAGE_PROVIDER
  )
    .trim()
    .toLowerCase();

  switch (providerName) {
    case "local": {
      const { createLocalStorageProvider } = await import(
        "@/app/_lib/storage-providers/local"
      );

      return createLocalStorageProvider();
    }

    case "vercel-blob": {
      const { createVercelBlobStorageProvider } = await import(
        "@/app/_lib/storage-providers/vercel-blob"
      );

      return createVercelBlobStorageProvider();
    }

    default:
      throw new Error(`Unsupported storage provider: ${providerName}`);
  }
}

export function getStorageProvider() {
  providerPromise ??= createStorageProvider();
  return providerPromise;
}

export type { StorageAccess } from "@/app/_lib/storage-providers/types";
