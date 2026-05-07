import {
  del,
  get,
  head,
  list,
  put,
  BlobNotFoundError,
  type BlobAccessType,
} from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import type {
  StorageAccess,
  StorageClientUploadOptions,
  StorageProvider,
  StorageSourceConfig,
} from "@/app/_lib/storage-providers/types";

function toBlobAccess(access: StorageAccess): BlobAccessType {
  return access;
}

export function createVercelBlobStorageProvider(
  source: StorageSourceConfig,
): StorageProvider {
  const commandOptions = source.token ? { token: source.token } : undefined;

  return {
    async put(pathname, body, options) {
      const blob = await put(pathname, body, {
        ...commandOptions,
        access: toBlobAccess(options.access),
        addRandomSuffix: options.addRandomSuffix,
        allowOverwrite: options.allowOverwrite,
        contentType: options.contentType,
      });

      return { pathname: blob.pathname };
    },

    async putStream(pathname, stream, options) {
      const blob = await put(pathname, stream, {
        ...commandOptions,
        access: toBlobAccess(options.access),
        addRandomSuffix: options.addRandomSuffix,
        allowOverwrite: options.allowOverwrite,
        contentType: options.contentType,
        multipart: true,
      });

      return { pathname: blob.pathname };
    },

    async exists(pathname) {
      try {
        await head(pathname, commandOptions);
        return true;
      } catch (error) {
        if (error instanceof BlobNotFoundError) {
          return false;
        }

        throw error;
      }
    },

    async list(options) {
      const { blobs } = await list({
        ...commandOptions,
        prefix: options.prefix,
        limit: options.limit,
      });

      return blobs.map((blob) => ({
        pathname: blob.pathname,
        uploadedAt: blob.uploadedAt,
        size: blob.size,
        contentType: null,
      }));
    },

    async read(pathname, options) {
      const result = await get(pathname, {
        ...commandOptions,
        access: toBlobAccess(options.access),
        headers: options.range ? { Range: options.range } : undefined,
      });

      if (!result?.stream) {
        return null;
      }

      return {
        stream: result.stream,
        pathname: result.blob.pathname,
        contentType: result.blob.contentType,
        size: result.blob.size,
        statusCode: result.statusCode as number | undefined,
        headers: result.headers,
      };
    },

    async delete(pathname) {
      await del(pathname, commandOptions);
    },

    async handleClientUpload({
      body,
      request,
      getUploadConstraints,
    }: StorageClientUploadOptions) {
      return handleUpload({
        token: source.token,
        body: body as HandleUploadBody,
        request,
        onBeforeGenerateToken: (pathname) => getUploadConstraints(pathname),
        onUploadCompleted: async () => {
          return;
        },
      });
    },
  };
}
