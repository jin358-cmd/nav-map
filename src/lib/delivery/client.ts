import type {
  CourierOrderView,
  CourierPresence,
  CustomerOrderView,
  DeliveryStore,
  DispatchMode,
  MenuItem,
  PublicOrder,
} from "@/lib/delivery/types";

export const DELIVERY_POLL_MS = 3000;
const CUSTOMER_KEY = "navpilot.delivery.customerId";
const COURIER_KEY = "navpilot.delivery.courierId";
const ACTIVE_ORDER_KEY = "navpilot.delivery.activeOrderId";
const ACTIVE_ORDER_EVENT = "navpilot-delivery-active-order";
const ACTOR_ID = /^[A-Za-z0-9_-]{8,128}$/;

export type DeliveryConfig = {
  ok: boolean;
  enabled?: boolean;
  dispatchMode?: DispatchMode;
  offerTimeoutSeconds?: number;
  grabRadiusMeters?: number;
  zoneRadiusMeters?: number;
  pollIntervalMs?: number;
  payment?: "skipped";
  provider?: "memory" | "supabase";
  error?: string;
  message?: string;
};

type Failure = { ok: false; error?: string; message?: string };

function deviceId(storageKey: string) {
  if (typeof window === "undefined") return "dev_pending_client";
  const existing = window.localStorage.getItem(storageKey);
  if (existing && ACTOR_ID.test(existing)) return existing;
  const next = `dev_${crypto.randomUUID().replaceAll("-", "")}`;
  window.localStorage.setItem(storageKey, next);
  return next;
}

export function customerDeviceId() {
  return deviceId(CUSTOMER_KEY);
}

export function courierDeviceId() {
  return deviceId(COURIER_KEY);
}

export function readActiveOrderId() {
  try {
    return window.sessionStorage.getItem(ACTIVE_ORDER_KEY);
  } catch {
    return null;
  }
}

export function subscribeActiveOrder(onStoreChange: () => void) {
  window.addEventListener(ACTIVE_ORDER_EVENT, onStoreChange);
  return () => window.removeEventListener(ACTIVE_ORDER_EVENT, onStoreChange);
}

export function writeActiveOrderId(orderId: string | null) {
  try {
    if (!orderId) window.sessionStorage.removeItem(ACTIVE_ORDER_KEY);
    else window.sessionStorage.setItem(ACTIVE_ORDER_KEY, orderId);
    window.dispatchEvent(new Event(ACTIVE_ORDER_EVENT));
  } catch {
    /* private mode */
  }
}

async function request<T>(
  path: string,
  input: {
    role: "customer" | "courier";
    actorId: string;
    googleIdToken?: string | null;
    method?: string;
    body?: unknown;
  },
): Promise<T | Failure> {
  const headers = new Headers();
  headers.set("x-delivery-role", input.role);
  headers.set("x-delivery-actor", input.actorId);
  if (input.googleIdToken) headers.set("authorization", `Bearer ${input.googleIdToken}`);
  if (input.body !== undefined) headers.set("content-type", "application/json");
  try {
    const response = await fetch(path, {
      method: input.method ?? (input.body === undefined ? "GET" : "POST"),
      headers,
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      cache: "no-store",
    });
    return (await response.json()) as T | Failure;
  } catch {
    return { ok: false, error: "unavailable", message: "外送服務暫時無法連線。" };
  }
}

export function fetchDeliveryConfig() {
  return request<DeliveryConfig>("/api/delivery/config", {
    role: "customer",
    actorId: "preview_config",
    method: "GET",
  });
}

export function fetchStores(actorId: string, googleIdToken?: string | null) {
  return request<{ ok: true; stores: DeliveryStore[] } | Failure>("/api/delivery/stores", {
    role: "customer",
    actorId,
    googleIdToken,
    method: "GET",
  });
}

export function fetchMenu(actorId: string, storeId: string, googleIdToken?: string | null) {
  return request<{ ok: true; store: DeliveryStore; menu: MenuItem[] } | Failure>(
    `/api/delivery/stores/${encodeURIComponent(storeId)}/menu`,
    { role: "customer", actorId, googleIdToken, method: "GET" },
  );
}

export function placeOrder(
  actorId: string,
  body: {
    storeId: string;
    lines: Array<{ menuItemId: string; qty: number }>;
    dropoff: { lng: number; lat: number; label?: string };
    customerLocation?: { lng: number; lat: number } | null;
    dispatchMode?: DispatchMode;
  },
  googleIdToken?: string | null,
) {
  return request<{ ok: true; order: PublicOrder; statusLabel: string } | Failure>("/api/delivery/orders", {
    role: "customer",
    actorId,
    googleIdToken,
    body,
  });
}

export function fetchOrder(actorId: string, orderId: string, googleIdToken?: string | null) {
  return request<(CustomerOrderView & { ok: true }) | Failure>(
    `/api/delivery/orders/${encodeURIComponent(orderId)}`,
    { role: "customer", actorId, googleIdToken, method: "GET" },
  );
}

export function cancelOrder(actorId: string, orderId: string, googleIdToken?: string | null) {
  return request<{ ok: true; order: PublicOrder; statusLabel: string } | Failure>(
    `/api/delivery/orders/${encodeURIComponent(orderId)}/cancel`,
    { role: "customer", actorId, googleIdToken, body: {} },
  );
}

export function sendCustomerLocation(
  actorId: string,
  orderId: string,
  point: { lng: number; lat: number },
  googleIdToken?: string | null,
) {
  return request<{ ok: true } | Failure>(`/api/delivery/orders/${encodeURIComponent(orderId)}/location`, {
    role: "customer",
    actorId,
    googleIdToken,
    body: point,
  });
}

export function setCourierOnline(
  actorId: string,
  body: {
    online: boolean;
    lng?: number;
    lat?: number;
    heading?: number | null;
    displayName?: string;
  },
) {
  return request<{ ok: true; courier: CourierPresence } | Failure>("/api/delivery/courier", {
    role: "courier",
    actorId,
    body,
  });
}

export function fetchCourierWork(actorId: string) {
  return request<{ ok: true; offers: CourierOrderView[]; active: CourierOrderView | null } | Failure>(
    "/api/delivery/courier/offers",
    { role: "courier", actorId, method: "GET" },
  );
}

export function rateCourier(
  actorId: string,
  orderId: string,
  body: { stars: number; comment?: string },
  googleIdToken?: string | null,
) {
  return request<{ ok: true; rating: { stars: number; comment: string | null } } | Failure>(
    `/api/delivery/orders/${encodeURIComponent(orderId)}/rating`,
    { role: "customer", actorId, googleIdToken, body },
  );
}

export function courierAction(
  actorId: string,
  orderId: string,
  action: "accept" | "decline" | "pickup" | "deliver",
) {
  return request<{ ok: true; order: PublicOrder; statusLabel: string } | Failure>(
    `/api/delivery/courier/orders/${encodeURIComponent(orderId)}`,
    { role: "courier", actorId, body: { action } },
  );
}
