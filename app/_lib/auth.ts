import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const AUTH_COOKIE_NAME = "native-transfer-session";
const PREVIEW_TOKEN_TTL_MS = 1000 * 60 * 60 * 2;

export type ShareUploadTokenPayload = {
  allowVideo: boolean;
  createdAt: number;
  expiresAt: number;
  maxFiles: number;
  shareId: string;
  sourceId: string;
  version: 1;
};

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

function createPreviewTokenSignature(pathname: string, expiresAt: number) {
  return createHmac("sha256", getPassword())
    .update(`native-transfer-preview:${pathname}:${expiresAt}`)
    .digest("base64url");
}

function createShareUploadSignature(value: string) {
  return createHmac("sha256", getPassword())
    .update(`native-transfer-share-upload:${value}`)
    .digest("base64url");
}

function encodeSharePayload(payload: ShareUploadTokenPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function parseSharePayload(value: string): ShareUploadTokenPayload | null {
  try {
    const payload = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<ShareUploadTokenPayload>;

    if (
      payload.version !== 1 ||
      typeof payload.shareId !== "string" ||
      !/^[a-zA-Z0-9_-]{8,80}$/.test(payload.shareId) ||
      typeof payload.sourceId !== "string" ||
      !payload.sourceId ||
      typeof payload.createdAt !== "number" ||
      typeof payload.expiresAt !== "number" ||
      typeof payload.maxFiles !== "number" ||
      typeof payload.allowVideo !== "boolean"
    ) {
      return null;
    }

    return {
      allowVideo: payload.allowVideo,
      createdAt: payload.createdAt,
      expiresAt: payload.expiresAt,
      maxFiles: Math.min(100, Math.max(1, Math.floor(payload.maxFiles))),
      shareId: payload.shareId,
      sourceId: payload.sourceId,
      version: 1,
    };
  } catch {
    return null;
  }
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

export function createPreviewToken(pathname: string) {
  const expiresAt = Date.now() + PREVIEW_TOKEN_TTL_MS;

  return `${expiresAt}.${createPreviewTokenSignature(pathname, expiresAt)}`;
}

export function verifyPreviewToken(pathname: string, token: string | null) {
  if (!token) {
    return false;
  }

  const [expiresAtText, signature, ...rest] = token.split(".");
  const expiresAt = Number(expiresAtText);

  if (
    rest.length > 0 ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now() ||
    !signature
  ) {
    return false;
  }

  const expected = createPreviewTokenSignature(pathname, expiresAt);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function createShareUploadToken({
  allowVideo,
  expiresInMinutes,
  maxFiles,
  sourceId,
}: {
  allowVideo: boolean;
  expiresInMinutes: number;
  maxFiles: number;
  sourceId: string;
}) {
  const now = Date.now();
  const payload: ShareUploadTokenPayload = {
    allowVideo,
    createdAt: now,
    expiresAt: now + Math.max(1, Math.floor(expiresInMinutes)) * 60 * 1000,
    maxFiles: Math.min(100, Math.max(1, Math.floor(maxFiles))),
    shareId: randomUUID().replaceAll("-", ""),
    sourceId,
    version: 1,
  };
  const encodedPayload = encodeSharePayload(payload);

  return `${encodedPayload}.${createShareUploadSignature(encodedPayload)}`;
}

export function readShareUploadToken(token: string | null) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature, ...rest] = token.split(".");

  if (!encodedPayload || !signature || rest.length > 0) {
    return null;
  }

  const expected = createShareUploadSignature(encodedPayload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);

  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }

  return parseSharePayload(encodedPayload);
}

export function isShareUploadTokenActive(payload: ShareUploadTokenPayload) {
  return payload.expiresAt > Date.now();
}

export async function isAuthorized() {
  const cookieStore = await cookies();
  const session = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!session) {
    return false;
  }

  return session === getSessionCookieValue();
}
