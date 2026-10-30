import type { DeliveryOrder, PublicOrder } from "@/lib/delivery/types";

export function toPublicOrder(order: DeliveryOrder): PublicOrder {
  return {
    id: order.id,
    customerId: order.customerId,
    storeId: order.storeId,
    storeName: order.storeName,
    status: order.status,
    dispatchMode: order.dispatchMode,
    lines: order.lines.map((line) => ({ ...line })),
    amountCents: order.amountCents,
    paymentStatus: order.paymentStatus,
    pickup: { ...order.pickup },
    dropoff: { ...order.dropoff },
    customerLocation: order.customerLocation ? { ...order.customerLocation } : null,
    courierId: order.courierId,
    offerExpiresAt: order.offerExpiresAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
