import "server-only";

import { grabClaimQuery, nearestClaimQuery, nearestOfferQuery } from "@/lib/delivery/claims";
import { EMPTY_RATING, grabDistanceMeters, planNearestDispatch, toRatingSummary } from "@/lib/delivery/dispatch";
import { DeliverySchemaMissingError, DeliveryUnavailableError } from "@/lib/delivery/errors";
import { statusLabel } from "@/lib/delivery/labels";
import { toPublicOrder } from "@/lib/delivery/present";
import type { DeliveryProvider } from "@/lib/delivery/provider";
import { isNavPilotProjectUrl } from "@/lib/delivery/project";
import { readDispatchSettings, type DispatchSettings } from "@/lib/delivery/settings";
import { assertTransition } from "@/lib/delivery/state-machine";
import { getSupabaseConfig, supabaseHeaders, type SupabaseConfig } from "@/lib/supabase/server";
import { distanceKm } from "@/lib/geo";
import type {
  ClaimReason,
  CourierCandidate,
  CourierOrderView,
  CourierPresence,
  CourierRatingSummary,
  CreateOrderInput,
  CustomerOrderView,
  DeliveryOrder,
  DeliveryStore,
  DispatchMode,
  MenuItem,
  OrderLine,
  OrderRating,
  OrderStatus,
} from "@/lib/delivery/types";

type OrderRow = {
  id: string;
  customer_id: string;
  store_id: string;
  status: OrderStatus;
  dispatch_mode: DispatchMode;
  items: OrderLine[];
  amount_cents: number;
  payment_status: "skipped";
  pickup_label: string;
  pickup_lng: number;
  pickup_lat: number;
  dropoff_label: string;
  dropoff_lng: number;
  dropoff_lat: number;
  customer_lng: number | null;
  customer_lat: number | null;
  customer_location_at: string | null;
  courier_id: string | null;
  offered_courier_id: string | null;
  offer_expires_at: string | null;
  declined_courier_ids: string[] | null;
  created_at: string;
  updated_at: string;
};

type StoreRow = {
  id: string;
  name: string;
  address: string;
  lng: number;
  lat: number;
  active: boolean;
};

type MenuRow = {
  id: string;
  store_id: string;
  name: string;
  price_cents: number;
  active: boolean;
};

type CourierRow = {
  id: string;
  display_name: string;
  online: boolean;
  updated_at: string;
};

type LocationRow = {
  courier_id: string;
  lng: number;
  lat: number;
  heading: number | null;
  updated_at: string;
};

function mapOrder(row: OrderRow, storeName: string): DeliveryOrder {
  return {
    id: row.id,
    customerId: row.customer_id,
    storeId: row.store_id,
    storeName,
    status: row.status,
    dispatchMode: row.dispatch_mode,
    lines: Array.isArray(row.items) ? row.items : [],
    amountCents: 0,
    paymentStatus: "skipped",
    pickup: { lng: row.pickup_lng, lat: row.pickup_lat, label: row.pickup_label },
    dropoff: { lng: row.dropoff_lng, lat: row.dropoff_lat, label: row.dropoff_label },
    customerLocation:
      row.customer_lng != null && row.customer_lat != null && row.customer_location_at
        ? { lng: row.customer_lng, lat: row.customer_lat, updatedAt: row.customer_location_at }
        : null,
    courierId: row.courier_id,
    offeredCourierId: row.offered_courier_id,
    offerExpiresAt: row.offer_expires_at,
    declinedCourierIds: row.declined_courier_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseDeliveryProvider implements DeliveryProvider {
  readonly settings: DispatchSettings;

  constructor(settings?: Partial<DispatchSettings>) {
    this.settings = { ...readDispatchSettings(), ...settings };
  }

  async listStores() {
    const rows = await this.rest<StoreRow[]>(
      "/rest/v1/delivery_stores?select=id,name,address,lng,lat,active&active=eq.true&order=name.asc",
    );
    return rows.map(mapStore);
  }

  async getStore(storeId: string) {
    const rows = await this.rest<StoreRow[]>(
      `/rest/v1/delivery_stores?select=id,name,address,lng,lat,active&id=eq.${encodeURIComponent(storeId)}&limit=1`,
    );
    const row = rows[0];
    return row?.active ? mapStore(row) : null;
  }

  async getMenu(storeId: string) {
    const rows = await this.rest<MenuRow[]>(
      `/rest/v1/delivery_menu_items?select=id,store_id,name,price_cents,active&store_id=eq.${encodeURIComponent(storeId)}&active=eq.true&order=name.asc`,
    );
    return rows.map(mapMenu);
  }

  async createOrder(customerId: string, input: CreateOrderInput) {
    const store = await this.getStore(input.storeId);
    if (!store) throw new DeliveryUnavailableError("找不到這間店。");
    const menu = await this.getMenu(store.id);
    const lines: OrderLine[] = input.lines.map((line) => {
      const item = menu.find((entry) => entry.id === line.menuItemId);
      if (!item) throw new DeliveryUnavailableError("菜單裡沒有這個餐點。");
      return { menuItemId: item.id, name: item.name, qty: line.qty, priceCents: 0 };
    });
    assertTransition("created", "awaiting_dispatch");
    const now = new Date().toISOString();
    const inserted = await this.rest<OrderRow[]>("/rest/v1/delivery_orders", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        customer_id: customerId,
        store_id: store.id,
        status: "awaiting_dispatch",
        dispatch_mode: input.dispatchMode ?? this.settings.mode,
        items: lines,
        amount_cents: 0,
        payment_status: "skipped",
        pickup_label: store.name,
        pickup_lng: store.lng,
        pickup_lat: store.lat,
        dropoff_label: input.dropoff.label?.trim() || "送達位置",
        dropoff_lng: input.dropoff.lng,
        dropoff_lat: input.dropoff.lat,
        customer_lng: input.customerLocation?.lng ?? input.dropoff.lng,
        customer_lat: input.customerLocation?.lat ?? input.dropoff.lat,
        customer_location_at: now,
        declined_courier_ids: [],
        created_at: now,
        updated_at: now,
      }),
    });
    const row = inserted[0];
    if (!row) throw new DeliveryUnavailableError();
    await this.addEvent(row.id, "created", "customer", customerId, {});
    await this.addEvent(row.id, "awaiting_dispatch", "system", null, {
      dispatchMode: row.dispatch_mode,
    });
    await this.advanceDispatch();
    const fresh = await this.selectOrder(row.id);
    return fresh ?? mapOrder(row, store.name);
  }

  async getOrderForCustomer(customerId: string, orderId: string) {
    await this.advanceDispatch();
    const rows = await this.rest<OrderRow[]>(
      `/rest/v1/delivery_orders?select=*&id=eq.${encodeURIComponent(orderId)}&customer_id=eq.${encodeURIComponent(customerId)}&limit=1`,
    );
    const row = rows[0];
    if (!row) return null;
    const order = await this.hydrate(row);
    return this.customerView(order);
  }

  async cancelOrder(customerId: string, orderId: string) {
    const now = new Date().toISOString();
    const rows = await this.rest<OrderRow[]>(
      `/rest/v1/delivery_orders?id=eq.${encodeURIComponent(orderId)}&customer_id=eq.${encodeURIComponent(customerId)}&status=in.(created,awaiting_dispatch,assigned)`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          status: "cancelled",
          offered_courier_id: null,
          offer_expires_at: null,
          updated_at: now,
        }),
      },
    );
    if (!rows[0]) {
      const existing = await this.rest<OrderRow[]>(
        `/rest/v1/delivery_orders?select=id,customer_id,status&id=eq.${encodeURIComponent(orderId)}&customer_id=eq.${encodeURIComponent(customerId)}&limit=1`,
      );
      if (!existing[0]) return "not_found" as const;
      return "invalid_state" as const;
    }
    await this.addEvent(orderId, "cancelled", "customer", customerId, {});
    return this.hydrate(rows[0]);
  }

  async updateCustomerLocation(customerId: string, orderId: string, point: { lng: number; lat: number }) {
    const now = new Date().toISOString();
    const rows = await this.rest<OrderRow[]>(
      `/rest/v1/delivery_orders?id=eq.${encodeURIComponent(orderId)}&customer_id=eq.${encodeURIComponent(customerId)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          customer_lng: point.lng,
          customer_lat: point.lat,
          customer_location_at: now,
          updated_at: now,
        }),
      },
    );
    return Boolean(rows[0]);
  }

  async setCourierPresence(input: {
    courierId: string;
    displayName: string;
    online: boolean;
    lng?: number;
    lat?: number;
    heading?: number | null;
  }) {
    const now = new Date().toISOString();
    await this.rest<CourierRow[]>("/rest/v1/delivery_couriers?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id: input.courierId,
        display_name: input.displayName,
        online: input.online,
        updated_at: now,
      }),
    });
    if (input.lng != null && input.lat != null) {
      await this.rest<LocationRow[]>("/rest/v1/delivery_courier_locations?on_conflict=courier_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          courier_id: input.courierId,
          lng: input.lng,
          lat: input.lat,
          heading: input.heading ?? null,
          updated_at: now,
        }),
      });
    }
    if (input.online) await this.advanceDispatch();
    return {
      id: input.courierId,
      displayName: input.displayName,
      online: input.online,
      location:
        input.lng != null && input.lat != null
          ? { lng: input.lng, lat: input.lat, heading: input.heading ?? null, updatedAt: now }
          : null,
    } satisfies CourierPresence;
  }

  async listCourierWork(courierId: string) {
    await this.advanceDispatch();
    const courier = await this.candidateById(courierId);
    const activeRows = await this.rest<OrderRow[]>(
      `/rest/v1/delivery_orders?select=*&courier_id=eq.${encodeURIComponent(courierId)}&status=in.(assigned,picked_up)&limit=1`,
    );
    const offerRows = await this.rest<OrderRow[]>(
      `/rest/v1/delivery_orders?select=*&status=eq.awaiting_dispatch&offered_courier_id=eq.${encodeURIComponent(courierId)}&offer_expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=5`,
    );
    const grabRows = courier
      ? await this.rest<OrderRow[]>(
          "/rest/v1/delivery_orders?select=*&status=eq.awaiting_dispatch&dispatch_mode=eq.grab&courier_id=is.null&limit=30",
        )
      : [];
    const active = activeRows[0] ? this.courierView(await this.hydrate(activeRows[0]), courier) : null;
    const offers: CourierOrderView[] = [];
    for (const row of offerRows) {
      offers.push(this.courierView(await this.hydrate(row), courier));
    }
    for (const row of grabRows) {
      if ((row.declined_courier_ids ?? []).includes(courierId)) continue;
      const order = await this.hydrate(row);
      if (!courier || grabDistanceMeters(order, courier, this.settings, Date.now()) == null) continue;
      offers.push(this.courierView(order, courier));
    }
    return { offers, active };
  }

  async acceptOrder(courierId: string, orderId: string) {
    const order = await this.selectOrder(orderId);
    const courier = await this.candidateById(courierId);
    if (!order || !courier) return { ok: false as const, reason: "not_found" as const };
    if (courier.activeOrderId) return { ok: false as const, reason: "busy" as const };
    if (!courier.online) return { ok: false as const, reason: "offline" as const };
    if (order.dispatchMode === "grab" && grabDistanceMeters(order, courier, this.settings, Date.now()) == null) {
      return { ok: false as const, reason: "out_of_range" as const };
    }
    const now = new Date().toISOString();
    const filter =
      order.dispatchMode === "grab"
        ? grabClaimQuery(orderId)
        : nearestClaimQuery(orderId, courierId, now);
    const rows = await this.mutate<OrderRow[]>(`/rest/v1/delivery_orders?${filter}`, {
      status: "assigned",
      courier_id: courierId,
      offered_courier_id: null,
      offer_expires_at: null,
      updated_at: now,
    });
    if (rows.conflict) return { ok: false as const, reason: "busy" as const };
    if (!rows.data[0]) {
      return {
        ok: false as const,
        reason: (order.dispatchMode === "nearest" ? "expired" : "lost") as ClaimReason,
      };
    }
    await this.addEvent(orderId, "assigned", "courier", courierId, { dispatchMode: order.dispatchMode });
    return { ok: true as const, order: await this.hydrate(rows.data[0]) };
  }

  async declineOrder(courierId: string, orderId: string) {
    const order = await this.selectOrder(orderId);
    if (!order) return { ok: false as const, reason: "not_found" as const };
    if (order.dispatchMode !== "nearest" || order.offeredCourierId !== courierId) {
      return { ok: false as const, reason: "lost" as const };
    }
    const now = new Date().toISOString();
    const declined = order.declinedCourierIds.includes(courierId)
      ? order.declinedCourierIds
      : [...order.declinedCourierIds, courierId];
    const rows = await this.mutate<OrderRow[]>(
      `/rest/v1/delivery_orders?id=eq.${encodeURIComponent(orderId)}&status=eq.awaiting_dispatch&offered_courier_id=eq.${encodeURIComponent(courierId)}`,
      {
        offered_courier_id: null,
        offer_expires_at: null,
        declined_courier_ids: declined,
        updated_at: now,
      },
    );
    if (!rows.data[0]) return { ok: false as const, reason: "lost" as const };
    await this.addEvent(orderId, "declined", "courier", courierId, {});
    await this.advanceDispatch();
    const fresh = await this.selectOrder(orderId);
    return { ok: true as const, order: fresh ?? (await this.hydrate(rows.data[0])) };
  }

  async markPickedUp(courierId: string, orderId: string) {
    return this.courierTransition(courierId, orderId, "assigned", "picked_up");
  }

  async markDelivered(courierId: string, orderId: string) {
    return this.courierTransition(courierId, orderId, "picked_up", "delivered");
  }

  async advanceDispatch() {
    const rows = await this.rest<OrderRow[]>(
      "/rest/v1/delivery_orders?select=*&status=eq.awaiting_dispatch&dispatch_mode=eq.nearest&limit=40",
    );
    if (rows.length === 0) return;
    const couriers = await this.loadCandidates();
    const nowMs = Date.now();
    for (const row of rows) {
      const order = await this.hydrate(row);
      const plan = planNearestDispatch({ order, couriers, settings: this.settings, nowMs });
      if (plan.kind === "keep" || plan.kind === "wait") continue;
      if (plan.kind === "grab_fallback") {
        await this.switchToGrab(order.id);
        continue;
      }
      if (plan.kind === "expire") {
        const cleared = await this.mutate<OrderRow[]>(
          `/rest/v1/delivery_orders?id=eq.${encodeURIComponent(order.id)}&status=eq.awaiting_dispatch&offered_courier_id=eq.${encodeURIComponent(plan.expiredCourierId)}`,
          {
            offered_courier_id: null,
            offer_expires_at: null,
            declined_courier_ids: order.declinedCourierIds.includes(plan.expiredCourierId)
              ? order.declinedCourierIds
              : [...order.declinedCourierIds, plan.expiredCourierId],
            updated_at: new Date(nowMs).toISOString(),
          },
        );
        if (!cleared.data[0]) continue;
        if (plan.grabFallback) {
          await this.switchToGrab(order.id);
          continue;
        }
        if (!plan.nextCourierId || !plan.expiresAt) continue;
        await this.offerTo(order.id, plan.nextCourierId, plan.expiresAt);
        continue;
      }
      await this.offerTo(order.id, plan.courierId, plan.expiresAt);
    }
  }

  private async switchToGrab(orderId: string) {
    const rows = await this.mutate<OrderRow[]>(
      `/rest/v1/delivery_orders?id=eq.${encodeURIComponent(orderId)}&status=eq.awaiting_dispatch&dispatch_mode=eq.nearest`,
      {
        dispatch_mode: "grab",
        offered_courier_id: null,
        offer_expires_at: null,
        updated_at: new Date().toISOString(),
      },
    );
    if (rows.data[0]) await this.addEvent(orderId, "grab_fallback", "system", null, {});
  }

  async rateOrder(customerId: string, orderId: string, input: { stars: number; comment: string | null }) {
    const rows = await this.rest<OrderRow[]>(
      `/rest/v1/delivery_orders?select=*&id=eq.${encodeURIComponent(orderId)}&customer_id=eq.${encodeURIComponent(customerId)}&limit=1`,
    );
    const row = rows[0];
    if (!row) return { ok: false as const, reason: "not_found" as const };
    if (row.status !== "delivered" || !row.courier_id) {
      return { ok: false as const, reason: "invalid_state" as const };
    }
    const existing = await this.rest<Array<{ id: string }>>(
      `/rest/v1/delivery_courier_ratings?select=id&order_id=eq.${encodeURIComponent(orderId)}&limit=1`,
    );
    if (existing[0]) return { ok: false as const, reason: "duplicate" as const };
    const inserted = await this.insertRating({
      order_id: orderId,
      courier_id: row.courier_id,
      customer_id: customerId,
      stars: input.stars,
      comment: input.comment,
    });
    if (inserted === "duplicate") return { ok: false as const, reason: "duplicate" as const };
    return {
      ok: true as const,
      rating: { stars: input.stars, comment: input.comment },
      summary: await this.statsForCourier(row.courier_id),
    };
  }

  private async offerTo(orderId: string, courierId: string, expiresAt: string) {
    const rows = await this.mutate<OrderRow[]>(`/rest/v1/delivery_orders?${nearestOfferQuery(orderId)}`, {
      offered_courier_id: courierId,
      offer_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });
    if (rows.data[0]) {
      await this.addEvent(orderId, "offered", "system", courierId, { expiresAt });
    }
  }

  private async courierTransition(
    courierId: string,
    orderId: string,
    from: "assigned" | "picked_up",
    to: "picked_up" | "delivered",
  ) {
    assertTransition(from, to);
    const now = new Date().toISOString();
    const rows = await this.mutate<OrderRow[]>(
      `/rest/v1/delivery_orders?id=eq.${encodeURIComponent(orderId)}&courier_id=eq.${encodeURIComponent(courierId)}&status=eq.${from}`,
      { status: to, updated_at: now },
    );
    if (!rows.data[0]) return { ok: false as const, reason: "invalid_state" as const };
    await this.addEvent(orderId, to, "courier", courierId, {});
    return { ok: true as const, order: await this.hydrate(rows.data[0]) };
  }

  private async customerView(order: DeliveryOrder): Promise<CustomerOrderView> {
    const myRating = await this.ratingForOrder(order.id);
    if (!order.courierId || (order.status !== "assigned" && order.status !== "picked_up" && order.status !== "delivered")) {
      return { order: toPublicOrder(order), courier: null, myRating, statusLabel: statusLabel(order.status) };
    }
    const couriers = await this.rest<CourierRow[]>(
      `/rest/v1/delivery_couriers?select=id,display_name,online,updated_at&id=eq.${encodeURIComponent(order.courierId)}&limit=1`,
    );
    const locations =
      order.status === "delivered"
        ? []
        : await this.rest<LocationRow[]>(
            `/rest/v1/delivery_courier_locations?select=courier_id,lng,lat,heading,updated_at&courier_id=eq.${encodeURIComponent(order.courierId)}&limit=1`,
          );
    const location = locations[0];
    return {
      order: toPublicOrder(order),
      statusLabel: statusLabel(order.status),
      myRating,
      courier: {
        id: order.courierId,
        displayName: couriers[0]?.display_name || "外送員",
        location: location
          ? { lng: location.lng, lat: location.lat, updatedAt: location.updated_at }
          : null,
        rating: await this.statsForCourier(order.courierId),
      },
    };
  }

  private courierView(order: DeliveryOrder, courier: CourierCandidate | null): CourierOrderView {
    return {
      order: toPublicOrder(order),
      statusLabel: statusLabel(order.status),
      offerExpiresAt: order.offerExpiresAt,
      distanceMeters: courier
        ? distanceKm(order.pickup, { lng: courier.lng, lat: courier.lat }) * 1000
        : null,
      courierRating: courier ? toRatingSummary(courier) : EMPTY_RATING,
    };
  }

  private async hydrate(row: OrderRow) {
    const store = await this.getStore(row.store_id);
    return mapOrder(row, store?.name || row.pickup_label);
  }

  private async selectOrder(orderId: string) {
    const rows = await this.rest<OrderRow[]>(
      `/rest/v1/delivery_orders?select=*&id=eq.${encodeURIComponent(orderId)}&limit=1`,
    );
    return rows[0] ? this.hydrate(rows[0]) : null;
  }

  private async loadCandidates(): Promise<CourierCandidate[]> {
    const [couriers, locations, active, offers] = await Promise.all([
      this.rest<CourierRow[]>("/rest/v1/delivery_couriers?select=id,display_name,online,updated_at&online=eq.true&limit=100"),
      this.rest<LocationRow[]>("/rest/v1/delivery_courier_locations?select=courier_id,lng,lat,heading,updated_at&limit=100"),
      this.rest<Array<{ id: string; courier_id: string }>>(
        "/rest/v1/delivery_orders?select=id,courier_id&status=in.(assigned,picked_up)&courier_id=not.is.null&limit=100",
      ),
      this.rest<Array<{ id: string; offered_courier_id: string }>>(
        `/rest/v1/delivery_orders?select=id,offered_courier_id&status=eq.awaiting_dispatch&offered_courier_id=not.is.null&offer_expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=100`,
      ),
    ]);
    const locationById = new Map(locations.map((row) => [row.courier_id, row]));
    const activeByCourier = new Map(active.map((row) => [row.courier_id, row.id]));
    const offerByCourier = new Map(offers.map((row) => [row.offered_courier_id, row.id]));
    const stats = await this.loadStats();
    const candidates: CourierCandidate[] = [];
    for (const courier of couriers) {
      const location = locationById.get(courier.id);
      if (!location) continue;
      candidates.push(this.candidateFrom(courier.id, courier.online, location, activeByCourier.get(courier.id) ?? null, offerByCourier.get(courier.id) ?? null, stats));
    }
    return candidates;
  }

  private async candidateById(courierId: string) {
    const couriers = await this.loadCandidates();
    const online = couriers.find((courier) => courier.id === courierId);
    if (online) return online;
    const rows = await this.rest<CourierRow[]>(
      `/rest/v1/delivery_couriers?select=id,display_name,online,updated_at&id=eq.${encodeURIComponent(courierId)}&limit=1`,
    );
    if (!rows[0]) return null;
    const locations = await this.rest<LocationRow[]>(
      `/rest/v1/delivery_courier_locations?select=*&courier_id=eq.${encodeURIComponent(courierId)}&limit=1`,
    );
    const location = locations[0];
    if (!location) return null;
    const active = await this.rest<Array<{ id: string }>>(
      `/rest/v1/delivery_orders?select=id&courier_id=eq.${encodeURIComponent(courierId)}&status=in.(assigned,picked_up)&limit=1`,
    );
    const stats = await this.loadStats();
    return this.candidateFrom(courierId, rows[0].online, location, active[0]?.id ?? null, null, stats);
  }

  private candidateFrom(
    id: string,
    online: boolean,
    location: LocationRow,
    activeOrderId: string | null,
    pendingOfferOrderId: string | null,
    stats: Map<string, { completed: number; sum: number; count: number }>,
  ): CourierCandidate {
    const row = stats.get(id);
    return {
      id,
      online,
      lng: location.lng,
      lat: location.lat,
      updatedAtMs: Date.parse(location.updated_at),
      activeOrderId,
      pendingOfferOrderId,
      completedDeliveries: row?.completed ?? 0,
      ratingAverage: row && row.count > 0 ? row.sum / row.count : null,
      ratingCount: row?.count ?? 0,
    };
  }

  private async statsForCourier(courierId: string): Promise<CourierRatingSummary> {
    const row = (await this.loadStats()).get(courierId);
    if (!row || row.count === 0) {
      return { average: null, count: 0, completedDeliveries: row?.completed ?? 0 };
    }
    return { average: row.sum / row.count, count: row.count, completedDeliveries: row.completed };
  }

  private async loadStats() {
    const delivered = await this.rest<Array<{ courier_id: string | null }>>(
      "/rest/v1/delivery_orders?select=courier_id&status=eq.delivered&courier_id=not.is.null&limit=1000",
    );
    const stats = new Map<string, { completed: number; sum: number; count: number }>();
    for (const row of delivered) {
      if (!row.courier_id) continue;
      const current = stats.get(row.courier_id) ?? { completed: 0, sum: 0, count: 0 };
      current.completed += 1;
      stats.set(row.courier_id, current);
    }
    try {
      const ratings = await this.rest<Array<{ courier_id: string; stars: number }>>(
        "/rest/v1/delivery_courier_ratings?select=courier_id,stars&limit=1000",
      );
      for (const row of ratings) {
        const current = stats.get(row.courier_id) ?? { completed: 0, sum: 0, count: 0 };
        current.sum += row.stars;
        current.count += 1;
        stats.set(row.courier_id, current);
      }
    } catch (error) {
      if (!(error instanceof DeliverySchemaMissingError)) throw error;
    }
    return stats;
  }

  private async ratingForOrder(orderId: string): Promise<OrderRating | null> {
    try {
      const rows = await this.rest<Array<{ stars: number; comment: string | null }>>(
        `/rest/v1/delivery_courier_ratings?select=stars,comment&order_id=eq.${encodeURIComponent(orderId)}&limit=1`,
      );
      const row = rows[0];
      return row ? { stars: row.stars, comment: row.comment } : null;
    } catch (error) {
      if (error instanceof DeliverySchemaMissingError) return null;
      throw error;
    }
  }

  private async insertRating(body: {
    order_id: string;
    courier_id: string;
    customer_id: string;
    stars: number;
    comment: string | null;
  }) {
    const config = this.config();
    const response = await fetch(`${config.url}/rest/v1/delivery_courier_ratings`, {
      method: "POST",
      headers: supabaseHeaders(config, { Prefer: "return=minimal" }),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (response.status === 409) return "duplicate" as const;
    const text = await response.text();
    const parsed = text ? safeJson(text) : null;
    if (codeOf(parsed) === "23505") return "duplicate" as const;
    if (!response.ok) this.raise(response.status, parsed);
    return "ok" as const;
  }

  private async addEvent(
    orderId: string,
    eventType: string,
    actorRole: string | null,
    actorId: string | null,
    detail: Record<string, unknown>,
  ) {
    try {
      await this.rest("/rest/v1/delivery_order_events", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          order_id: orderId,
          event_type: eventType,
          actor_role: actorRole,
          actor_id: actorId,
          detail,
        }),
      });
    } catch (error) {
      if (error instanceof DeliverySchemaMissingError) throw error;
      console.error("[delivery] event", eventType);
    }
  }

  private async mutate<T>(path: string, body: Record<string, unknown>): Promise<{ data: T; conflict: boolean }> {
    const config = this.config();
    const response = await fetch(`${config.url}${path}`, {
      method: "PATCH",
      headers: supabaseHeaders(config, { Prefer: "return=representation" }),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await response.text();
    const parsed = text ? safeJson(text) : null;
    if (response.status === 409 || codeOf(parsed) === "23505") {
      return { data: [] as T, conflict: true };
    }
    if (!response.ok) {
      this.raise(response.status, parsed);
    }
    return { data: (Array.isArray(parsed) ? parsed : []) as T, conflict: false };
  }

  private async rest<T>(path: string, init?: RequestInit): Promise<T> {
    const config = this.config();
    const response = await fetch(`${config.url}${path}`, {
      ...init,
      headers: supabaseHeaders(config, init?.headers),
      cache: "no-store",
    });
    if (response.status === 204) return [] as T;
    const text = await response.text();
    const parsed = text ? safeJson(text) : null;
    if (!response.ok) this.raise(response.status, parsed);
    return (parsed ?? []) as T;
  }

  private config(): SupabaseConfig {
    const config = getSupabaseConfig();
    if (!config) {
      throw new DeliveryUnavailableError("伺服器尚未設定 NavPilot Supabase，外送暫時無法連線。");
    }
    if (!isNavPilotProjectUrl(config.url)) {
      throw new DeliveryUnavailableError("外送只允許連線 NavPilot 的 Supabase 專案。");
    }
    return config;
  }

  private raise(status: number, parsed: unknown): never {
    const code = codeOf(parsed);
    const message = messageOf(parsed);
    console.error("[delivery] supabase", status, code);
    if (status === 404 || code === "PGRST205" || code === "42P01" || /does not exist|schema cache/i.test(message)) {
      throw new DeliverySchemaMissingError();
    }
    throw new DeliveryUnavailableError();
  }
}

function mapStore(row: StoreRow): DeliveryStore {
  return { id: row.id, name: row.name, address: row.address, lng: row.lng, lat: row.lat };
}

function mapMenu(row: MenuRow): MenuItem {
  return { id: row.id, storeId: row.store_id, name: row.name, priceCents: 0 };
}

function safeJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function codeOf(value: unknown) {
  if (!value || typeof value !== "object" || !("code" in value)) return null;
  const code = (value as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function messageOf(value: unknown) {
  if (!value || typeof value !== "object" || !("message" in value)) return "";
  const message = (value as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}
