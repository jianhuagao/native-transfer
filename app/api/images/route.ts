import { NextResponse } from "next/server";

import { isAuthorized } from "@/app/_lib/auth";
import { listImages, saveUpload } from "@/app/_lib/storage";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "未授权" }, { status: 401 });
}

export async function GET() {
  if (!(await isAuthorized())) {
    return unauthorized();
  }

  const images = await listImages();

  return NextResponse.json({ images });
}

export async function POST(request: Request) {
  if (!(await isAuthorized())) {
    return unauthorized();
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少图片文件" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "仅支持图片上传" }, { status: 400 });
  }

  const name = await saveUpload(file);

  return NextResponse.json({ ok: true, name });
}
