import { formatDistance } from "@/lib/format";
import { projectToRoute, type RouteProgressModel } from "@/lib/route-progress";
import type {
  AccidentReport,
  ConstructionEvent,
  DisasterAlert,
  LngLat,
} from "@/types/domain";
import type { ScoredTrafficSegment } from "@/lib/traffic-query";
import { segmentAnchor } from "@/lib/traffic-query";

export type RouteAlertKind =
  | "closure"
  | "accident"
  | "construction"
  | "congestion";

export type RouteAlert = {
  id: string;
  kind: RouteAlertKind;
  emoji: string;
  headline: string;
  detail: string;
  aheadMeters: number;
};

const CORRIDOR_METERS = 80;
const PASSED_METERS = 35;
const PRIORITY: Record<RouteAlertKind, number> = {
  closure: 0,
  accident: 1,
  construction: 2,
  congestion: 3,
};

function isClosureText(value?: string) {
  return Boolean(value && /封閉|封路|管制|禁止通行/.test(value));
}

function projectAhead(
  location: LngLat,
  model: RouteProgressModel,
  routeMeters: number,
) {
  const projection = projectToRoute(location, model.segments);
  if (!projection) return null;
  if (projection.distanceMeters > CORRIDOR_METERS) return null;
  const aheadMeters = Math.round(projection.routeMeters - routeMeters);
  if (aheadMeters < -PASSED_METERS) return null;
  return {
    aheadMeters: Math.max(0, aheadMeters),
    offCorridor: projection.distanceMeters,
  };
}

export function pickActiveRouteAlert({
  model,
  routeMeters,
  accidents,
  constructions,
  disasters,
  traffic,
}: {
  model: RouteProgressModel | null;
  routeMeters: number;
  accidents: AccidentReport[];
  constructions: ConstructionEvent[];
  disasters: DisasterAlert[];
  traffic: ScoredTrafficSegment[];
}): RouteAlert | null {
  if (!model) return null;
  const alerts: RouteAlert[] = [];

  for (const item of constructions) {
    const ahead = projectAhead(item.location, model, routeMeters);
    if (!ahead) continue;
    alerts.push({
      id: `route-construction-${item.id}`,
      kind: "construction",
      emoji: "🚧",
      headline: `前方 ${formatDistance(ahead.aheadMeters)} 施工`,
      detail: "可能影響目前路線",
      aheadMeters: ahead.aheadMeters,
    });
  }

  for (const item of accidents) {
    const ahead = projectAhead(item.location, model, routeMeters);
    if (!ahead) continue;
    const closure = isClosureText(`${item.title} ${item.description}`);
    alerts.push({
      id: `route-accident-${item.id}`,
      kind: closure ? "closure" : "accident",
      emoji: closure ? "⛔" : "⚠️",
      headline: closure
        ? `前方 ${formatDistance(ahead.aheadMeters)} 道路封閉`
        : `前方 ${formatDistance(ahead.aheadMeters)} 事故`,
      detail: "可能影響目前路線",
      aheadMeters: ahead.aheadMeters,
    });
  }

  for (const item of disasters) {
    const closure =
      item.kind === "closure" || isClosureText(`${item.title} ${item.kind}`);
    if (!closure && item.kind !== "closure") continue;
    const ahead = projectAhead(item.location, model, routeMeters);
    if (!ahead) continue;
    alerts.push({
      id: `route-disaster-${item.id}`,
      kind: "closure",
      emoji: "⛔",
      headline: `前方 ${formatDistance(ahead.aheadMeters)} 道路管制`,
      detail: "可能影響目前路線",
      aheadMeters: ahead.aheadMeters,
    });
  }

  for (const segment of traffic) {
    if (segment.level !== "blocked" && segment.level !== "severe") continue;
    const ahead = projectAhead(segmentAnchor(segment), model, routeMeters);
    if (!ahead) continue;
    alerts.push({
      id: `route-traffic-${segment.id}`,
      kind: "congestion",
      emoji: "🚗",
      headline: `前方 ${formatDistance(ahead.aheadMeters)} 嚴重壅塞`,
      detail: "可能影響目前路線",
      aheadMeters: ahead.aheadMeters,
    });
  }

  alerts.sort((a, b) => {
    const rank = PRIORITY[a.kind] - PRIORITY[b.kind];
    if (rank !== 0) return rank;
    return a.aheadMeters - b.aheadMeters;
  });
  return alerts[0] ?? null;
}
