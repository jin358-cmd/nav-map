import assert from "node:assert/strict";
import { DeliveryGateway } from "../gateway";
import { MemoryDeliveryProvider } from "../memory-provider";
import { isNavPilotProjectUrl, NAVPILOT_SUPABASE_PROJECT_REF } from "../project";
import { isDeliveryPortalEnabled, readDispatchSettings } from "../settings";

const dropoff = { lng: 120.2049, lat: 22.9878, label: "目前位置" };

function provider() {
  return new MemoryDeliveryProvider(
    {
      mode: "nearest",
      offerTimeoutMs: 45_000,
      grabRadiusMeters: 3_000,
      zoneRadiusMeters: 8_000,
      locationStaleMs: 90_000,
    },
    () => 40_000,
  );
}

async function testCreateSkipsPaymentAndHidesOtherCustomers() {
  const gateway = new DeliveryGateway(provider());
  const created = await gateway.createOrder("customer_aaaaaa", {
    storeId: "store-east",
    lines: [{ menuItemId: "east-coffee", qty: 2 }],
    dropoff,
    dispatchMode: "nearest",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.order.amountCents, 0);
  assert.equal(created.order.paymentStatus, "skipped");
  assert.equal(created.order.status, "awaiting_dispatch");
  assert.equal("declinedCourierIds" in created.order, false);
  const hidden = await gateway.getOrder("customer_bbbbbb", created.order.id);
  assert.equal(hidden.ok, false);
  if (!hidden.ok) assert.equal(hidden.error, "not_found");
  const cancel = await gateway.cancelOrder("customer_bbbbbb", created.order.id);
  assert.equal(cancel.ok, false);
}

async function testAssignedOrderShowsCourierLocation() {
  const backend = provider();
  const gateway = new DeliveryGateway(backend);
  await backend.setCourierPresence({
    courierId: "courier_demo",
    displayName: "示範外送",
    online: true,
    lng: 120.223,
    lat: 22.985,
  });
  const created = await gateway.createOrder("customer_aaaaaa", {
    storeId: "store-east",
    lines: [{ menuItemId: "east-coffee", qty: 1 }],
    dropoff,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const accepted = await gateway.accept("courier_demo", created.order.id);
  assert.equal(accepted.ok, true);
  const view = await gateway.getOrder("customer_aaaaaa", created.order.id);
  assert.equal(view.ok, true);
  if (!view.ok) return;
  assert.equal(view.statusLabel, "外送員已接單");
  assert.equal(view.courier?.displayName, "示範外送");
  assert.ok(view.courier?.location);
  assert.equal(view.courier?.location?.lng, 120.223);
  const picked = await gateway.pickup("courier_demo", created.order.id);
  assert.equal(picked.ok, true);
  const delivered = await gateway.deliver("courier_demo", created.order.id);
  assert.equal(delivered.ok, true);
  if (delivered.ok) assert.equal(delivered.statusLabel, "已送達");
  const lateCancel = await gateway.cancelOrder("customer_aaaaaa", created.order.id);
  assert.equal(lateCancel.ok, false);
}

function testFlagsAndProjectLock() {
  assert.equal(isDeliveryPortalEnabled({ VERCEL_ENV: "preview" }), true);
  assert.equal(isDeliveryPortalEnabled({ NODE_ENV: "development" }), true);
  assert.equal(isDeliveryPortalEnabled({ NODE_ENV: "production" }), false);
  assert.equal(isDeliveryPortalEnabled({ NODE_ENV: "production", DELIVERY_PORTAL_ENABLED: "1" }), true);
  assert.equal(isDeliveryPortalEnabled({ VERCEL_ENV: "preview", DELIVERY_PORTAL_ENABLED: "false" }), false);
  assert.equal(readDispatchSettings({}).mode, "nearest");
  assert.equal(readDispatchSettings({ DELIVERY_DISPATCH_MODE: "grab" }).mode, "grab");
  assert.equal(
    isNavPilotProjectUrl(`https://${NAVPILOT_SUPABASE_PROJECT_REF}.supabase.co`),
    true,
  );
  assert.equal(isNavPilotProjectUrl("https://example.supabase.co"), false);
  assert.equal(isNavPilotProjectUrl("https://not-navpilot.supabase.co"), false);
}

function main() {
  testFlagsAndProjectLock();
  return Promise.all([
    testCreateSkipsPaymentAndHidesOtherCustomers(),
    testAssignedOrderShowsCourierLocation(),
  ]).then(() => {
    console.log(JSON.stringify({ ok: true, suite: "delivery-gateway", tests: 3 }));
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
