import "server-only";

import { DeliveryGateway } from "@/lib/delivery/gateway";
import { getMemoryDeliveryProvider } from "@/lib/delivery/memory-provider";
import { SupabaseDeliveryProvider } from "@/lib/delivery/supabase-provider";

export function getDeliveryGateway() {
  if (process.env.DELIVERY_PROVIDER === "memory") {
    return new DeliveryGateway(getMemoryDeliveryProvider());
  }
  return new DeliveryGateway(new SupabaseDeliveryProvider());
}

export function deliveryProviderName() {
  return process.env.DELIVERY_PROVIDER === "memory" ? "memory" : "supabase";
}
