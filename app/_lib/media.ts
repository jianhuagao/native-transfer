export type MediaKind = "image" | "video";

export const ALLOWED_UPLOAD_CONTENT_TYPES = ["image/*", "video/*"];

export const MEDIA_INPUT_ACCEPT =
  "image/*,video/*,.mp4,.m4v,.mov,.webm,.ogv,.avi,.mkv";

const imageExtensions = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".heic",
  ".heif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".tif",
  ".tiff",
  ".webp",
]);

const videoExtensions = new Set([
  ".avi",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".ogv",
  ".webm",
]);

const extensionMimeTypes = new Map([
  [".avi", "video/x-msvideo"],
  [".m4v", "video/x-m4v"],
  [".mkv", "video/x-matroska"],
  [".mov", "video/quicktime"],
  [".mp4", "video/mp4"],
  [".mpeg", "video/mpeg"],
  [".mpg", "video/mpeg"],
  [".ogv", "video/ogg"],
  [".webm", "video/webm"],
  [".avif", "image/avif"],
  [".bmp", "image/bmp"],
  [".gif", "image/gif"],
  [".heic", "image/heic"],
  [".heif", "image/heif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".tif", "image/tiff"],
  [".tiff", "image/tiff"],
  [".webp", "image/webp"],
]);

function getExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex < 0) {
    return "";
  }

  return fileName.slice(dotIndex).toLowerCase();
}

export function getMediaKind(
  contentType?: string | null,
  fileName = "",
): MediaKind {
  if (contentType?.startsWith("video/")) {
    return "video";
  }

  if (contentType?.startsWith("image/")) {
    return "image";
  }

  const extension = getExtension(fileName);

  if (videoExtensions.has(extension)) {
    return "video";
  }

  if (imageExtensions.has(extension)) {
    return "image";
  }

  return "image";
}

export function getMediaMimeType(contentType?: string | null, fileName = "") {
  if (contentType) {
    return contentType;
  }

  return (
    extensionMimeTypes.get(getExtension(fileName)) ?? "application/octet-stream"
  );
}

export function getDefaultExtension(contentType?: string | null) {
  if (contentType?.startsWith("video/")) {
    return ".mp4";
  }

  return ".jpg";
}

export function isAllowedUploadMedia(
  contentType?: string | null,
  fileName = "",
) {
  if (contentType?.startsWith("image/") || contentType?.startsWith("video/")) {
    return true;
  }

  const extension = getExtension(fileName);

  return imageExtensions.has(extension) || videoExtensions.has(extension);
}
