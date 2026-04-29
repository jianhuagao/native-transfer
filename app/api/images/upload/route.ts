import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { isAuthorized } from "@/app/_lib/auth";
import { ALLOWED_UPLOAD_CONTENT_TYPES } from "@/app/_lib/media";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        if (!(await isAuthorized())) {
          throw new Error("未授权");
        }

        return {
          allowedContentTypes: ALLOWED_UPLOAD_CONTENT_TYPES,
          addRandomSuffix: false,
          maximumSizeInBytes: 1024 * 1024 * 200,
        };
      },
      onUploadCompleted: async () => {
        return;
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "上传初始化失败";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
