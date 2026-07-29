export function formatApiError(err: unknown, fallback = "Something went wrong."): string {
  if (!err) return fallback;
  if (typeof err === "string") {
    const trimmed = err.trim();
    return trimmed && trimmed !== "{}" ? trimmed : fallback;
  }
  if (err instanceof Error) {
    const message = err.message?.trim();
    if (message && message !== "{}") return message;
  }
  if (typeof err === "object") {
    const record = err as Record<string, unknown>;
    for (const key of ["message", "msg", "error_description", "details", "hint", "error"]) {
      const value = record[key];
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed && trimmed !== "{}") return trimmed;
      }
    }
    try {
      const raw = JSON.stringify(err);
      if (raw && raw !== "{}") return raw;
    } catch {
      /* ignore */
    }
  }
  return fallback;
}

export function throwApiError(error: unknown, fallback = "Request failed"): never {
  throw new Error(formatApiError(error, fallback));
}
