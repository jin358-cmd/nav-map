import { randomUUID } from "node:crypto";
import { grabDistanceMeters, planNearestDispatch } from "@/lib/delivery/dispatch";
import { DELIVERY_STORES, menuForStore } from "@/lib/delivery/fixtures";
import { statusLabel } from "@/lib/delivery/labels";
import { toPublicOrder } from "@/lib/delivery/present";
import type { DeliveryProvider } from "@/lib/delivery/provider";
import { readDispatchSettings, type DispatchSettings } from "@/lib/delivery/settings";
import { assertTransition } from "@/lib/delivery/state-machine";
import { distanceKm } from "@/lib/geo";
import type {
  ClaimReason,
  CourierCandidate,
  CourierOrderView,
  CourierPresence,
  CreateOrderInput,
  CustomerOrderView,
  DeliveryOrder,
} from "@/lib/delivery/types";

type StoredCourier = {
  id: string;
  displayName: string;
  online: boolean;
  lng: number | null;
  lat: number | null;
  heading: number | null;
  updatedAt: string | null;
};

function cloneOrder(order: DeliveryOrder): DeliveryOrder {
  return structuredClone(order);
}

function fail(reason: ClaimReason): { ok: false; reason: ClaimReason } {
  return { ok: false, reason };
}

export class MemoryDeliveryProvider implements DeliveryProvider {
  readonly settings: DispatchSettings;
  private readonly orders = new Map<string, DeliveryOrder>();
  private readonly couriers = new Map<string, StoredCourier>();
  private tail: Promise<void> = Promise.resolve();
  private readonly now: () => number;

  constructor(settings?: Partial<DispatchSettings>, now: () => number = Date.now) {
    this.settings = { ...readDispatchSettings({}), ...settings };
    this.now = now;
  }

  private exclusive<T>(fn: () => T | Promise<T>): Promise<T> {
    const run = this.tail.then(fn, fn);
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async listStores() {
    return DELIVERY_STORES.map((store) => ({ ...store }));
  }

  async getStore(storeId: string) {
    return DELIVERY_STORES.find((store) => store.id === storeId) ?? null;
  }

  async getMenu(storeId: string) {
    return menuForStore(storeId).map((item) => ({ ...item }));
  }

  async createOrder(customerId: string, input: CreateOrderInput) {
    return this.exclusive(() => {
      const store = DELIVERY_STORES.find((item) => item.id === input.storeId);
      if (!store) throw new Error("store missing");
      const menu = menuForStore(store.id);
      const lines = input.lines.map((line) => {
        const item = menu.find((entry) => entry.id === line.menuItemId);
        if (!item) throw new Error("menu missing");
        return {
          menuItemId: item.id,
          name: item.name,
          qty: line.qty,
          priceCents: 0 as const,
        };
      });
      const nowIso = new Date(this.now()).toISOString();
      const created: DeliveryOrder = {
        id: randomUUID(),
        customerId,
        storeId: store.id,
        storeName: store.name,
        status: "created",
        dispatchMode: input.dispatchMode ?? this.settings.mode,
        lines,
        amountCents: 0,
        paymentStatus: "skipped",
        pickup: { lng: store.lng, lat: store.lat, label: store.name },
        dropoff: {
          lng: input.dropoff.lng,
          lat: input.dropoff.lat,
          label: input.dropoff.label?.trim() || "送達位置",
        },
        customerLocation: input.customerLocation
          ? { ...input.customerLocation, updatedAt: nowIso }
          : {
              lng: input.dropoff.lng,
              lat: input.dropoff.lat,
              updatedAt: nowIso,
            },
        courierId: null,
        offeredCourierId: null,
        offerExpiresAt: null,
        declinedCourierIds: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      created.status = assertTransition(created.status, "awaiting_dispatch");
      this.orders.set(created.id, created);
      this.applyDispatch(created.id);
      return cloneOrder(this.orders.get(created.id)!);
    });
  }

  async getOrderForCustomer(customerId: string, orderId: string) {
    return this.exclusive(() => {
      this.applyDispatch();
      const order = this.orders.get(orderId);
      if (!order || order.customerId !== customerId) return null;
      return this.customerView(order);
    });
  }

  async cancelOrder(customerId: string, orderId: string) {
    return this.exclusive(() => {
      const order = this.orders.get(orderId);
      if (!order || order.customerId !== customerId) return "not_found" as const;
      try {
        order.status = assertTransition(order.status, "cancelled");
      } catch {
        return "invalid_state" as const;
      }
      order.offeredCourierId = null;
      order.offerExpiresAt = null;
      order.updatedAt = new Date(this.now()).toISOString();
      return cloneOrder(order);
    });
  }

  async updateCustomerLocation(
    customerId: string,
    orderId: string,
    point: { lng: number; lat: number },
  ) {
    return this.exclusive(() => {
      const order = this.orders.get(orderId);
      if (!order || order.customerId !== customerId) return false;
      order.customerLocation = { ...point, updatedAt: new Date(this.now()).toISOString() };
      order.updatedAt = order.customerLocation.updatedAt;
      return true;
    });
  }

  async setCourierPresence(input: {
    courierId: string;
    displayName: string;
    online: boolean;
    lng?: number;
    lat?: number;
    heading?: number | null;
  }) {
    return this.exclusive(() => {
      const current = this.couriers.get(input.courierId);
      const hasPoint = Number.isFinite(input.lng) && Number.isFinite(input.lat);
      const next: StoredCourier = {
        id: input.courierId,
        displayName: input.displayName || current?.displayName || "外送員",
        online: input.online,
        lng: hasPoint ? input.lng! : (current?.lng ?? null),
        lat: hasPoint ? input.lat! : (current?.lat ?? null),
        heading: input.heading ?? current?.heading ?? null,
        updatedAt: hasPoint || input.online ? new Date(this.now()).toISOString() : current?.updatedAt ?? null,
      };
      if (!input.online) {
        next.online = false;
      }
      this.couriers.set(input.courierId, next);
      if (input.online) this.applyDispatch();
      return this.presence(next);
    });
  }

  async listCourierWork(courierId: string) {
    return this.exclusive(() => {
      this.applyDispatch();
      const courier = this.couriers.get(courierId);
      const candidate = courier ? this.candidate(courier) : null;
      const offers: CourierOrderView[] = [];
      let active: CourierOrderView | null = null;
      for (const order of this.orders.values()) {
        if (order.courierId === courierId && (order.status === "assigned" || order.status === "picked_up")) {
          active = this.courierView(order, candidate);
          continue;
        }
        if (order.status !== "awaiting_dispatch" || !candidate) continue;
        if (
          order.dispatchMode === "nearest" &&
          order.offeredCourierId === courierId &&
          order.offerExpiresAt &&
          Date.parse(order.offerExpiresAt) > this.now()
        ) {
          offers.push(this.courierView(order, candidate));
        }
        if (order.dispatchMode === "grab" && grabDistanceMeters(order, candidate, this.settings, this.now()) != null) {
          offers.push(this.courierView(order, candidate));
        }
      }
      return { offers, active };
    });
  }

  async acceptOrder(courierId: string, orderId: string) {
    return this.exclusive(() => {
      const order = this.orders.get(orderId);
      const courier = this.couriers.get(courierId);
      if (!order || !courier) return fail("not_found");
      if (this.courierActiveOrderId(courierId)) return fail("busy");
      if (!courier.online || courier.lng == null || courier.lat == null) return fail("offline");
      if (order.status !== "awaiting_dispatch" || order.courierId) return fail("lost");
      const candidate = this.candidate(courier);
      if (!candidate) return fail("offline");
      if (order.dispatchMode === "nearest") {
        if (order.offeredCourierId !== courierId) return fail("lost");
        if (!order.offerExpiresAt || Date.parse(order.offerExpiresAt) <= this.now()) return fail("expired");
      } else if (grabDistanceMeters(order, candidate, this.settings, this.now()) == null) {
        return fail("out_of_range");
      }
      order.status = assertTransition(order.status, "assigned");
      order.courierId = courierId;
      order.offeredCourierId = null;
      order.offerExpiresAt = null;
      order.updatedAt = new Date(this.now()).toISOString();
      return { ok: true as const, order: cloneOrder(order) };
    });
  }

  async declineOrder(courierId: string, orderId: string) {
    return this.exclusive(() => {
      const order = this.orders.get(orderId);
      if (!order) return fail("not_found");
      if (order.dispatchMode !== "nearest" || order.offeredCourierId !== courierId) return fail("lost");
      if (!order.declinedCourierIds.includes(courierId)) order.declinedCourierIds.push(courierId);
      order.offeredCourierId = null;
      order.offerExpiresAt = null;
      order.updatedAt = new Date(this.now()).toISOString();
      this.applyDispatch(order.id);
      return { ok: true as const, order: cloneOrder(this.orders.get(orderId)!) };
    });
  }

  async markPickedUp(courierId: string, orderId: string) {
    return this.transitionCourier(courierId, orderId, "picked_up");
  }

  async markDelivered(courierId: string, orderId: string) {
    return this.transitionCourier(courierId, orderId, "delivered");
  }

  async advanceDispatch() {
    return this.exclusive(() => {
      this.applyDispatch();
    });
  }

  private transitionCourier(
    courierId: string,
    orderId: string,
    to: "picked_up" | "delivered",
  ) {
    return this.exclusive(() => {
      const order = this.orders.get(orderId);
      if (!order || order.courierId !== courierId) return fail("not_found");
      try {
        order.status = assertTransition(order.status, to);
      } catch {
        return fail("invalid_state");
      }
      order.updatedAt = new Date(this.now()).toISOString();
      return { ok: true as const, order: cloneOrder(order) };
    });
  }

  private applyDispatch(onlyOrderId?: string) {
    const nowMs = this.now();
    const couriers = this.candidates();
    for (const order of this.orders.values()) {
      if (onlyOrderId && order.id !== onlyOrderId) continue;
      if (order.status !== "awaiting_dispatch" || order.dispatchMode !== "nearest") continue;
      const plan = planNearestDispatch({
        order,
        couriers,
        settings: this.settings,
        nowMs,
      });
      if (plan.kind === "keep" || plan.kind === "wait") continue;
      if (plan.kind === "expire") {
        if (!order.declinedCourierIds.includes(plan.expiredCourierId)) {
          order.declinedCourierIds.push(plan.expiredCourierId);
        }
        order.offeredCourierId = null;
        order.offerExpiresAt = null;
      }
      const ranked = plan.kind === "expire" && plan.nextCourierId
        ? [plan.nextCourierId]
        : plan.kind === "offer"
          ? [plan.courierId]
          : [];
      for (const courierId of ranked) {
        if (this.courierHasOtherOffer(courierId, order.id)) continue;
        order.offeredCourierId = courierId;
        order.offerExpiresAt = new Date(nowMs + this.settings.offerTimeoutMs).toISOString();
        break;
      }
      order.updatedAt = new Date(nowMs).toISOString();
      this.refreshPendingOffers(couriers);
    }
  }

  private refreshPendingOffers(couriers: CourierCandidate[]) {
    for (const courier of couriers) courier.pendingOfferOrderId = null;
    for (const order of this.orders.values()) {
      if (order.status !== "awaiting_dispatch" || !order.offeredCourierId || !order.offerExpiresAt) continue;
      if (Date.parse(order.offerExpiresAt) <= this.now()) continue;
      const courier = couriers.find((item) => item.id === order.offeredCourierId);
      if (courier) courier.pendingOfferOrderId = order.id;
    }
  }

  private courierHasOtherOffer(courierId: string, orderId: string) {
    for (const order of this.orders.values()) {
      if (order.id === orderId) continue;
      if (order.status !== "awaiting_dispatch") continue;
      if (order.offeredCourierId !== courierId) continue;
      if (order.offerExpiresAt && Date.parse(order.offerExpiresAt) > this.now()) return true;
    }
    return false;
  }

  private courierActiveOrderId(courierId: string) {
    for (const order of this.orders.values()) {
      if (order.courierId === courierId && (order.status === "assigned" || order.status === "picked_up")) {
        return order.id;
      }
    }
    return null;
  }

  private candidates() {
    const list: CourierCandidate[] = [];
    for (const courier of this.couriers.values()) {
      const candidate = this.candidate(courier);
      if (candidate) list.push(candidate);
    }
    this.refreshPendingOffers(list);
    return list;
  }

  private candidate(courier: StoredCourier): CourierCandidate | null {
    if (courier.lng == null || courier.lat == null || !courier.updatedAt) return null;
    return {
      id: courier.id,
      online: courier.online,
      lng: courier.lng,
      lat: courier.lat,
      updatedAtMs: Date.parse(courier.updatedAt),
      activeOrderId: this.courierActiveOrderId(courier.id),
      pendingOfferOrderId: null,
    };
  }

  private customerView(order: DeliveryOrder): CustomerOrderView {
    const courier = order.courierId ? this.couriers.get(order.courierId) : undefined;
    const showLocation =
      courier &&
      (order.status === "assigned" || order.status === "picked_up") &&
      courier.lng != null &&
      courier.lat != null &&
      courier.updatedAt;
    return {
      order: toPublicOrder(order),
      statusLabel: statusLabel(order.status),
      courier:
        courier && order.courierId
          ? {
              id: courier.id,
              displayName: courier.displayName,
              location: showLocation
                ? { lng: courier.lng!, lat: courier.lat!, updatedAt: courier.updatedAt! }
                : null,
            }
          : null,
    };
  }

  private courierView(order: DeliveryOrder, courier: CourierCandidate | null): CourierOrderView {
    const meters = courier
      ? distanceKm(order.pickup, { lng: courier.lng, lat: courier.lat }) * 1000
      : null;
    return {
      order: toPublicOrder(order),
      distanceMeters: meters,
      statusLabel: statusLabel(order.status),
      offerExpiresAt: order.offerExpiresAt,
    };
  }

  private presence(courier: StoredCourier): CourierPresence {
    return {
      id: courier.id,
      displayName: courier.displayName,
      online: courier.online,
      location:
        courier.lng != null && courier.lat != null && courier.updatedAt
          ? {
              lng: courier.lng,
              lat: courier.lat,
              heading: courier.heading,
              updatedAt: courier.updatedAt,
            }
          : null,
    };
  }
}

const memoryGlobal = globalThis as { __navpilotDeliveryMemory?: MemoryDeliveryProvider };

export function getMemoryDeliveryProvider() {
  if (!memoryGlobal.__navpilotDeliveryMemory) {
    memoryGlobal.__navpilotDeliveryMemory = new MemoryDeliveryProvider();
  }
  return memoryGlobal.__navpilotDeliveryMemory;
}
