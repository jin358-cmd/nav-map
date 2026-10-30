import { distanceKm } from "@/lib/geo";
import type { DispatchSettings } from "@/lib/delivery/settings";
import type {
  CourierCandidate,
  CourierRatingSummary,
  DeliveryOrder,
  GeoPoint,
} from "@/lib/delivery/types";

/**
 * Nearest dispatch ranks couriers in three steps:
 * 1. Weighted distance. A courier with fewer than
 *    `newCourierCompletedThreshold` completed deliveries is treated as closer
 *    by up to `newCourierMaxBonusMeters`. The bonus shrinks linearly to zero
 *    at the threshold. Actual distance must still be inside the zone, so a
 *    new courier outside the radius never enters the list, and one much
 *    farther than the bonus cannot pass a nearby courier.
 * 2. If weighted distances are within `distanceTieMeters`, the higher average
 *    rating wins. A courier with no ratings is not given a low score; rating
 *    does not separate them from anyone.
 * 3. If that still leaves two or more couriers tied, the order falls back to
 *    grab mode and the first accept wins.
 */
export type RankedCourier = CourierCandidate & {
  meters: number;
  weightedMeters: number;
};

export function newCourierBonusMeters(completedDeliveries: number, settings: DispatchSettings) {
  const threshold = settings.newCourierCompletedThreshold;
  if (completedDeliveries >= threshold) return 0;
  const remaining = threshold - Math.max(0, completedDeliveries);
  return settings.newCourierMaxBonusMeters * (remaining / threshold);
}

export function weightedDistanceMeters(
  actualMeters: number,
  completedDeliveries: number,
  settings: DispatchSettings,
) {
  return Math.max(0, actualMeters - newCourierBonusMeters(completedDeliveries, settings));
}

/** Negative when `a` should be offered before `b`. Zero when rating must not decide. */
export function compareRating(a: CourierCandidate, b: CourierCandidate) {
  if (a.ratingCount <= 0 || b.ratingCount <= 0) return 0;
  const left = a.ratingAverage ?? 0;
  const right = b.ratingAverage ?? 0;
  return right - left;
}

export function sameDispatchRank(a: RankedCourier, b: RankedCourier, settings: DispatchSettings) {
  return (
    Math.abs(a.weightedMeters - b.weightedMeters) <= settings.distanceTieMeters &&
    compareRating(a, b) === 0
  );
}

export function rankCouriers(input: {
  pickup: GeoPoint;
  couriers: CourierCandidate[];
  excluded: ReadonlySet<string>;
  radiusMeters: number;
  nowMs: number;
  staleMs: number;
  settings: DispatchSettings;
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
    .flatMap((courier) => {
      const meters = distanceKm(input.pickup, { lng: courier.lng, lat: courier.lat }) * 1000;
      if (meters > input.radiusMeters) return [];
      return [
        {
          ...courier,
          meters,
          weightedMeters: weightedDistanceMeters(meters, courier.completedDeliveries, input.settings),
        },
      ];
    })
    .sort((a, b) => {
      if (!sameDispatchRank(a, b, input.settings)) {
        const gap = a.weightedMeters - b.weightedMeters;
        if (Math.abs(gap) > input.settings.distanceTieMeters) return gap;
        const rating = compareRating(a, b);
        if (rating !== 0) return rating;
      }
      return a.weightedMeters - b.weightedMeters || a.id.localeCompare(b.id);
    });
}

export type NearestChoice =
  | { type: "none" }
  | { type: "offer"; courierId: string }
  | { type: "grab" };

export function chooseNearestOffer(ranked: RankedCourier[], settings: DispatchSettings): NearestChoice {
  const best = ranked[0];
  if (!best) return { type: "none" };
  const second = ranked[1];
  if (second && sameDispatchRank(best, second, settings)) return { type: "grab" };
  return { type: "offer", courierId: best.id };
}

export type NearestPlan =
  | { kind: "keep" }
  | { kind: "wait" }
  | { kind: "grab_fallback" }
  | {
      kind: "expire";
      expiredCourierId: string;
      nextCourierId: string | null;
      expiresAt: string | null;
      grabFallback: boolean;
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
    settings: input.settings,
    ignoreOfferOnOrderId: input.order.id,
    requireIdle: true,
  });
  const choice = chooseNearestOffer(ranked, input.settings);
  const expiresAt = new Date(input.nowMs + input.settings.offerTimeoutMs).toISOString();
  if (input.order.offeredCourierId) {
    return {
      kind: "expire",
      expiredCourierId: input.order.offeredCourierId,
      nextCourierId: choice.type === "offer" ? choice.courierId : null,
      expiresAt: choice.type === "offer" ? expiresAt : null,
      grabFallback: choice.type === "grab",
    };
  }
  if (choice.type === "grab") return { kind: "grab_fallback" };
  if (choice.type !== "offer") return { kind: "wait" };
  return { kind: "offer", courierId: choice.courierId, expiresAt };
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

export function toRatingSummary(courier: {
  ratingAverage: number | null;
  ratingCount: number;
  completedDeliveries: number;
}): CourierRatingSummary {
  return {
    average: courier.ratingCount > 0 ? courier.ratingAverage : null,
    count: courier.ratingCount,
    completedDeliveries: courier.completedDeliveries,
  };
}

export const EMPTY_RATING: CourierRatingSummary = {
  average: null,
  count: 0,
  completedDeliveries: 0,
};
