import { NextResponse } from "next/server";

import {
  createShareUploadToken,
  isAuthorized,
} from "@/app/_lib/auth";
import {
  DEFAULT_SHARE_EXPIRES_MINUTES,
  DEFAULT_SHARE_MAX_FILES,
} from "@/app/_lib/share-upload";
import { readJsonObject } from "@/app/_lib/http";
import { getStorageSource } from "@/app/_lib/storage-providers";

export const runtime = "nodejs";

function normalizePositiveInteger(value: unknown, fallback: number, max: number) {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(1, Math.floor(numberValue)));
}

export async function POST(request: Request) {
  try {
    if (!(await isAuthorized())) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await readJsonObject(request);

    if (typeof body?.sourceId !== "string" || !body.sourceId) {
      throw new Error("请选择上传目标源");
    }

    const source = getStorageSource(body.sourceId);
    const expiresInMinutes = normalizePositiveInteger(
      body.expiresInMinutes,
      DEFAULT_SHARE_EXPIRES_MINUTES,
      24 * 60,
    );
    const maxFiles = normalizePositiveInteger(
      body.maxFiles,
      DEFAULT_SHARE_MAX_FILES,
      100,
    );
    const token = createShareUploadToken({
      allowVideo: body.allowVideo === true,
      expiresInMinutes,
      maxFiles,
      sourceId: source.id,
    });
    const url = new URL("/share-upload", request.url);
    url.searchParams.set("token", token);

    return NextResponse.json({
      expiresAt: Date.now() + expiresInMinutes * 60 * 1000,
      maxFiles,
      sourceLabel: source.label,
      token,
      url: url.toString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "生成二维码失败";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
