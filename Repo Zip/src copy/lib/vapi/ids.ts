export function normalizeProviderId(input: unknown): string {
  if (typeof input !== "string" || input.length < 10) {
    throw new Error("provider_id must be a UUID string");
  }
  return input;
}

export function normalizeAttemptId(input: unknown): number {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) throw new Error("attempt_id must be a number");
  return n;
}