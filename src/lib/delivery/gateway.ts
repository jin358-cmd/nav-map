import type { DeliveryProvider } from "@/lib/delivery/provider";
import type {
  ClaimReason,
  CreateOrderInput,
  DispatchMode,
  GatewayFailure,
} from "@/lib/delivery/types";
import { DISPATCH_MODES } from "@/lib/delivery/types";
import { statusLabel } from "@/lib/delivery/labels";
import { toPublicOrder } from "@/lib/delivery/present";

const CLAIM_MESSAGE: Record<ClaimReason, string> = {
  not_found: "找不到這筆訂單。",
  lost: "這筆訂單已經被其他外送員接下。",
  busy: "你已有進行中的訂單。",
  expired: "接單時間已過。",
  offline: "請先上線並分享位置。",
  out_of_range: "你不在這筆訂單的搶單範圍內。",
  invalid_state: "這個狀態不能再變更。",
};

function failure(error: GatewayFailure["error"], message: string): GatewayFailure {
  return { ok: false, error, message };
}

function claimFailure(reason: ClaimReason): GatewayFailure {
  if (reason === "not_found") return failure("not_found", CLAIM_MESSAGE[reason]);
  if (reason === "invalid_state") return failure("invalid", CLAIM_MESSAGE[reason]);
  return failure("conflict", CLAIM_MESSAGE[reason]);
}

export function inServiceArea(lng: number, lat: number) {
  return Number.isFinite(lng) && Number.isFinite(lat) && lng >= 118 && lng <= 123 && lat >= 20 && lat <= 27;
}

function parseMode(value: unknown, fallback: DispatchMode): DispatchMode | null {
  if (value == null) return fallback;
  return DISPATCH_MODES.includes(value as DispatchMode) ? (value as DispatchMode) : null;
}

export class DeliveryGateway {
  constructor(private readonly provider: DeliveryProvider) {}

  listStores() {
    return this.provider.listStores();
  }

  getMenu(storeId: string) {
    return this.provider.getMenu(storeId);
  }

  async createOrder(customerId: string, input: CreateOrderInput) {
    if (!customerId) return failure("invalid", "缺少顧客身份。");
    const store = await this.provider.getStore(input.storeId);
    if (!store) return failure("invalid", "找不到這間店。");
    const menu = await this.provider.getMenu(store.id);
    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      return failure("invalid", "請先選擇餐點。");
    }
    const lines = [];
    for (const line of input.lines) {
      const qty = line.qty;
      if (!Number.isInteger(qty) || qty < 1 || qty > 9) {
        return failure("invalid", "餐點數量要介於 1 到 9。");
      }
      const item = menu.find((entry) => entry.id === line.menuItemId);
      if (!item) return failure("invalid", "菜單裡沒有這個餐點。");
      lines.push({ menuItemId: item.id, qty });
    }
    if (!inServiceArea(input.dropoff.lng, input.dropoff.lat)) {
      return failure("invalid", "送達位置超出服務範圍。");
    }
    if (input.customerLocation && !inServiceArea(input.customerLocation.lng, input.customerLocation.lat)) {
      return failure("invalid", "目前位置超出服務範圍。");
    }
    const mode = parseMode(input.dispatchMode, this.provider.settings.mode);
    if (!mode) return failure("invalid", "派單模式不正確。");
    const order = await this.provider.createOrder(customerId, {
      ...input,
      lines,
      dispatchMode: mode,
    });
    if (order.amountCents !== 0 || order.paymentStatus !== "skipped") {
      return failure("unavailable", "訂單金額異常。");
    }
    return {
      ok: true as const,
      order: toPublicOrder(order),
      statusLabel: statusLabel(order.status),
    };
  }

  async getOrder(customerId: string, orderId: string) {
    const view = await this.provider.getOrderForCustomer(customerId, orderId);
    if (!view) return failure("not_found", "找不到這筆訂單。");
    return { ok: true as const, ...view };
  }

  async cancelOrder(customerId: string, orderId: string) {
    const result = await this.provider.cancelOrder(customerId, orderId);
    if (result === "not_found") return failure("not_found", "找不到這筆訂單。");
    if (result === "invalid_state") return failure("invalid", "取餐之後不能取消。");
    return { ok: true as const, order: toPublicOrder(result), statusLabel: statusLabel(result.status) };
  }

  async updateCustomerLocation(
    customerId: string,
    orderId: string,
    point: { lng: number; lat: number },
  ) {
    if (!inServiceArea(point.lng, point.lat)) return failure("invalid", "目前位置超出服務範圍。");
    const updated = await this.provider.updateCustomerLocation(customerId, orderId, point);
    if (!updated) return failure("not_found", "找不到這筆訂單。");
    return { ok: true as const };
  }

  async setCourierPresence(input: {
    courierId: string;
    displayName?: string;
    online: boolean;
    lng?: number;
    lat?: number;
    heading?: number | null;
  }) {
    if (!input.courierId) return failure("invalid", "缺少外送員身份。");
    if (
      input.lng != null &&
      input.lat != null &&
      !inServiceArea(input.lng, input.lat)
    ) {
      return failure("invalid", "位置超出服務範圍。");
    }
    if (input.online && (input.lng == null || input.lat == null)) {
      return failure("invalid", "上線時需要位置。");
    }
    const presence = await this.provider.setCourierPresence({
      courierId: input.courierId,
      displayName: input.displayName?.trim() || "外送員",
      online: input.online,
      lng: input.lng,
      lat: input.lat,
      heading: input.heading,
    });
    return { ok: true as const, courier: presence };
  }

  listCourierWork(courierId: string) {
    return this.provider.listCourierWork(courierId).then((work) => ({ ok: true as const, ...work }));
  }

  async accept(courierId: string, orderId: string) {
    const result = await this.provider.acceptOrder(courierId, orderId);
    if (!result.ok) return claimFailure(result.reason);
    return { ok: true as const, order: toPublicOrder(result.order), statusLabel: statusLabel(result.order.status) };
  }

  async decline(courierId: string, orderId: string) {
    const result = await this.provider.declineOrder(courierId, orderId);
    if (!result.ok) return claimFailure(result.reason);
    return { ok: true as const, order: toPublicOrder(result.order), statusLabel: statusLabel(result.order.status) };
  }

  async pickup(courierId: string, orderId: string) {
    const result = await this.provider.markPickedUp(courierId, orderId);
    if (!result.ok) return claimFailure(result.reason);
    return { ok: true as const, order: toPublicOrder(result.order), statusLabel: statusLabel(result.order.status) };
  }

  async deliver(courierId: string, orderId: string) {
    const result = await this.provider.markDelivered(courierId, orderId);
    if (!result.ok) return claimFailure(result.reason);
    return { ok: true as const, order: toPublicOrder(result.order), statusLabel: statusLabel(result.order.status) };
  }
}
