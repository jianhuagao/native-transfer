import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, getSessionCookieValue, verifyPassword } from "@/app/_lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = (await request.json()) as { password?: string };
  const password = payload.password?.trim() ?? "";

  if (!verifyPassword(password)) {
    return NextResponse.json(
      { error: "密码不正确" },
      {
        status: 401,
      }
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, getSessionCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ ok: true });
}
