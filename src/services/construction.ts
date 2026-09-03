import type { ConstructionEvent, EventCatalog } from "@/types/domain";

export async function fetchConstructionEvents(
  signal?: AbortSignal,
): Promise<EventCatalog<ConstructionEvent>> {
  const response = await fetch("/api/construction", {
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error("construction catalog failed");
  }
  const data = (await response.json()) as EventCatalog<ConstructionEvent> & {
    construction?: ConstructionEvent[];
  };
  return {
    origin: data.origin ?? "unavailable",
    items: data.items ?? data.construction ?? [],
    fetchedAt: data.fetchedAt ?? new Date().toISOString(),
  };
}
