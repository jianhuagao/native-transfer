"use client";

const THUMBNAIL_MAX_SIZE = 640;
const THUMBNAIL_QUALITY = 0.72;

function getTargetSize(width: number, height: number) {
  const scale = Math.min(1, THUMBNAIL_MAX_SIZE / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", THUMBNAIL_QUALITY);
  });
}

export async function createImageThumbnail(file: File) {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return null;
  }

  const bitmap = await createImageBitmap(file);

  try {
    const targetSize = getTargetSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = targetSize.width;
    canvas.height = targetSize.height;

    const context = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });

    if (!context) {
      return null;
    }

    context.drawImage(bitmap, 0, 0, targetSize.width, targetSize.height);

    const blob = await canvasToBlob(canvas);

    if (!blob) {
      return null;
    }

    return new File([blob], "thumbnail.jpg", {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}
