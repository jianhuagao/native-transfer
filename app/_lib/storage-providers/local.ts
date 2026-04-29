import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import type {
  StorageProvider,
  StorageSourceConfig,
} from "@/app/_lib/storage-providers/types";

function getStorageRoot(source: StorageSourceConfig) {
  return path.join(process.cwd(), "storage", source.id);
}

function resolveStoragePath(source: StorageSourceConfig, pathname: string) {
  const root = getStorageRoot(source);
  const target = path.resolve(root, pathname.replaceAll("\\", "/"));

  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid storage path");
  }

  return target;
}

function toStoragePathname(source: StorageSourceConfig, filePath: string) {
  return path
    .relative(getStorageRoot(source), filePath)
    .split(path.sep)
    .join("/");
}

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return walkFiles(entryPath);
      }

      if (entry.isFile()) {
        return [entryPath];
      }

      return [];
    }),
  );

  return files.flat();
}

function parseRange(range: string, size: number) {
  const match = range.match(/^bytes=(\d*)-(\d*)$/);

  if (!match) {
    return null;
  }

  const startText = match[1];
  const endText = match[2];

  if (!startText && !endText) {
    return null;
  }

  if (!startText) {
    const suffixLength = Number(endText);

    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    return {
      start: Math.max(0, size - suffixLength),
      end: size - 1,
    };
  }

  const start = Number(startText);
  const end = endText ? Number(endText) : size - 1;

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return null;
  }

  return {
    start,
    end: Math.min(end, size - 1),
  };
}

export function createLocalStorageProvider(
  source: StorageSourceConfig,
): StorageProvider {
  return {
    async put(pathname, body) {
      const filePath = resolveStoragePath(source, pathname);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, Buffer.from(await body.arrayBuffer()));

      return { pathname };
    },

    async list(options) {
      const prefixPath = resolveStoragePath(source, options.prefix);

      try {
        const files = await walkFiles(prefixPath);
        const objects = await Promise.all(
          files.map(async (filePath) => {
            const fileStat = await stat(filePath);

            return {
              pathname: toStoragePathname(source, filePath),
              uploadedAt: fileStat.birthtime,
              size: fileStat.size,
              contentType: null,
            };
          }),
        );

        return objects
          .sort((left, right) => {
            return right.uploadedAt.getTime() - left.uploadedAt.getTime();
          })
          .slice(0, options.limit);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;

        if (code === "ENOENT") {
          return [];
        }

        throw error;
      }
    },

    async read(pathname, options) {
      const filePath = resolveStoragePath(source, pathname);

      try {
        const fileStat = await stat(filePath);
        const headers = new Headers();
        headers.set("accept-ranges", "bytes");

        const range = options.range
          ? parseRange(options.range, fileStat.size)
          : null;

        if (range) {
          headers.set(
            "content-range",
            `bytes ${range.start}-${range.end}/${fileStat.size}`,
          );
          headers.set(
            "content-length",
            (range.end - range.start + 1).toString(),
          );

          return {
            stream: Readable.toWeb(
              createReadStream(filePath, {
                start: range.start,
                end: range.end,
              }),
            ) as ReadableStream<Uint8Array>,
            pathname,
            contentType: null,
            size: fileStat.size,
            statusCode: 206,
            headers,
          };
        }

        headers.set("content-length", fileStat.size.toString());

        return {
          stream: Readable.toWeb(createReadStream(filePath)) as ReadableStream<
            Uint8Array
          >,
          pathname,
          contentType: null,
          size: fileStat.size,
          statusCode: 200,
          headers,
        };
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;

        if (code === "ENOENT") {
          return null;
        }

        throw error;
      }
    },

    async delete(pathname) {
      try {
        await unlink(resolveStoragePath(source, pathname));
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;

        if (code !== "ENOENT") {
          throw error;
        }
      }
    },
  };
}
