import "server-only";
import { resolveFreshness } from "@/lib/event-freshness";
import { isDemoDataEnabled } from "@/lib/runtime-demo";
import {
  fetchTainanCityIncidents,
  fetchTainanCityNews,
  isTdxConfigured,
} from "@/services/tdx-client";
import type {
  AccidentReport,
  ConstructionEvent,
  EventCatalog,
  LngLat,
} from "@/types/domain";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function point(row: Record<string, unknown>): LngLat | null {
  const lat = number(row.Latitude ?? row.lat ?? row.PositionLat);
  const lng = number(row.Longitude ?? row.lng ?? row.PositionLon);
  if (lat == null || lng == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function combined(row: Record<string, unknown>) {
  return [
    row.IncidentType,
    row.IncidentSubType,
    row.NewsType,
    row.Title,
    row.EventTitle,
    row.Description,
    row.Location,
    row.LocationName,
  ]
    .map(text)
    .filter(Boolean)
    .join(" ");
}

function isConstructionText(value: string) {
  return /施工|養護|封閉|改道|佔用|挖掘|工程|維修/.test(value);
}

function isAccidentText(value: string) {
  return /事故|碰撞|追撞|翻覆|火災|拋錨|故障|傷亡/.test(value);
}

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

export async function loadAccidentCatalog(): Promise<EventCatalog<AccidentReport>> {
  if (!isTdxConfigured()) {
    return isDemoDataEnabled() ? loadDemoAccidents() : emptyCatalog();
  }
  try {
    const rows = await fetchTainanCityIncidents();
    const items = rows
      .map((row) => toAccident(row))
      .filter((item): item is AccidentReport => Boolean(item));
    return {
      origin: "tdx-live",
      items,
      fetchedAt: new Date().toISOString(),
    };
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
    const [incidents, news] = await Promise.all([
      fetchTainanCityIncidents(),
      fetchTainanCityNews(),
    ]);
    const fromIncidents = incidents
      .map((row) => toConstruction(row, "incident"))
      .filter((item): item is ConstructionEvent => Boolean(item));
    const fromNews = news
      .map((row) => toConstruction(row, "news"))
      .filter((item): item is ConstructionEvent => Boolean(item));
    const seen = new Set<string>();
    const items = [...fromIncidents, ...fromNews].filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    return {
      origin: "tdx-live",
      items,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return isDemoDataEnabled() ? loadDemoConstruction() : emptyCatalog();
  }
}

function toAccident(row: Record<string, unknown>): AccidentReport | null {
  const blob = combined(row);
  if (isConstructionText(blob) && !isAccidentText(blob)) return null;
  const location = point(row);
  if (!location) return null;
  const updatedAt =
    text(row.UpdateTime) || text(row.PublishTime) || text(row.StartTime);
  const title =
    text(row.EventTitle) || text(row.Title) || text(row.IncidentType) || "交通事故";
  return {
    id:
      text(row.IncidentID) ||
      text(row.NewsID) ||
      `accident-${location.lat}-${location.lng}`,
    title,
    description: text(row.Description) || title,
    location,
    roadName: text(row.LocationName) || text(row.Location) || text(row.RoadName),
    direction: text(row.Direction) || text(row.RoadDirection),
    issuedAt: text(row.PublishTime) || text(row.StartTime) || updatedAt,
    updatedAt,
    severity: text(row.IncidentSubType) || text(row.Effect) || text(row.IncidentType),
    source: text(row.Source) || "TDX 交通事故",
    freshness: resolveFreshness("tdx-live", updatedAt),
  };
}

function toConstruction(
  row: Record<string, unknown>,
  kind: "incident" | "news",
): ConstructionEvent | null {
  const blob = combined(row);
  if (!isConstructionText(blob)) return null;
  const location = point(row);
  if (!location) return null;
  const updatedAt =
    text(row.UpdateTime) || text(row.PublishTime) || text(row.StartTime);
  const title =
    text(row.Title) || text(row.EventTitle) || text(row.NewsType) || "道路施工";
  return {
    id:
      text(row.NewsID) ||
      text(row.IncidentID) ||
      `${kind}-${location.lat}-${location.lng}`,
    title,
    description: text(row.Description) || title,
    location,
    roadName: text(row.LocationName) || text(row.Location) || text(row.RoadName),
    direction: text(row.Direction) || text(row.RoadDirection),
    issuedAt: text(row.PublishTime) || text(row.StartTime) || updatedAt,
    updatedAt,
    severity: text(row.NewsType) || text(row.IncidentType),
    source: text(row.Source) || text(row.Department) || "TDX 道路施工",
    freshness: resolveFreshness("tdx-live", updatedAt),
  };
}
