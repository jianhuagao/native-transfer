import { getDefaultExtension } from "@/app/_lib/media";

export function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function isTouchLikeDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(pointer: coarse)").matches;
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function buildUploadPath(
  fileName: string,
  contentType?: string,
  prefix = "uploads/",
) {
  const now = new Date();
  const dotIndex = fileName.lastIndexOf(".");
  const hasExtension = dotIndex > 0;
  const rawBaseName = hasExtension ? fileName.slice(0, dotIndex) : fileName;
  const extension = hasExtension
    ? fileName.slice(dotIndex).toLowerCase()
    : getDefaultExtension(contentType);
  const baseName =
    rawBaseName
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "media";

  const stamp = [
    now.getFullYear().toString(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
    "-",
    now.getMilliseconds().toString().padStart(3, "0"),
  ].join("");

  return `${prefix}${stamp}-${baseName}${extension}`;
}

export function buildThumbnailPath(pathname: string, prefix = "uploads/") {
  const normalized = pathname.replaceAll("\\", "/").replace(/^\/+/, "");
  const relativePath = normalized.startsWith(prefix)
    ? normalized.slice(prefix.length)
    : normalized;
  const slashIndex = relativePath.lastIndexOf("/");
  const directory = slashIndex >= 0 ? relativePath.slice(0, slashIndex) : "";
  const fileName =
    slashIndex >= 0 ? relativePath.slice(slashIndex + 1) : relativePath;
  const dotIndex = fileName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  const thumbnailDirectory = `${prefix}~thumbs${
    directory ? `/${directory}` : ""
  }`;

  return `${thumbnailDirectory}/${baseName || "media"}.jpg`;
}

export function buildDeleteImagePath(image: {
  id: string;
  sourceId?: string | null;
}) {
  const sourceQuery = image.sourceId
    ? `?source=${encodeURIComponent(image.sourceId)}`
    : "";

  return `/api/images/${image.id
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}${sourceQuery}`;
}
