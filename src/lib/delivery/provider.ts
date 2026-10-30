import type { DispatchSettings } from "@/lib/delivery/settings";
import type {
  ClaimReason,
  CourierOrderView,
  CourierPresence,
  CreateOrderInput,
  CustomerOrderView,
  DeliveryOrder,
  DeliveryStore,
  MenuItem,
} from "@/lib/delivery/types";

/**
 * Boundary between NavPilot's gateway and a delivery backend.
 * SupabaseDeliveryProvider is the shipping adapter.
 * MemoryDeliveryProvider is the test / single-process stand-in.
 * A future platform implements this same interface.
 */
export interface DeliveryProvider {
  readonly settings: DispatchSettings;
  listStores(): Promise<DeliveryStore[]>;
  getStore(storeId: string): Promise<DeliveryStore | null>;
  getMenu(storeId: string): Promise<MenuItem[]>;
  createOrder(customerId: string, input: CreateOrderInput): Promise<DeliveryOrder>;
  getOrderForCustomer(customerId: string, orderId: string): Promise<CustomerOrderView | null>;
  cancelOrder(customerId: string, orderId: string): Promise<DeliveryOrder | "not_found" | "invalid_state">;
  updateCustomerLocation(
    customerId: string,
    orderId: string,
    point: { lng: number; lat: number },
  ): Promise<boolean>;
  setCourierPresence(input: {
    courierId: string;
    displayName: string;
    online: boolean;
    lng?: number;
    lat?: number;
    heading?: number | null;
  }): Promise<CourierPresence>;
  listCourierWork(courierId: string): Promise<{
    offers: CourierOrderView[];
    active: CourierOrderView | null;
  }>;
  acceptOrder(
    courierId: string,
    orderId: string,
  ): Promise<{ ok: true; order: DeliveryOrder } | { ok: false; reason: ClaimReason }>;
  declineOrder(
    courierId: string,
    orderId: string,
  ): Promise<{ ok: true; order: DeliveryOrder } | { ok: false; reason: ClaimReason }>;
  markPickedUp(
    courierId: string,
    orderId: string,
  ): Promise<{ ok: true; order: DeliveryOrder } | { ok: false; reason: ClaimReason }>;
  markDelivered(
    courierId: string,
    orderId: string,
  ): Promise<{ ok: true; order: DeliveryOrder } | { ok: false; reason: ClaimReason }>;
  advanceDispatch(): Promise<void>;
}
