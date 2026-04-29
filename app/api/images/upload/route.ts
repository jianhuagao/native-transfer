import { NextResponse } from "next/server";

import { isAuthorized } from "@/app/_lib/auth";
import { handleUploadRequest, saveUpload } from "@/app/_lib/storage";

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

  if (!(file instanceof File)) {
    throw new Error("未找到上传文件");
  }

  const pathname = await saveUpload(
    file,
    typeof sourceId === "string" ? sourceId : null,
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
