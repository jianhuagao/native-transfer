import { NextResponse } from "next/server";

import {
  isShareUploadTokenActive,
  readShareUploadToken,
  type ShareUploadTokenPayload,
} from "@/app/_lib/auth";
import {
  createDirectUpload,
  handleUploadRequest,
  saveUpload,
} from "@/app/_lib/storage";
import {
  getShareUploadPathPrefix,
  getShareUploadThumbnailPathPrefix,
} from "@/app/_lib/share-upload";

export const runtime = "nodejs";

function getTokenFromRequest(
  request: Request,
  body?: unknown,
  formData?: FormData,
) {
  const url = new URL(request.url);
  const headerToken = request.headers.get("x-share-upload-token");
  const queryToken = url.searchParams.get("token");
  const formToken = formData?.get("token");

  if (typeof formToken === "string" && formToken) {
    return formToken;
  }

  if (headerToken) {
    return headerToken;
  }

  if (queryToken) {
    return queryToken;
  }

  if (body && typeof body === "object" && "shareToken" in body) {
    const token = (body as { shareToken?: unknown }).shareToken;
    return typeof token === "string" ? token : null;
  }

  return null;
}

function readActivePayload(token: string | null) {
  const payload = readShareUploadToken(token);

  if (!payload || !isShareUploadTokenActive(payload)) {
    throw new Error("二维码已失效，请联系分享者重新生成");
  }

  return payload;
}

function getConstraints(payload: ShareUploadTokenPayload) {
  const prefix = getShareUploadPathPrefix(payload);

  return {
    allowVideo: payload.allowVideo,
    countPrefix: prefix,
    maxFiles: payload.maxFiles,
    pathnamePrefixes: [prefix, getShareUploadThumbnailPathPrefix(payload)],
  };
}

async function handleFormDataUpload(request: Request) {
  const formData = await request.formData();
  const payload = readActivePayload(getTokenFromRequest(request, null, formData));
  const file = formData.get("file");
  const requestedPathname = formData.get("pathname");

  if (!(file instanceof File)) {
    throw new Error("未找到上传文件");
  }

  const pathname = await saveUpload(
    file,
    payload.sourceId,
    typeof requestedPathname === "string" ? requestedPathname : null,
    getConstraints(payload),
  );

  return { pathname };
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      return NextResponse.json(await handleFormDataUpload(request));
    }

    const body = await request.json();
    const payload = readActivePayload(getTokenFromRequest(request, body));
    const constraints = getConstraints(payload);

    if (
      body &&
      typeof body === "object" &&
      "type" in body &&
      body.type === "storage.create-direct-upload"
    ) {
      const uploadPayload = (body as {
        payload?: {
          pathname?: unknown;
          contentType?: unknown;
          size?: unknown;
        };
      }).payload;

      if (
        !uploadPayload ||
        typeof uploadPayload.pathname !== "string" ||
        typeof uploadPayload.size !== "number"
      ) {
        throw new Error("上传参数无效");
      }

      return NextResponse.json(
        await createDirectUpload(
          {
            pathname: uploadPayload.pathname,
            contentType:
              typeof uploadPayload.contentType === "string"
                ? uploadPayload.contentType
                : undefined,
            size: uploadPayload.size,
          },
          async () => true,
          payload.sourceId,
          constraints,
        ),
      );
    }

    return NextResponse.json(
      await handleUploadRequest(
        request,
        body,
        async () => true,
        payload.sourceId,
        constraints,
      ),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "上传初始化失败";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
