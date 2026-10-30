#!/usr/bin/env node
// Two-party HTTP check for the delivery gateway.
// Point BASE_URL at one NavPilot server. Memory provider works only inside
// that single process. Supabase works across phones after the migration is applied.

const base = (process.env.BASE_URL || "http://127.0.0.1:43145").replace(/\/$/, "");
const customerId = "cust_http_check_01";
const courierA = "cour_http_check_a1";
const courierB = "cour_http_check_b1";

function headers(role, actorId) {
  return {
    "content-type": "application/json",
    "x-delivery-role": role,
    "x-delivery-actor": actorId,
  };
}

async function call(path, { method = "GET", role = "customer", actorId = customerId, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: headers(role, actorId),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { ok: false, message: text.slice(0, 180) };
  }
  return { status: response.status, data };
}

function fail(message, extra) {
  console.error(message);
  if (extra) console.error(JSON.stringify(extra, null, 2));
  process.exit(1);
}

const config = await call("/api/delivery/config");
if (config.data?.error === "disabled") {
  fail("外送功能旗標是關閉的。Preview 預設應為開啟。");
}
if (config.data?.ok !== true) fail("讀不到 /api/delivery/config", config);

const stores = await call("/api/delivery/stores");
if (stores.data?.error === "schema_missing") {
  console.log(stores.data.message);
  console.log("表還沒套用，HTTP 檢查在這裡停止。這是預期的降級，不是下單成功。");
  process.exit(2);
}
if (stores.data?.ok !== true || !stores.data.stores?.length) {
  fail("讀不到店家", stores);
}

const store = stores.data.stores.find((item) => item.id === "store-guohua") ?? stores.data.stores[0];
const menu = await call(`/api/delivery/stores/${encodeURIComponent(store.id)}/menu`);
if (menu.data?.ok !== true || !menu.data.menu?.length) fail("讀不到菜單", menu);
const item = menu.data.menu[0];

async function online(actorId, lng, lat) {
  const result = await call("/api/delivery/courier", {
    method: "POST",
    role: "courier",
    actorId,
    body: { online: true, lng, lat, displayName: actorId },
  });
  if (result.data?.ok !== true) fail(`${actorId} 上線失敗`, result);
}

await online(courierA, 120.194, 22.998);

const created = await call("/api/delivery/orders", {
  method: "POST",
  body: {
    storeId: store.id,
    lines: [{ menuItemId: item.id, qty: 1 }],
    dropoff: { lng: 120.2049, lat: 22.9878, label: "目前位置" },
    customerLocation: { lng: 120.2049, lat: 22.9878 },
    dispatchMode: "nearest",
  },
});
if (created.data?.ok !== true) fail("下單失敗", created);
if (created.data.order.amountCents !== 0 || created.data.order.paymentStatus !== "skipped") {
  fail("金額或付款狀態不對", created.data.order);
}
const orderId = created.data.order.id;

const offers = await call("/api/delivery/courier/offers", { role: "courier", actorId: courierA });
if (offers.data?.ok !== true) fail("讀不到外送員工作清單", offers);
const offer = (offers.data.offers ?? []).find((entry) => entry.order.id === orderId);
if (!offer) fail("最近的外送員沒有收到指派", offers.data);

const accepted = await call(`/api/delivery/courier/orders/${orderId}`, {
  method: "POST",
  role: "courier",
  actorId: courierA,
  body: { action: "accept" },
});
if (accepted.data?.ok !== true) fail("接單失敗", accepted);

const status = await call(`/api/delivery/orders/${orderId}`);
if (status.data?.order?.status !== "assigned" || !status.data?.courier?.location) {
  fail("顧客看不到已接單的外送員位置", status.data);
}

const stranger = await call(`/api/delivery/orders/${orderId}`, { actorId: "cust_http_other_02" });
if (stranger.data?.ok === true) fail("其他顧客不該看到這筆訂單", stranger.data);

const picked = await call(`/api/delivery/courier/orders/${orderId}`, {
  method: "POST",
  role: "courier",
  actorId: courierA,
  body: { action: "pickup" },
});
if (picked.data?.order?.status !== "picked_up") fail("取餐失敗", picked);
const delivered = await call(`/api/delivery/courier/orders/${orderId}`, {
  method: "POST",
  role: "courier",
  actorId: courierA,
  body: { action: "deliver" },
});
if (delivered.data?.order?.status !== "delivered") fail("送達失敗", delivered);

await online(courierA, 120.194, 22.998);
await online(courierB, 120.2, 22.99);
const grab = await call("/api/delivery/orders", {
  method: "POST",
  body: {
    storeId: store.id,
    lines: [{ menuItemId: item.id, qty: 1 }],
    dropoff: { lng: 120.2049, lat: 22.9878, label: "目前位置" },
    dispatchMode: "grab",
  },
});
if (grab.data?.ok !== true) fail("搶單下單失敗", grab);
const grabId = grab.data.order.id;
const [first, second] = await Promise.all([
  call(`/api/delivery/courier/orders/${grabId}`, {
    method: "POST",
    role: "courier",
    actorId: courierA,
    body: { action: "accept" },
  }),
  call(`/api/delivery/courier/orders/${grabId}`, {
    method: "POST",
    role: "courier",
    actorId: courierB,
    body: { action: "accept" },
  }),
]);
const grabWinners = [first, second].filter((result) => result.data?.ok === true);
if (grabWinners.length !== 1) fail("搶單應該只有一位外送員成功", { first: first.data, second: second.data });

console.log(JSON.stringify({
  ok: true,
  base,
  provider: config.data.provider,
  nearestOrderId: orderId,
  grabOrderId: grabId,
  grabWinner: grabWinners[0].data.order.courierId,
}));
