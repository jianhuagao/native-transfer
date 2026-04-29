import {
  del,
  get,
  list,
  put,
  type BlobAccessType,
} from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import type {
  StorageAccess,
  StorageClientUploadOptions,
  StorageProvider,
} from "@/app/_lib/storage-providers/types";

function toBlobAccess(access: StorageAccess): BlobAccessType {
  return access;
}

export function createVercelBlobStorageProvider(): StorageProvider {
  return {
    async put(pathname, body, options) {
      const blob = await put(pathname, body, {
        access: toBlobAccess(options.access),
        addRandomSuffix: options.addRandomSuffix,
        contentType: options.contentType,
      });

      return { pathname: blob.pathname };
    },

    async list(options) {
      const { blobs } = await list({
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
      await del(pathname);
    },

    async handleClientUpload({
      body,
      request,
      getUploadConstraints,
    }: StorageClientUploadOptions) {
      return handleUpload({
        body: body as HandleUploadBody,
        request,
        onBeforeGenerateToken: getUploadConstraints,
        onUploadCompleted: async () => {
          return;
        },
      });
    },
  };
}
