"use client";

type UploadMediaOptions = {
  file: File;
  shareToken?: string;
  sourceId: string;
  uploadMode: "form-data" | "s3-presigned-url" | "vercel-blob-client";
  uploadEndpoint?: string;
  pathname: string;
  onProgress: (percentage: number) => void;
  signal?: AbortSignal;
};

function createAbortError() {
  return new DOMException("Upload cancelled", "AbortError");
}

function buildUploadEndpoint(uploadEndpoint: string, sourceId: string) {
  const separator = uploadEndpoint.includes("?") ? "&" : "?";

  return `${uploadEndpoint}${separator}source=${encodeURIComponent(sourceId)}`;
}

function uploadWithFormData({
  file,
  sourceId,
  shareToken,
  pathname,
  onProgress,
  signal,
  uploadEndpoint = "/api/images/upload",
}: UploadMediaOptions) {
  return new Promise<void>((resolve, reject) => {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("pathname", pathname);
    formData.set("sourceId", sourceId);
    if (shareToken) {
      formData.set("token", shareToken);
    }

    const request = new XMLHttpRequest();
    request.open("POST", uploadEndpoint);

    function abortUpload() {
      request.abort();
      reject(createAbortError());
    }

    if (signal?.aborted) {
      abortUpload();
      return;
    }

    signal?.addEventListener("abort", abortUpload, { once: true });

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return;
      }

      onProgress(Math.round((event.loaded / event.total) * 100));
    });

    request.addEventListener("load", () => {
      signal?.removeEventListener("abort", abortUpload);

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
      signal?.removeEventListener("abort", abortUpload);
      reject(new Error("上传失败，请检查网络或服务状态。"));
    });

    request.addEventListener("abort", () => {
      signal?.removeEventListener("abort", abortUpload);
    });

    request.send(formData);
  });
}

async function uploadWithVercelBlobClient({
  file,
  sourceId,
  shareToken,
  pathname,
  onProgress,
  signal,
  uploadEndpoint = "/api/images/upload",
}: UploadMediaOptions) {
  const { upload } = await import("@vercel/blob/client");

  await upload(pathname, file, {
    access: "private",
    abortSignal: signal,
    handleUploadUrl: buildUploadEndpoint(uploadEndpoint, sourceId),
    clientPayload: JSON.stringify({ shareToken, sourceId }),
    headers: {
      ...(shareToken ? { "x-share-upload-token": shareToken } : {}),
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
  shareToken,
  pathname,
  signal,
  uploadEndpoint = "/api/images/upload",
}: UploadMediaOptions) {
  const response = await fetch(
    buildUploadEndpoint(uploadEndpoint, sourceId),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(shareToken ? { "x-share-upload-token": shareToken } : {}),
        "x-storage-source": sourceId,
      },
      body: JSON.stringify({
        shareToken,
        type: "storage.create-direct-upload",
        payload: {
          pathname,
          contentType: file.type || undefined,
          size: file.size,
        },
      }),
      signal,
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

    function abortUpload() {
      request.abort();
      reject(createAbortError());
    }

    if (options.signal?.aborted) {
      abortUpload();
      return;
    }

    options.signal?.addEventListener("abort", abortUpload, { once: true });

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
      options.signal?.removeEventListener("abort", abortUpload);

      if (request.status >= 200 && request.status < 300) {
        options.onProgress(100);
        resolve();
        return;
      }

      reject(new Error("上传失败，请检查存储桶 CORS 或服务状态。"));
    });

    request.addEventListener("error", () => {
      options.signal?.removeEventListener("abort", abortUpload);
      reject(new Error("上传失败，请检查存储桶 CORS 或服务状态。"));
    });

    request.addEventListener("abort", () => {
      options.signal?.removeEventListener("abort", abortUpload);
    });

    request.send(options.file);
  });
}

export async function uploadMedia({
  file,
  shareToken,
  sourceId,
  uploadMode,
  uploadEndpoint = "/api/images/upload",
  pathname,
  onProgress,
  signal,
}: UploadMediaOptions) {
  if (uploadMode === "form-data") {
    await uploadWithFormData({
      file,
      shareToken,
      sourceId,
      uploadMode,
      uploadEndpoint,
      pathname,
      onProgress,
      signal,
    });
    return;
  }

  if (uploadMode === "s3-presigned-url") {
    await uploadWithS3PresignedUrl({
      file,
      shareToken,
      sourceId,
      uploadMode,
      uploadEndpoint,
      pathname,
      onProgress,
      signal,
    });
    return;
  }

  await uploadWithVercelBlobClient({
    file,
    shareToken,
    sourceId,
    uploadMode,
    uploadEndpoint,
    pathname,
    onProgress,
    signal,
  });
}
