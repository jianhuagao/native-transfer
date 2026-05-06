import { NextResponse } from "next/server";

import { isAuthorized } from "@/app/_lib/auth";
import {
  createDirectUpload,
  handleUploadRequest,
  saveUpload,
} from "@/app/_lib/storage";

export const runtime = "nodejs";

function getSourceIdFromUploadBody(body: unknown) {
  if (!body || typeof body !== "object" || !("payload" in body)) {
    return null;
  }

  const payload = (body as { payload?: { clientPayload?: string | null } })
    .payload;
  const clientPayload = payload?.clientPayload;

  if (!clientPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(clientPayload) as { sourceId?: unknown };
    return typeof parsed.sourceId === "string" ? parsed.sourceId : null;
  } catch {
    return null;
  }
}

async function handleFormDataUpload(request: Request) {
  if (!(await isAuthorized())) {
    throw new Error("未授权");
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const sourceId = formData.get("sourceId");
  const requestedPathname = formData.get("pathname");

  if (!(file instanceof File)) {
    throw new Error("未找到上传文件");
  }

  const pathname = await saveUpload(
    file,
    typeof sourceId === "string" ? sourceId : null,
    typeof requestedPathname === "string" ? requestedPathname : null,
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
    const sourceId =
      request.headers.get("x-storage-source") ??
      new URL(request.url).searchParams.get("source") ??
      getSourceIdFromUploadBody(body);

    if (
      body &&
      typeof body === "object" &&
      "type" in body &&
      body.type === "storage.create-direct-upload"
    ) {
      const payload = (body as {
        payload?: {
          pathname?: unknown;
          contentType?: unknown;
          size?: unknown;
        };
      }).payload;

      if (
        !payload ||
        typeof payload.pathname !== "string" ||
        typeof payload.size !== "number"
      ) {
        throw new Error("上传参数无效");
      }

      return NextResponse.json(
        await createDirectUpload(
          {
            pathname: payload.pathname,
            contentType:
              typeof payload.contentType === "string"
                ? payload.contentType
                : undefined,
            size: payload.size,
          },
          isAuthorized,
          sourceId,
        ),
      );
    }

    const jsonResponse = await handleUploadRequest(
      request,
      body,
      isAuthorized,
      sourceId,
    );

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "上传初始化失败";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
