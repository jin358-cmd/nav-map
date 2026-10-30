import assert from "node:assert/strict";
import { grabClaimQuery, nearestClaimQuery } from "../claims";
import { planNearestDispatch, rankCouriers } from "../dispatch";
import { MemoryDeliveryProvider } from "../memory-provider";
import type { CourierCandidate, DeliveryOrder } from "../types";
import type { DispatchSettings } from "../settings";

const settings: DispatchSettings = {
  mode: "nearest",
  offerTimeoutMs: 1_000,
  grabRadiusMeters: 3_000,
  zoneRadiusMeters: 5_000,
  locationStaleMs: 60_000,
  newCourierCompletedThreshold: 10,
  newCourierMaxBonusMeters: 800,
  distanceTieMeters: 25,
};

function courier(partial: Partial<CourierCandidate> & Pick<CourierCandidate, "id" | "lng" | "lat">): CourierCandidate {
  return {
    online: true,
    updatedAtMs: 1_000,
    activeOrderId: null,
    pendingOfferOrderId: null,
    completedDeliveries: 10,
    ratingAverage: null,
    ratingCount: 0,
    ...partial,
  };
}

function order(partial: Partial<DeliveryOrder> = {}): DeliveryOrder {
  return {
    id: "order-1",
    customerId: "customer_1",
    storeId: "store-guohua",
    storeName: "國華街米粉湯",
    status: "awaiting_dispatch",
    dispatchMode: "nearest",
    lines: [],
    amountCents: 0,
    paymentStatus: "skipped",
    pickup: { lng: 120.1935, lat: 22.9972, label: "國華街米粉湯" },
    dropoff: { lng: 120.2049, lat: 22.9878, label: "目前位置" },
    customerLocation: null,
    courierId: null,
    offeredCourierId: null,
    offerExpiresAt: null,
    declinedCourierIds: [],
    createdAt: new Date(1_000).toISOString(),
    updatedAt: new Date(1_000).toISOString(),
    ...partial,
  };
}

function testNearestRanksByDistance() {
  const ranked = rankCouriers({
    pickup: { lng: 120.1935, lat: 22.9972 },
    couriers: [
      courier({ id: "far", lng: 120.22, lat: 22.99, updatedAtMs: 1_000 }),
      courier({ id: "near", lng: 120.194, lat: 22.998, updatedAtMs: 1_000 }),
      courier({ id: "offline", lng: 120.1936, lat: 22.9973, online: false, updatedAtMs: 1_000 }),
      courier({ id: "stale", lng: 120.1936, lat: 22.9973, updatedAtMs: 1_000 - 120_000 }),
      courier({ id: "busy", lng: 120.1937, lat: 22.9974, activeOrderId: "other", updatedAtMs: 1_000 }),
      courier({ id: "declined", lng: 120.1938, lat: 22.9975, updatedAtMs: 1_000 }),
    ],
    excluded: new Set(["declined"]),
    radiusMeters: 5_000,
    nowMs: 1_000,
    staleMs: 60_000,
    settings,
  });
  assert.deepEqual(ranked.map((item) => item.id), ["near", "far"]);
  assert.ok(ranked[0].meters < ranked[1].meters);
}

function testPlanKeepsLiveOfferAndFallsThrough() {
  const couriers = [
    courier({ id: "near", lng: 120.194, lat: 22.998 }),
    courier({ id: "far", lng: 120.22, lat: 22.99 }),
  ];
  const open = planNearestDispatch({
    order: order({
      offeredCourierId: "near",
      offerExpiresAt: new Date(5_000).toISOString(),
    }),
    couriers,
    settings,
    nowMs: 2_000,
  });
  assert.equal(open.kind, "keep");
  const expired = planNearestDispatch({
    order: order({
      offeredCourierId: "near",
      offerExpiresAt: new Date(1_500).toISOString(),
    }),
    couriers,
    settings,
    nowMs: 2_000,
  });
  assert.equal(expired.kind, "expire");
  if (expired.kind === "expire") {
    assert.equal(expired.expiredCourierId, "near");
    assert.equal(expired.nextCourierId, "far");
  }
}

function testClaimPredicates() {
  assert.match(grabClaimQuery("order-1"), /status=eq\.awaiting_dispatch/);
  assert.match(grabClaimQuery("order-1"), /dispatch_mode=eq\.grab/);
  assert.match(grabClaimQuery("order-1"), /courier_id=is\.null/);
  const nearest = nearestClaimQuery("order-1", "courier_near", "2026-10-30T00:00:00.000Z");
  assert.match(nearest, /offered_courier_id=eq\.courier_near/);
  assert.match(nearest, /offer_expires_at=gte\./);
}

async function testProviderTimeoutFallthrough() {
  let now = 10_000;
  const provider = new MemoryDeliveryProvider(settings, () => now);
  await provider.setCourierPresence({
    courierId: "courier_near",
    displayName: "近",
    online: true,
    lng: 120.194,
    lat: 22.998,
  });
  await provider.setCourierPresence({
    courierId: "courier_far",
    displayName: "遠",
    online: true,
    lng: 120.22,
    lat: 22.99,
  });
  const created = await provider.createOrder("customer_aaaaaa", {
    storeId: "store-guohua",
    lines: [{ menuItemId: "guohua-rice", qty: 1 }],
    dropoff: { lng: 120.2049, lat: 22.9878, label: "目前位置" },
    dispatchMode: "nearest",
  });
  const first = await provider.listCourierWork("courier_near");
  const other = await provider.listCourierWork("courier_far");
  assert.equal(first.offers.length, 1);
  assert.equal(other.offers.length, 0);
  now += settings.offerTimeoutMs + 1;
  await provider.advanceDispatch();
  const afterNear = await provider.listCourierWork("courier_near");
  const afterFar = await provider.listCourierWork("courier_far");
  assert.equal(afterNear.offers.length, 0);
  assert.equal(afterFar.offers.length, 1);
  assert.equal(afterFar.offers[0]?.order.id, created.id);
}

async function testDeclineFallsThrough() {
  const provider = new MemoryDeliveryProvider(settings, () => 20_000);
  await provider.setCourierPresence({
    courierId: "courier_near",
    displayName: "近",
    online: true,
    lng: 120.194,
    lat: 22.998,
  });
  await provider.setCourierPresence({
    courierId: "courier_far",
    displayName: "遠",
    online: true,
    lng: 120.22,
    lat: 22.99,
  });
  const created = await provider.createOrder("customer_aaaaaa", {
    storeId: "store-guohua",
    lines: [{ menuItemId: "guohua-rice", qty: 1 }],
    dropoff: { lng: 120.2049, lat: 22.9878 },
    dispatchMode: "nearest",
  });
  const declined = await provider.declineOrder("courier_near", created.id);
  assert.equal(declined.ok, true);
  if (declined.ok) assert.equal(declined.order.offeredCourierId, "courier_far");
  const far = await provider.listCourierWork("courier_far");
  assert.equal(far.offers[0]?.order.id, created.id);
}

async function testGrabHasOneWinner() {
  const provider = new MemoryDeliveryProvider(
    { ...settings, mode: "grab" },
    () => 30_000,
  );
  await provider.setCourierPresence({
    courierId: "courier_a",
    displayName: "甲",
    online: true,
    lng: 120.194,
    lat: 22.998,
  });
  await provider.setCourierPresence({
    courierId: "courier_b",
    displayName: "乙",
    online: true,
    lng: 120.2,
    lat: 22.99,
  });
  await provider.setCourierPresence({
    courierId: "courier_out",
    displayName: "遠",
    online: true,
    lng: 120.28,
    lat: 23.05,
  });
  const created = await provider.createOrder("customer_aaaaaa", {
    storeId: "store-guohua",
    lines: [{ menuItemId: "guohua-rice", qty: 1 }],
    dropoff: { lng: 120.2049, lat: 22.9878 },
    dispatchMode: "grab",
  });
  assert.equal(created.offeredCourierId, null);
  const outside = await provider.listCourierWork("courier_out");
  assert.equal(outside.offers.length, 0);
  const visible = await provider.listCourierWork("courier_a");
  assert.equal(visible.offers.length, 1);
  const results = await Promise.all([
    provider.acceptOrder("courier_a", created.id),
    provider.acceptOrder("courier_b", created.id),
    provider.acceptOrder("courier_a", created.id),
  ]);
  const winners = results.filter((result) => result.ok);
  assert.equal(winners.length, 1);
  if (winners[0]?.ok) {
    assert.equal(winners[0].order.status, "assigned");
    assert.ok(winners[0].order.courierId === "courier_a" || winners[0].order.courierId === "courier_b");
  }
  const loser = results.find((result) => !result.ok);
  assert.equal(loser?.ok, false);
  const again = await provider.listCourierWork("courier_a");
  const stillOffered = again.offers.filter((offer) => offer.order.id === created.id);
  assert.equal(stillOffered.length, 0);
}

async function main() {
  testNearestRanksByDistance();
  testPlanKeepsLiveOfferAndFallsThrough();
  testClaimPredicates();
  await testProviderTimeoutFallthrough();
  await testDeclineFallsThrough();
  await testGrabHasOneWinner();
  console.log(JSON.stringify({ ok: true, suite: "delivery-dispatch", tests: 6 }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
