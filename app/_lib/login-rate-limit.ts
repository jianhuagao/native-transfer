import "server-only";

const LOGIN_RATE_LIMIT_WINDOW_MS = 1000 * 60 * 15;
const LOGIN_RATE_LIMIT_LOCK_MS = 1000 * 60 * 15;
const LOGIN_RATE_LIMIT_MAX_FAILURES = 5;
const MAX_TRACKED_LOGIN_KEYS = 500;

type LoginAttemptState = {
  attempts: number;
  lockedUntil: number;
  windowStartedAt: number;
};

type LoginRateLimitStatus = {
  limited: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
};

const loginAttempts = new Map<string, LoginAttemptState>();

function getClientKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  const userAgent = request.headers.get("user-agent")?.slice(0, 120) ?? "";

  return forwardedIp || realIp || cfIp || `unknown:${userAgent}`;
}

function deleteExpiredAttempts(now: number) {
  for (const [key, state] of loginAttempts) {
    const windowExpired =
      state.windowStartedAt + LOGIN_RATE_LIMIT_WINDOW_MS <= now;
    const lockExpired = state.lockedUntil > 0 && state.lockedUntil <= now;

    if (windowExpired || lockExpired) {
      loginAttempts.delete(key);
    }
  }
}

function enforceMapSizeLimit() {
  while (loginAttempts.size > MAX_TRACKED_LOGIN_KEYS) {
    const oldestKey = loginAttempts.keys().next().value;

    if (!oldestKey) {
      break;
    }

    loginAttempts.delete(oldestKey);
  }
}

function getActiveState(request: Request, now = Date.now()) {
  deleteExpiredAttempts(now);
  return loginAttempts.get(getClientKey(request)) ?? null;
}

export function getLoginRateLimitStatus(
  request: Request,
): LoginRateLimitStatus {
  const now = Date.now();
  const state = getActiveState(request, now);

  if (!state) {
    return {
      limited: false,
      remainingAttempts: LOGIN_RATE_LIMIT_MAX_FAILURES,
      retryAfterSeconds: 0,
    };
  }

  if (state.lockedUntil > now) {
    return {
      limited: true,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil((state.lockedUntil - now) / 1000),
    };
  }

  return {
    limited: false,
    remainingAttempts: Math.max(
      0,
      LOGIN_RATE_LIMIT_MAX_FAILURES - state.attempts,
    ),
    retryAfterSeconds: 0,
  };
}

export function recordLoginFailure(request: Request): LoginRateLimitStatus {
  const now = Date.now();
  const key = getClientKey(request);
  const currentState = getActiveState(request, now);
  const nextAttempts = (currentState?.attempts ?? 0) + 1;
  const lockedUntil =
    nextAttempts >= LOGIN_RATE_LIMIT_MAX_FAILURES
      ? now + LOGIN_RATE_LIMIT_LOCK_MS
      : 0;

  loginAttempts.set(key, {
    attempts: nextAttempts,
    lockedUntil,
    windowStartedAt: currentState?.windowStartedAt ?? now,
  });
  enforceMapSizeLimit();

  return getLoginRateLimitStatus(request);
}

export function clearLoginRateLimit(request: Request) {
  loginAttempts.delete(getClientKey(request));
}
