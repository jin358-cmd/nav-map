import "server-only";
import { querySignals } from "@/lib/traffic-signals/query.mjs";

export function loadTrafficSignals(query: {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
  center: { lng: number; lat: number } | null;
}) {
  return querySignals(query);
}
