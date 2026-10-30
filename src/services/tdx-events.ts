import "server-only";
import { resolveFreshness } from "@/lib/event-freshness";
import { representativeLngLat } from "@/lib/road-events/geometry";
import type { NormalizedRoadEvent } from "@/lib/road-events/types";
import { isDemoDataEnabled } from "@/lib/runtime-demo";
import { isTdxConfigured } from "@/services/tdx-client";
import { loadTainanTdxEvents } from "@/services/road-events";
import type {
  AccidentReport,
  ConstructionEvent,
  EventCatalog,
} from "@/types/domain";

function emptyCatalog<T>(): EventCatalog<T> {
  return {
    origin: "unavailable",
    items: [],
    fetchedAt: new Date().toISOString(),
  };
}

async function loadDemoAccidents(): Promise<EventCatalog<AccidentReport>> {
  const { TAINAN_ACCIDENTS } = await import("@/data/mock-route");
  const fetchedAt = new Date().toISOString();
  return {
    origin: "mock",
    fetchedAt,
    items: TAINAN_ACCIDENTS.map((item) => ({
      ...item,
      source: "示範資料",
      freshness: "unavailable" as const,
    })),
  };
}

async function loadDemoConstruction(): Promise<EventCatalog<ConstructionEvent>> {
  const { AHEAD_INTEL } = await import("@/data/mock-navigation");
  const fetchedAt = new Date().toISOString();
  return {
    origin: "mock",
    fetchedAt,
    items: AHEAD_INTEL.filter((item) => item.kind === "construction").map(
      (item, index) => ({
        id: item.id || `demo-construction-${index}`,
        title: item.title,
        description: item.detail,
        location: { lng: 120.2049, lat: 22.9878 },
        source: "示範資料",
        freshness: "unavailable" as const,
      }),
    ),
  };
}

function toMapEvent(
  event: NormalizedRoadEvent,
  fallbackTitle: string,
): AccidentReport | null {
  const point = representativeLngLat(event.geometry);
  if (!point) return null;
  const updatedAt = event.sourceUpdateTime ?? undefined;
  return {
    id: event.id,
    title: event.title || fallbackTitle,
    description: event.description || event.title || fallbackTitle,
    location: { lng: point[0], lat: point[1] },
    roadName: event.road ?? undefined,
    direction: event.direction ?? undefined,
    issuedAt: event.startTime ?? undefined,
    updatedAt,
    severity: event.severity ?? undefined,
    source: event.source,
    freshness: resolveFreshness("tdx-live", updatedAt),
  };
}

export async function loadAccidentCatalog(): Promise<EventCatalog<AccidentReport>> {
  if (!isTdxConfigured()) {
    return isDemoDataEnabled() ? loadDemoAccidents() : emptyCatalog();
  }
  try {
    const live = await loadTainanTdxEvents();
    if (!live?.ok) return isDemoDataEnabled() ? loadDemoAccidents() : emptyCatalog();
    const items = live.events
      .filter((event) => event.eventType === "accident")
      .map((event) => toMapEvent(event, "交通事故"))
      .filter((item): item is AccidentReport => Boolean(item));
    return { origin: "tdx-live", items, fetchedAt: new Date().toISOString() };
  } catch {
    return isDemoDataEnabled() ? loadDemoAccidents() : emptyCatalog();
  }
}

export async function loadConstructionCatalog(): Promise<
  EventCatalog<ConstructionEvent>
> {
  if (!isTdxConfigured()) {
    return isDemoDataEnabled() ? loadDemoConstruction() : emptyCatalog();
  }
  try {
    const live = await loadTainanTdxEvents();
    if (!live?.ok) {
      return isDemoDataEnabled() ? loadDemoConstruction() : emptyCatalog();
    }
    const items = live.events
      .filter((event) => event.eventType === "construction")
      .map((event) => toMapEvent(event, "道路施工"))
      .filter((item): item is ConstructionEvent => Boolean(item));
    return { origin: "tdx-live", items, fetchedAt: new Date().toISOString() };
  } catch {
    return isDemoDataEnabled() ? loadDemoConstruction() : emptyCatalog();
  }
}
