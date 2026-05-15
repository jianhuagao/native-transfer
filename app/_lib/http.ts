import "server-only";

export async function readJsonObject(request: Request) {
  try {
    const value = await request.json();

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}
