import { NextResponse, type NextRequest } from "next/server";

import { isAuthorized } from "@/app/_lib/auth";
import { getImagesPayload } from "@/app/_lib/storage";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "未授权" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized())) {
    return unauthorized();
  }

  const limit = Number(request.nextUrl.searchParams.get("limit"));
  const cursor = request.nextUrl.searchParams.get("cursor");
  const sourceId = request.nextUrl.searchParams.get("source");

  return NextResponse.json(
    await getImagesPayload(sourceId, {
      cursor,
      limit,
    }),
  );
}
