export function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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

export function buildUploadPath(fileName: string) {
  const now = new Date();
  const dotIndex = fileName.lastIndexOf(".");
  const hasExtension = dotIndex > 0;
  const rawBaseName = hasExtension ? fileName.slice(0, dotIndex) : fileName;
  const extension = hasExtension
    ? fileName.slice(dotIndex).toLowerCase()
    : ".jpg";
  const baseName =
    rawBaseName
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "image";

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

  return `uploads/${stamp}-${baseName}${extension}`;
}

export function buildDeleteImagePath(imageId: string) {
  return `/api/images/${imageId
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

export function withRefreshVersion(url: string, version: number) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${version}`;
}
