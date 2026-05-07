import { NextResponse } from "next/server";

import { isAuthorized } from "@/app/_lib/auth";
import {
  transferImages,
  type TransferConflictStrategy,
} from "@/app/_lib/storage";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "未授权" }, { status: 401 });
}

function parseConflictStrategy(value: unknown): TransferConflictStrategy {
  if (value === "rename" || value === "overwrite" || value === "skip") {
    return value;
  }

  return "skip";
}

export async function POST(request: Request) {
  if (!(await isAuthorized())) {
    return unauthorized();
  }

  try {
    const body = (await request.json()) as {
      conflictStrategy?: unknown;
      deleteSourceAfterCopy?: unknown;
      fromSourceId?: unknown;
      ids?: unknown;
      toSourceId?: unknown;
    };

    if (
      typeof body.fromSourceId !== "string" ||
      typeof body.toSourceId !== "string" ||
      !Array.isArray(body.ids) ||
      !body.ids.every((id) => typeof id === "string")
    ) {
      return NextResponse.json({ error: "迁移参数无效" }, { status: 400 });
    }

    return NextResponse.json(
      await transferImages({
        conflictStrategy: parseConflictStrategy(body.conflictStrategy),
        deleteSourceAfterCopy: body.deleteSourceAfterCopy === true,
        fromSourceId: body.fromSourceId,
        ids: body.ids,
        toSourceId: body.toSourceId,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "迁移失败";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
