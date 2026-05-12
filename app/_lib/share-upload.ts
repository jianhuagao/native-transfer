import "server-only";

import type { ShareUploadTokenPayload } from "@/app/_lib/auth";
import { getStorageSource } from "@/app/_lib/storage-providers";

export const DEFAULT_SHARE_EXPIRES_MINUTES = 10;
export const DEFAULT_SHARE_MAX_FILES = 10;

export function getShareUploadPathPrefix(payload: ShareUploadTokenPayload) {
  const source = getStorageSource(payload.sourceId);

  return `${source.prefix}shared/${payload.shareId}/`;
}

export function getShareUploadThumbnailPathPrefix(
  payload: ShareUploadTokenPayload,
) {
  const source = getStorageSource(payload.sourceId);

  return `${source.prefix}~thumbs/shared/${payload.shareId}/`;
}

export function getShareUploadSource(payload: ShareUploadTokenPayload) {
  return getStorageSource(payload.sourceId);
}
