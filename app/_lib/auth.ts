import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const AUTH_COOKIE_NAME = "native-transfer-session";

function getPassword() {
  const password = process.env.TRANSFER_PASSWORD;

  if (!password) {
    throw new Error("TRANSFER_PASSWORD is not configured.");
  }

  return password;
}

function createSessionValue(password: string) {
  return createHash("sha256")
    .update(`native-transfer:${password}`)
    .digest("hex");
}

export function verifyPassword(input: string) {
  const configuredPassword = getPassword();
  const left = Buffer.from(input);
  const right = Buffer.from(configuredPassword);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function getSessionCookieValue() {
  return createSessionValue(getPassword());
}

export async function isAuthorized() {
  const cookieStore = await cookies();
  const session = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!session) {
    return false;
  }

  return session === getSessionCookieValue();
}
