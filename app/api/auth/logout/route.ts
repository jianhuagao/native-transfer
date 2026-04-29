import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/app/_lib/auth";
import { STORAGE_SOURCE_COOKIE_NAME } from "@/app/_lib/storage-providers";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  cookieStore.delete(STORAGE_SOURCE_COOKIE_NAME);

  return NextResponse.json({ ok: true });
}
