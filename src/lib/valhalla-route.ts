import { decodePolyline } from "@/lib/polyline";
import type { OsrmStep } from "@/lib/osrm-maneuver";

export const DEFAULT_VALHALLA_ROUTE_URL =
  "https://valhalla1.openstreetmap.de/route";

type ValhallaManeuver = {
  type?: number;
  street_names?: string[];
  length?: number;
  time?: number;
  begin_shape_index?: number;
  roundabout_exit_count?: number;
};

type ValhallaLeg = {
  shape?: string;
  maneuvers?: ValhallaManeuver[];
};

type ValhallaTrip = {
  status?: number;
  status_message?: string;
  summary?: { length?: number; time?: number };
  legs?: ValhallaLeg[];
};

export type ValhallaRouteResult = {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  steps: OsrmStep[];
};

function motorcycleEndpoint() {
  const custom =
    process.env.VALHALLA_ROUTING_URL?.trim() ||
    process.env.MOTORCYCLE_ROUTING_URL?.trim();
  if (custom && !/route\/v1|project-osrm/i.test(custom)) return custom;
  return DEFAULT_VALHALLA_ROUTE_URL;
}

function streetName(maneuver: ValhallaManeuver) {
  const names = (maneuver.street_names ?? []).map((name) => name.trim()).filter(Boolean);
  const labeled = names.filter((name) => !/^\d+[A-Za-z]?$/.test(name));
  return (labeled[0] || names[0] || "").trim();
}

function osrmFromValhallaType(type: number): {
  type: string;
  modifier?: string;
} {
  switch (type) {
    case 1:
    case 2:
    case 3:
      return { type: "depart" };
    case 4:
    case 5:
    case 6:
      return { type: "arrive" };
    case 7:
      return { type: "new name" };
    case 8:
      return { type: "continue", modifier: "straight" };
    case 9:
      return { type: "turn", modifier: "slight right" };
    case 10:
      return { type: "turn", modifier: "right" };
    case 11:
      return { type: "turn", modifier: "sharp right" };
    case 12:
      return { type: "continue", modifier: "uturn" };
    case 13:
      return { type: "continue", modifier: "uturn" };
    case 14:
      return { type: "turn", modifier: "sharp left" };
    case 15:
      return { type: "turn", modifier: "left" };
    case 16:
      return { type: "turn", modifier: "slight left" };
    case 17:
      return { type: "on ramp", modifier: "straight" };
    case 18:
      return { type: "on ramp", modifier: "right" };
    case 19:
      return { type: "on ramp", modifier: "left" };
    case 20:
      return { type: "off ramp", modifier: "right" };
    case 21:
      return { type: "off ramp", modifier: "left" };
    case 22:
      return { type: "fork", modifier: "straight" };
    case 23:
      return { type: "fork", modifier: "right" };
    case 24:
      return { type: "fork", modifier: "left" };
    case 25:
      return { type: "merge" };
    case 26:
      return { type: "roundabout" };
    case 27:
      return { type: "exit roundabout" };
    case 28:
      return { type: "new name" };
    case 29:
      return { type: "new name" };
    default:
      return { type: "continue" };
  }
}

function pointAt(coordinates: [number, number][], index?: number) {
  if (!coordinates.length) return undefined;
  const at = Math.min(Math.max(index ?? 0, 0), coordinates.length - 1);
  return coordinates[at];
}

export function stepsFromValhalla(
  maneuvers: ValhallaManeuver[],
  coordinates: [number, number][],
): OsrmStep[] {
  return maneuvers.map((maneuver) => {
    const mapped = osrmFromValhallaType(maneuver.type ?? 0);
    const location = pointAt(coordinates, maneuver.begin_shape_index);
    return {
      name: streetName(maneuver),
      distance: Math.max(0, (maneuver.length ?? 0) * 1000),
      maneuver: {
        type: mapped.type,
        ...(mapped.modifier ? { modifier: mapped.modifier } : {}),
        ...(maneuver.roundabout_exit_count
          ? { exit: maneuver.roundabout_exit_count }
          : {}),
        ...(location ? { location } : {}),
      },
    } satisfies OsrmStep;
  });
}

export async function fetchValhallaMotorcycleRoute(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  timeoutMs = 10_000,
): Promise<ValhallaRouteResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(motorcycleEndpoint(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "navpilot/0.1 (motorcycle routing)",
      },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        locations: [
          { lon: fromLng, lat: fromLat },
          { lon: toLng, lat: toLat },
        ],
        costing: "motorcycle",
        costing_options: {
          motorcycle: {
            use_highways: 0,
            use_trails: 0,
            use_tolls: 0,
            exclude_highways: true,
          },
        },
        units: "kilometers",
        language: "zh-Hant",
        alternates: 0,
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { trip?: ValhallaTrip };
    const trip = data.trip;
    if (!trip || (trip.status != null && trip.status !== 0)) return null;
    const coordinates: [number, number][] = [];
    const steps: OsrmStep[] = [];
    for (const leg of trip.legs ?? []) {
      const line = leg.shape ? decodePolyline(leg.shape, 6) : [];
      steps.push(...stepsFromValhalla(leg.maneuvers ?? [], line));
      if (
        coordinates.length &&
        line.length &&
        coordinates[coordinates.length - 1][0] === line[0][0] &&
        coordinates[coordinates.length - 1][1] === line[0][1]
      ) {
        coordinates.push(...line.slice(1));
      } else {
        coordinates.push(...line);
      }
    }
    if (coordinates.length < 2) return null;
    const distanceMeters = Math.round((trip.summary?.length ?? 0) * 1000);
    const durationSeconds = Math.round(trip.summary?.time ?? 0);
    if (distanceMeters <= 0) return null;
    return { coordinates, distanceMeters, durationSeconds, steps };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
