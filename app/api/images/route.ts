import { NextResponse } from "next/server";

import { isAuthorized } from "@/app/_lib/auth";
import { getStorageUsage, listImages } from "@/app/_lib/storage";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "未授权" }, { status: 401 });
}

export async function GET() {
  if (!(await isAuthorized())) {
    return unauthorized();
  }

  const images = await listImages();

  return NextResponse.json({ images, storageUsage: getStorageUsage(images) });
}
