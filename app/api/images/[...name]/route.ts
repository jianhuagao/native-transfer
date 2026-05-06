import { NextResponse, type NextRequest } from "next/server";

import { isAuthorized } from "@/app/_lib/auth";
import {
  readImage,
  removeImage,
  verifySourcePreviewToken,
} from "@/app/_lib/storage";

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
  const sourceId = request.nextUrl.searchParams.get("source");
  const isDownload = request.nextUrl.searchParams.has("download");
  const previewToken = request.nextUrl.searchParams.get("token");
  const previewAllowed =
    !!sourceId &&
    !isDownload &&
    verifySourcePreviewToken(sourceId, pathname, previewToken);

  if (!previewAllowed && !(await isAuthorized())) {
    return unauthorized();
  }

  try {
    const {
      stream,
      fileName,
      mimeType,
      size,
      statusCode,
      acceptRanges,
      contentLength,
      contentRange,
    } = await readImage(pathname, request.headers.get("range"), sourceId);
    const disposition = isDownload
      ? `attachment; filename="${encodeURIComponent(fileName)}"`
      : `inline; filename="${encodeURIComponent(fileName)}"`;
    const headers: Record<string, string> = {
      "Content-Type": mimeType,
      "Content-Length": contentLength ?? size.toString(),
      "Content-Disposition": disposition,
      "Cache-Control": previewAllowed
        ? "public, max-age=31536000, immutable"
        : "private, no-store, no-cache, must-revalidate",
    };

    if (acceptRanges) {
      headers["Accept-Ranges"] = acceptRanges;
    }

    if (contentRange) {
      headers["Content-Range"] = contentRange;
    }

    return new NextResponse(stream, {
      status: statusCode,
      headers,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Blob not found") {
      return NextResponse.json({ error: "媒体不存在" }, { status: 404 });
    }

    console.error("Failed to read media", error);
    return NextResponse.json({ error: "读取媒体失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ name: string[] }> },
) {
  if (!(await isAuthorized())) {
    return unauthorized();
  }

  const { name } = await context.params;
  const sourceId = new URL(request.url).searchParams.get("source");
  await removeImage(getPathnameFromSegments(name), sourceId);

  return NextResponse.json({
    ok: true,
  });
}
