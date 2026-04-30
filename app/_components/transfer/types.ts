import type { MediaKind } from "@/app/_lib/media";

export type TabKey = "transfer" | "history";

export type StoredImage = {
  id: string;
  sourceId: string;
  sourceLabel: string;
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

export type StorageSource = {
  id: string;
  label: string;
  provider: "local" | "s3" | "vercel-blob";
  uploadMode: "form-data" | "s3-presigned-url" | "vercel-blob-client";
};

export type ImagesPayload = {
  activeSourceId: string;
  images: StoredImage[];
  sources: StorageSource[];
  storageUsage: StorageUsage;
};

export type TransferAppProps = {
  initialAuthorized: boolean;
};

export type ConfettiKind = "upload" | "copy";
