import { NextResponse, type NextRequest } from "next/server";

import { isAuthorized, verifyPreviewToken } from "@/app/_lib/auth";
import { listImages, readImage, removeImage } from "@/app/_lib/storage";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "未授权" }, { status: 401 });
}

function getPathnameFromSegments(segments: string[]) {
  return segments.join("/");
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ name: string[] }> },
) {
  const { name } = await context.params;
  const pathname = getPathnameFromSegments(name);
  const isDownload = request.nextUrl.searchParams.has("download");
  const previewToken = request.nextUrl.searchParams.get("token");
  const previewAllowed =
    !isDownload && verifyPreviewToken(pathname, previewToken);

  if (!previewAllowed && !(await isAuthorized())) {
    return unauthorized();
  }

  try {
    const { stream, fileName, mimeType, size } = await readImage(pathname);
    const disposition = isDownload
      ? `attachment; filename="${encodeURIComponent(fileName)}"`
      : `inline; filename="${encodeURIComponent(fileName)}"`;

    return new NextResponse(stream, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": size.toString(),
        "Content-Disposition": disposition,
        "Cache-Control": previewAllowed
          ? "public, max-age=31536000, immutable"
          : "private, no-store, no-cache, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json({ error: "图片不存在" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ name: string[] }> },
) {
  if (!(await isAuthorized())) {
    return unauthorized();
  }

  const { name } = await context.params;
  await removeImage(getPathnameFromSegments(name));

  const images = await listImages();

  return NextResponse.json({ ok: true, images });
}
