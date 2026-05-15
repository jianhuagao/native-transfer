import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, getSessionCookieValue, verifyPassword } from "@/app/_lib/auth";
import { readJsonObject } from "@/app/_lib/http";
import {
  clearLoginRateLimit,
  getLoginRateLimitStatus,
  recordLoginFailure,
} from "@/app/_lib/login-rate-limit";

export const runtime = "nodejs";

function rateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "尝试次数过多，请稍后再试" },
    {
      headers: {
        "Retry-After": retryAfterSeconds.toString(),
      },
      status: 429,
    },
  );
}

export async function POST(request: Request) {
  const rateLimitStatus = getLoginRateLimitStatus(request);

  if (rateLimitStatus.limited) {
    return rateLimitedResponse(rateLimitStatus.retryAfterSeconds);
  }

  const payload = await readJsonObject(request);
  const password =
    typeof payload?.password === "string" ? payload.password.trim() : "";

  if (!verifyPassword(password)) {
    const failedStatus = recordLoginFailure(request);

    if (failedStatus.limited) {
      return rateLimitedResponse(failedStatus.retryAfterSeconds);
    }

    return NextResponse.json(
      { error: "密码不正确" },
      {
        status: 401,
      }
    );
  }

  clearLoginRateLimit(request);

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
