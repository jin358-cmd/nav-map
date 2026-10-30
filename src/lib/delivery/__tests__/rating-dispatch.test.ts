import assert from "node:assert/strict";
import { planNearestDispatch, rankCouriers, weightedDistanceMeters } from "../dispatch";
import { DeliveryGateway } from "../gateway";
import { MemoryDeliveryProvider } from "../memory-provider";
import { readDispatchSettings, type DispatchSettings } from "../settings";
import type { CourierCandidate, DeliveryOrder } from "../types";

const settings: DispatchSettings = {
  ...readDispatchSettings({}),
  offerTimeoutMs: 45_000,
  zoneRadiusMeters: 5_000,
  grabRadiusMeters: 3_000,
  newCourierCompletedThreshold: 10,
  newCourierMaxBonusMeters: 800,
  distanceTieMeters: 25,
};

const pickup = { lng: 120.1935, lat: 22.9972 };

function north(meters: number) {
  return { lng: pickup.lng, lat: pickup.lat + meters / 111_320 };
}

function courier(
  partial: Partial<CourierCandidate> & Pick<CourierCandidate, "id"> & { meters: number },
): CourierCandidate {
  const point = north(partial.meters);
  return {
    online: true,
    updatedAtMs: 1_000,
    activeOrderId: null,
    pendingOfferOrderId: null,
    completedDeliveries: 20,
    ratingAverage: null,
    ratingCount: 0,
    lng: point.lng,
    lat: point.lat,
    ...partial,
  };
}

function blankOrder(partial: Partial<DeliveryOrder> = {}): DeliveryOrder {
  return {
    id: "order-1",
    customerId: "customer_aaaaaa",
    storeId: "store-guohua",
    storeName: "國華街米粉湯",
    status: "awaiting_dispatch",
    dispatchMode: "nearest",
    lines: [],
    amountCents: 0,
    paymentStatus: "skipped",
    pickup: { ...pickup, label: "國華街米粉湯" },
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

function ranked(couriers: CourierCandidate[]) {
  return rankCouriers({
    pickup,
    couriers,
    excluded: new Set(),
    radiusMeters: settings.zoneRadiusMeters,
    nowMs: 1_000,
    staleMs: 60_000,
    settings,
  });
}

function testNewCourierBeatsASlightlyNearerVeteran() {
  const list = ranked([
    courier({ id: "veteran", meters: 200, completedDeliveries: 10 }),
    courier({ id: "newbie", meters: 900, completedDeliveries: 0 }),
  ]);
  assert.equal(list[0]?.id, "newbie");
  assert.equal(weightedDistanceMeters(900, 0, settings), 100);
  assert.ok((list[0]?.weightedMeters ?? 0) < (list[1]?.weightedMeters ?? 0));
}

function testFarNewCourierDoesNotBeatANearVeteran() {
  const list = ranked([
    courier({ id: "newbie", meters: 2_000, completedDeliveries: 0 }),
    courier({ id: "veteran", meters: 400, completedDeliveries: 40 }),
  ]);
  assert.equal(list[0]?.id, "veteran");
  const newbie = list.find((item) => item.id === "newbie");
  assert.ok(newbie);
  assert.ok(newbie.weightedMeters > 1_000);
  assert.ok(newbie.weightedMeters > (list[0]?.weightedMeters ?? 0));
}

function testBonusDoesNotAdmitACourierOutsideTheZone() {
  const list = ranked([
    courier({ id: "newbie", meters: 5_500, completedDeliveries: 0 }),
    courier({ id: "veteran", meters: 4_200, completedDeliveries: 12 }),
  ]);
  assert.deepEqual(list.map((item) => item.id), ["veteran"]);
}

function testHigherRatingWinsADistanceTie() {
  const list = ranked([
    courier({ id: "low", meters: 300, ratingAverage: 3.2, ratingCount: 4 }),
    courier({ id: "high", meters: 310, ratingAverage: 4.8, ratingCount: 6 }),
  ]);
  assert.equal(list[0]?.id, "high");
  const plan = planNearestDispatch({
    order: blankOrder(),
    couriers: [
      courier({ id: "low", meters: 300, ratingAverage: 3.2, ratingCount: 4 }),
      courier({ id: "high", meters: 310, ratingAverage: 4.8, ratingCount: 6 }),
    ],
    settings,
    nowMs: 1_000,
  });
  assert.equal(plan.kind, "offer");
  if (plan.kind === "offer") assert.equal(plan.courierId, "high");
}

function testUnratedCourierIsNotPenalised() {
  const plan = planNearestDispatch({
    order: blankOrder(),
    couriers: [
      courier({ id: "unrated", meters: 300, ratingAverage: null, ratingCount: 0 }),
      courier({ id: "star", meters: 300, ratingAverage: 5, ratingCount: 8 }),
    ],
    settings,
    nowMs: 1_000,
  });
  assert.equal(plan.kind, "grab_fallback");
}

function testEqualRatingsFallBackToGrab() {
  const plan = planNearestDispatch({
    order: blankOrder(),
    couriers: [
      courier({ id: "a", meters: 250, ratingAverage: 4, ratingCount: 3 }),
      courier({ id: "b", meters: 250, ratingAverage: 4, ratingCount: 3 }),
    ],
    settings,
    nowMs: 1_000,
  });
  assert.equal(plan.kind, "grab_fallback");
}

function testClearDistanceIgnoresRating() {
  const list = ranked([
    courier({ id: "near", meters: 150, ratingAverage: 3, ratingCount: 2 }),
    courier({ id: "far", meters: 900, ratingAverage: 5, ratingCount: 20 }),
  ]);
  assert.equal(list[0]?.id, "near");
}

async function testGrabFallbackIsVisibleToBothCouriers() {
  const provider = new MemoryDeliveryProvider(settings, () => 5_000);
  const point = north(300);
  await provider.setCourierPresence({
    courierId: "courier_a",
    displayName: "甲",
    online: true,
    lng: point.lng,
    lat: point.lat,
  });
  await provider.setCourierPresence({
    courierId: "courier_b",
    displayName: "乙",
    online: true,
    lng: point.lng,
    lat: point.lat,
  });
  const created = await provider.createOrder("customer_aaaaaa", {
    storeId: "store-guohua",
    lines: [{ menuItemId: "guohua-rice", qty: 1 }],
    dropoff: { lng: 120.2049, lat: 22.9878 },
    dispatchMode: "nearest",
  });
  assert.equal(created.dispatchMode, "grab");
  assert.equal(created.offeredCourierId, null);
  const first = await provider.listCourierWork("courier_a");
  const second = await provider.listCourierWork("courier_b");
  assert.equal(first.offers.length, 1);
  assert.equal(second.offers.length, 1);
}

async function testRatingRules() {
  const gateway = new DeliveryGateway(new MemoryDeliveryProvider(settings, () => 8_000));
  const provider = new MemoryDeliveryProvider(settings, () => 8_000);
  const owned = new DeliveryGateway(provider);
  await provider.setCourierPresence({
    courierId: "courier_demo",
    displayName: "示範",
    online: true,
    lng: north(180).lng,
    lat: north(180).lat,
  });
  const created = await owned.createOrder("customer_aaaaaa", {
    storeId: "store-guohua",
    lines: [{ menuItemId: "guohua-rice", qty: 1 }],
    dropoff: { lng: 120.2049, lat: 22.9878 },
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const tooSoon = await owned.rateOrder("customer_aaaaaa", created.order.id, { stars: 5 });
  assert.equal(tooSoon.ok, false);
  await provider.acceptOrder("courier_demo", created.order.id);
  await provider.markPickedUp("courier_demo", created.order.id);
  await provider.markDelivered("courier_demo", created.order.id);
  const stranger = await owned.rateOrder("customer_bbbbbb", created.order.id, { stars: 1 });
  assert.equal(stranger.ok, false);
  if (!stranger.ok) assert.equal(stranger.error, "not_found");
  const invalid = await gateway.rateOrder("customer_aaaaaa", created.order.id, { stars: 6 });
  assert.equal(invalid.ok, false);
  const rated = await owned.rateOrder("customer_aaaaaa", created.order.id, {
    stars: 4,
    comment: "  準時  ",
  });
  assert.equal(rated.ok, true);
  if (!rated.ok) return;
  assert.equal(rated.rating.stars, 4);
  assert.equal(rated.rating.comment, "準時");
  assert.equal(rated.summary.average, 4);
  assert.equal(rated.summary.count, 1);
  assert.equal(rated.summary.completedDeliveries, 1);
  const again = await owned.rateOrder("customer_aaaaaa", created.order.id, { stars: 5 });
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.error, "conflict");
  const view = await owned.getOrder("customer_aaaaaa", created.order.id);
  assert.equal(view.ok, true);
  if (view.ok) {
    assert.equal(view.myRating?.stars, 4);
    assert.equal(view.courier?.rating.average, 4);
  }
}

testNewCourierBeatsASlightlyNearerVeteran();
testFarNewCourierDoesNotBeatANearVeteran();
testBonusDoesNotAdmitACourierOutsideTheZone();
testHigherRatingWinsADistanceTie();
testUnratedCourierIsNotPenalised();
testEqualRatingsFallBackToGrab();
testClearDistanceIgnoresRating();

function main() {
  return Promise.all([testGrabFallbackIsVisibleToBothCouriers(), testRatingRules()]).then(() => {
    console.log(JSON.stringify({ ok: true, suite: "delivery-rating-dispatch", tests: 9 }));
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
