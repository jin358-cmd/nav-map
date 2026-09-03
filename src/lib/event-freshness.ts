import type { DataFreshness, EventDataOrigin } from "@/types/domain";

const STALE_AFTER_MS = 30 * 60 * 1000;

export function resolveFreshness(
  origin: EventDataOrigin | "ncdr-live" | "snapshot" | "tdx-live" | "mock" | "unavailable",
  updatedAt?: string,
): DataFreshness {
  if (origin === "unavailable") return "unavailable";
  if (origin === "mock") return "unavailable";
  if (!updatedAt) return "stale";
  const age = Date.now() - new Date(updatedAt).getTime();
  if (!Number.isFinite(age) || age < 0 || age > STALE_AFTER_MS) return "stale";
  return "live";
}
