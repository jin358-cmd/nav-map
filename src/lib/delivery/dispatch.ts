import { distanceKm } from "@/lib/geo";
import type { DispatchSettings } from "@/lib/delivery/settings";
import type {
  CourierCandidate,
  DeliveryOrder,
  GeoPoint,
} from "@/lib/delivery/types";

export type RankedCourier = CourierCandidate & { meters: number };

export function rankCouriers(input: {
  pickup: GeoPoint;
  couriers: CourierCandidate[];
  excluded: ReadonlySet<string>;
  radiusMeters: number;
  nowMs: number;
  staleMs: number;
  ignoreOfferOnOrderId?: string | null;
  requireIdle?: boolean;
}): RankedCourier[] {
  const requireIdle = input.requireIdle !== false;
  return input.couriers
    .filter((courier) => courier.online)
    .filter((courier) => input.nowMs - courier.updatedAtMs <= input.staleMs)
    .filter((courier) => (requireIdle ? courier.activeOrderId == null : true))
    .filter((courier) => {
      if (!requireIdle) return true;
      if (courier.pendingOfferOrderId == null) return true;
      return courier.pendingOfferOrderId === input.ignoreOfferOnOrderId;
    })
    .filter((courier) => !input.excluded.has(courier.id))
    .map((courier) => ({
      ...courier,
      meters: distanceKm(input.pickup, { lng: courier.lng, lat: courier.lat }) * 1000,
    }))
    .filter((courier) => courier.meters <= input.radiusMeters)
    .sort((a, b) => a.meters - b.meters || a.id.localeCompare(b.id));
}

export type NearestPlan =
  | { kind: "keep" }
  | { kind: "wait" }
  | {
      kind: "expire";
      expiredCourierId: string;
      nextCourierId: string | null;
      expiresAt: string | null;
    }
  | { kind: "offer"; courierId: string; expiresAt: string };

export function planNearestDispatch(input: {
  order: DeliveryOrder;
  couriers: CourierCandidate[];
  settings: DispatchSettings;
  nowMs: number;
}): NearestPlan {
  const offerOpen =
    input.order.offeredCourierId != null &&
    input.order.offerExpiresAt != null &&
    Date.parse(input.order.offerExpiresAt) > input.nowMs;
  if (offerOpen) return { kind: "keep" };

  const excluded = new Set(input.order.declinedCourierIds);
  if (input.order.offeredCourierId) excluded.add(input.order.offeredCourierId);
  const ranked = rankCouriers({
    pickup: input.order.pickup,
    couriers: input.couriers,
    excluded,
    radiusMeters: input.settings.zoneRadiusMeters,
    nowMs: input.nowMs,
    staleMs: input.settings.locationStaleMs,
    ignoreOfferOnOrderId: input.order.id,
    requireIdle: true,
  });
  const next = ranked[0] ?? null;
  const expiresAt = next
    ? new Date(input.nowMs + input.settings.offerTimeoutMs).toISOString()
    : null;
  if (input.order.offeredCourierId) {
    return {
      kind: "expire",
      expiredCourierId: input.order.offeredCourierId,
      nextCourierId: next?.id ?? null,
      expiresAt,
    };
  }
  if (!next || !expiresAt) return { kind: "wait" };
  return { kind: "offer", courierId: next.id, expiresAt };
}

export function grabDistanceMeters(
  order: DeliveryOrder,
  courier: CourierCandidate,
  settings: DispatchSettings,
  nowMs: number,
) {
  if (!courier.online) return null;
  if (nowMs - courier.updatedAtMs > settings.locationStaleMs) return null;
  const meters = distanceKm(order.pickup, { lng: courier.lng, lat: courier.lat }) * 1000;
  if (meters > settings.grabRadiusMeters) return null;
  return meters;
}
