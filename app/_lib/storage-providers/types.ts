export type StorageAccess = "public" | "private";
export type StorageProviderName = "local" | "s3" | "vercel-blob";
export type StorageUploadMode = "form-data" | "vercel-blob-client";

export type StorageSourceConfig = {
  id: string;
  label: string;
  provider: StorageProviderName;
  access: StorageAccess;
  prefix: string;
  totalCapacity?: string;
  uploadMode: StorageUploadMode;
  token?: string;
  s3?: {
    bucket: string;
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
  };
};

export type PublicStorageSource = {
  id: string;
  label: string;
  provider: StorageProviderName;
  uploadMode: StorageUploadMode;
};

export type StorageObject = {
  pathname: string;
  uploadedAt: Date;
  size: number;
  contentType?: string | null;
};

export type StoragePutOptions = {
  access: StorageAccess;
  contentType?: string;
  addRandomSuffix?: boolean;
};

export type StorageListOptions = {
  prefix: string;
  limit: number;
};

export type StorageReadOptions = {
  access: StorageAccess;
  range?: string | null;
};

export type StorageReadResult = {
  stream: ReadableStream<Uint8Array>;
  pathname: string;
  contentType?: string | null;
  size: number;
  statusCode?: number;
  headers: Pick<Headers, "get">;
};

export type StorageUploadConstraints = {
  allowedContentTypes: string[];
  addRandomSuffix: boolean;
  maximumSizeInBytes: number;
};

export type StorageClientUploadOptions = {
  body: unknown;
  request: Request;
  getUploadConstraints: () => Promise<StorageUploadConstraints>;
};

export type StorageProvider = {
  put(
    pathname: string,
    body: File,
    options: StoragePutOptions,
  ): Promise<{ pathname: string }>;
  list(options: StorageListOptions): Promise<StorageObject[]>;
  read(
    pathname: string,
    options: StorageReadOptions,
  ): Promise<StorageReadResult | null>;
  delete(pathname: string): Promise<void>;
  handleClientUpload?(options: StorageClientUploadOptions): Promise<unknown>;
};
