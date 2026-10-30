import { deliveryResult, withDelivery } from "@/lib/delivery/http";
import { getDeliveryGateway } from "@/lib/delivery/runtime";

export const dynamic = "force-dynamic";

export function GET() {
  return withDelivery(async () => {
    const stores = await getDeliveryGateway().listStores();
    return deliveryResult({ ok: true, stores });
  });
}
