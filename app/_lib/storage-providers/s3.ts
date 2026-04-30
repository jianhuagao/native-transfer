import {
  DeleteObjectCommand,
  GetObjectCommand,
  type ListObjectsV2CommandOutput,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";

import type {
  StorageProvider,
  StorageSourceConfig,
} from "@/app/_lib/storage-providers/types";

function requireS3Config(source: StorageSourceConfig) {
  if (!source.s3) {
    throw new Error(`Missing S3 configuration for storage source: ${source.id}`);
  }

  return source.s3;
}

function toWebStream(body: unknown) {
  if (body && typeof body === "object" && "transformToWebStream" in body) {
    return (body as { transformToWebStream: () => ReadableStream<Uint8Array> })
      .transformToWebStream();
  }

  if (body instanceof Readable) {
    return Readable.toWeb(body) as ReadableStream<Uint8Array>;
  }

  throw new Error("Unsupported S3 response body");
}

function isNotFound(error: unknown) {
  return (
    error instanceof NoSuchKey ||
    (error as { name?: string })?.name === "NoSuchKey" ||
    (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode === 404
  );
}

export function createS3StorageProvider(
  source: StorageSourceConfig,
): StorageProvider {
  const s3Config = requireS3Config(source);
  let client: S3Client | null = null;

  function getClient() {
    client ??= new S3Client({
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
      endpoint: s3Config.endpoint,
      forcePathStyle: s3Config.forcePathStyle,
      region: s3Config.region,
    });

    return client;
  }

  return {
    async put(pathname, body, options) {
      const upload = new Upload({
        client: getClient(),
        params: {
          Bucket: s3Config.bucket,
          Key: pathname,
          Body: Readable.fromWeb(body.stream() as never),
          ContentLength: body.size,
          ContentType: options.contentType,
        },
      });

      await upload.done();

      return { pathname };
    },

    async list(options) {
      const objects = [];
      let continuationToken: string | undefined;

      do {
        const response: ListObjectsV2CommandOutput = await getClient().send(
          new ListObjectsV2Command({
            Bucket: s3Config.bucket,
            Prefix: options.prefix,
            MaxKeys: Math.min(1000, options.limit - objects.length),
            ContinuationToken: continuationToken,
          }),
        );

        for (const object of response.Contents ?? []) {
          if (!object.Key) {
            continue;
          }

          objects.push({
            pathname: object.Key,
            uploadedAt: object.LastModified ?? new Date(0),
            size: object.Size ?? 0,
            contentType: null,
          });

          if (objects.length >= options.limit) {
            break;
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken && objects.length < options.limit);

      return objects;
    },

    async read(pathname, options) {
      try {
        const response = await getClient().send(
          new GetObjectCommand({
            Bucket: s3Config.bucket,
            Key: pathname,
            Range: options.range ?? undefined,
          }),
        );
        const headers = new Headers();

        if (response.AcceptRanges) {
          headers.set("accept-ranges", response.AcceptRanges);
        }

        if (response.ContentLength !== undefined) {
          headers.set("content-length", response.ContentLength.toString());
        }

        if (response.ContentRange) {
          headers.set("content-range", response.ContentRange);
        }

        return {
          stream: toWebStream(response.Body),
          pathname,
          contentType: response.ContentType,
          size: response.ContentLength ?? 0,
          statusCode: response.$metadata.httpStatusCode,
          headers,
        };
      } catch (error) {
        if (isNotFound(error)) {
          return null;
        }

        throw error;
      }
    },

    async delete(pathname) {
      await getClient().send(
        new DeleteObjectCommand({
          Bucket: s3Config.bucket,
          Key: pathname,
        }),
      );
    },

    async createDirectUpload(options) {
      const command = new PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: options.pathname,
        ContentLength: options.size,
        ContentType: options.contentType,
      });
      const headers: Record<string, string> = {};

      if (options.contentType) {
        headers["Content-Type"] = options.contentType;
      }

      return {
        method: "PUT",
        pathname: options.pathname,
        url: await getSignedUrl(getClient(), command, { expiresIn: 60 * 10 }),
        headers,
      };
    },
  };
}
