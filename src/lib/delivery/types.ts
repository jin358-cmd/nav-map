export const ORDER_STATUSES = [
  "created",
  "awaiting_dispatch",
  "assigned",
  "picked_up",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const DISPATCH_MODES = ["nearest", "grab"] as const;

export type DispatchMode = (typeof DISPATCH_MODES)[number];

export type GeoPoint = {
  lng: number;
  lat: number;
};

export type DeliveryStore = {
  id: string;
  name: string;
  address: string;
  lng: number;
  lat: number;
};

export type MenuItem = {
  id: string;
  storeId: string;
  name: string;
  priceCents: number;
};

export type OrderLine = {
  menuItemId: string;
  name: string;
  qty: number;
  priceCents: number;
};

export type DeliveryOrder = {
  id: string;
  customerId: string;
  storeId: string;
  storeName: string;
  status: OrderStatus;
  dispatchMode: DispatchMode;
  lines: OrderLine[];
  amountCents: 0;
  paymentStatus: "skipped";
  pickup: GeoPoint & { label: string };
  dropoff: GeoPoint & { label: string };
  customerLocation: (GeoPoint & { updatedAt: string }) | null;
  courierId: string | null;
  offeredCourierId: string | null;
  offerExpiresAt: string | null;
  declinedCourierIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type CourierPresence = {
  id: string;
  displayName: string;
  online: boolean;
  location: (GeoPoint & { heading: number | null; updatedAt: string }) | null;
};

export type CourierCandidate = {
  id: string;
  online: boolean;
  lng: number;
  lat: number;
  updatedAtMs: number;
  activeOrderId: string | null;
  pendingOfferOrderId: string | null;
};

export type CustomerOrderView = {
  order: PublicOrder;
  courier: null | {
    id: string;
    displayName: string;
    location: (GeoPoint & { updatedAt: string }) | null;
  };
  statusLabel: string;
};

export type CourierOrderView = {
  order: PublicOrder;
  distanceMeters: number | null;
  statusLabel: string;
  offerExpiresAt: string | null;
};

export type PublicOrder = Omit<
  DeliveryOrder,
  "declinedCourierIds" | "offeredCourierId"
>;

export type DeliveryMapPin = {
  id: string;
  role: "courier" | "dropoff" | "pickup" | "customer";
  lng: number;
  lat: number;
  label: string;
};

export type CreateOrderInput = {
  storeId: string;
  lines: Array<{ menuItemId: string; qty: number }>;
  dropoff: GeoPoint & { label?: string };
  customerLocation?: GeoPoint | null;
  dispatchMode?: DispatchMode;
};

export type GatewayErrorCode =
  | "not_found"
  | "forbidden"
  | "invalid"
  | "conflict"
  | "schema_missing"
  | "unavailable"
  | "disabled";

export type GatewayFailure = {
  ok: false;
  error: GatewayErrorCode;
  message: string;
};

export type ClaimReason =
  | "not_found"
  | "lost"
  | "busy"
  | "expired"
  | "offline"
  | "out_of_range"
  | "invalid_state";
