"use client";

type UploadMediaOptions = {
  file: File;
  sourceId: string;
  uploadMode: "form-data" | "s3-presigned-url" | "vercel-blob-client";
  pathname: string;
  onProgress: (percentage: number) => void;
};

function uploadWithFormData({
  file,
  sourceId,
  pathname,
  onProgress,
}: UploadMediaOptions) {
  return new Promise<void>((resolve, reject) => {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("pathname", pathname);
    formData.set("sourceId", sourceId);

    const request = new XMLHttpRequest();
    request.open("POST", "/api/images/upload");

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return;
      }

      onProgress(Math.round((event.loaded / event.total) * 100));
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      try {
        const response = JSON.parse(request.responseText) as { error?: string };
        reject(new Error(response.error || "上传失败，请检查网络或服务状态。"));
      } catch {
        reject(new Error("上传失败，请检查网络或服务状态。"));
      }
    });

    request.addEventListener("error", () => {
      reject(new Error("上传失败，请检查网络或服务状态。"));
    });

    request.send(formData);
  });
}

async function uploadWithVercelBlobClient({
  file,
  sourceId,
  pathname,
  onProgress,
}: UploadMediaOptions) {
  const { upload } = await import("@vercel/blob/client");

  await upload(pathname, file, {
    access: "private",
    handleUploadUrl: `/api/images/upload?source=${encodeURIComponent(sourceId)}`,
    clientPayload: JSON.stringify({ sourceId }),
    headers: {
      "x-storage-source": sourceId,
    },
    multipart: true,
    contentType: file.type || undefined,
    onUploadProgress: ({ percentage }) => {
      onProgress(Math.round(percentage));
    },
  });
}

async function createDirectUpload({
  file,
  sourceId,
  pathname,
}: UploadMediaOptions) {
  const response = await fetch(
    `/api/images/upload?source=${encodeURIComponent(sourceId)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-storage-source": sourceId,
      },
      body: JSON.stringify({
        type: "storage.create-direct-upload",
        payload: {
          pathname,
          contentType: file.type || undefined,
          size: file.size,
        },
      }),
    },
  );

  if (!response.ok) {
    try {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error || "上传初始化失败");
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error("上传初始化失败");
    }
  }

  return (await response.json()) as {
    method: "PUT";
    pathname: string;
    url: string;
    headers?: Record<string, string>;
  };
}

async function uploadWithS3PresignedUrl(options: UploadMediaOptions) {
  const upload = await createDirectUpload(options);

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(upload.method, upload.url);

    for (const [key, value] of Object.entries(upload.headers ?? {})) {
      request.setRequestHeader(key, value);
    }

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return;
      }

      options.onProgress(Math.round((event.loaded / event.total) * 100));
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        options.onProgress(100);
        resolve();
        return;
      }

      reject(new Error("上传失败，请检查存储桶 CORS 或服务状态。"));
    });

    request.addEventListener("error", () => {
      reject(new Error("上传失败，请检查存储桶 CORS 或服务状态。"));
    });

    request.send(options.file);
  });
}

export async function uploadMedia({
  file,
  sourceId,
  uploadMode,
  pathname,
  onProgress,
}: UploadMediaOptions) {
  if (uploadMode === "form-data") {
    await uploadWithFormData({ file, sourceId, uploadMode, pathname, onProgress });
    return;
  }

  if (uploadMode === "s3-presigned-url") {
    await uploadWithS3PresignedUrl({
      file,
      sourceId,
      uploadMode,
      pathname,
      onProgress,
    });
    return;
  }

  await uploadWithVercelBlobClient({
    file,
    sourceId,
    uploadMode,
    pathname,
    onProgress,
  });
}
