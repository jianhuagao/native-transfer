import { NextResponse } from "next/server";

import { isAuthorized } from "@/app/_lib/auth";
import {
  getImagesPayload,
} from "@/app/_lib/storage";
import { setActiveStorageSourceId } from "@/app/_lib/storage-providers";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "未授权" }, { status: 401 });
}

export async function POST(request: Request) {
  if (!(await isAuthorized())) {
    return unauthorized();
  }

  const payload = (await request.json()) as { sourceId?: string };

  if (!payload.sourceId) {
    return NextResponse.json({ error: "缺少存储源" }, { status: 400 });
  }

  try {
    const activeSourceId = await setActiveStorageSourceId(payload.sourceId);

    return NextResponse.json(await getImagesPayload(activeSourceId));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "切换存储源失败";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
