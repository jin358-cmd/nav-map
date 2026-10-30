import { deliveryResult, withDelivery } from "@/lib/delivery/http";
import { getDeliveryGateway } from "@/lib/delivery/runtime";

export const dynamic = "force-dynamic";

export function GET(_request: Request, context: { params: Promise<{ storeId: string }> }) {
  return withDelivery(async () => {
    const { storeId } = await context.params;
    const gateway = getDeliveryGateway();
    const store = await gateway.listStores().then((stores) => stores.find((item) => item.id === storeId) ?? null);
    if (!store) {
      return deliveryResult({ ok: false, error: "not_found", message: "找不到這間店。" });
    }
    const menu = await gateway.getMenu(storeId);
    return deliveryResult({ ok: true, store, menu });
  });
}
