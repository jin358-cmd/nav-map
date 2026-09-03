import type { AccidentReport, EventCatalog } from "@/types/domain";

export async function fetchAccidentReports(
  signal?: AbortSignal,
): Promise<EventCatalog<AccidentReport>> {
  const response = await fetch("/api/accidents", {
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error("accident catalog failed");
  }
  const data = (await response.json()) as EventCatalog<AccidentReport> & {
    accidents?: AccidentReport[];
  };
  return {
    origin: data.origin ?? "unavailable",
    items: data.items ?? data.accidents ?? [],
    fetchedAt: data.fetchedAt ?? new Date().toISOString(),
  };
}
