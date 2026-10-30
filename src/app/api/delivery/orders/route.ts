import { readDeliveryActor } from "@/lib/delivery/actor";
import { deliveryResult, readJson, withDelivery } from "@/lib/delivery/http";
import { getDeliveryGateway } from "@/lib/delivery/runtime";
import type { CreateOrderInput, DispatchMode } from "@/lib/delivery/types";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return withDelivery(async () => {
    const actor = await readDeliveryActor(request, "customer");
    if (!actor.ok) return actor.response;
    const body = (await readJson(request)) as Partial<CreateOrderInput> | null;
    const lines = Array.isArray(body?.lines) ? body.lines : [];
    const result = await getDeliveryGateway().createOrder(actor.actor.id, {
      storeId: String(body?.storeId ?? ""),
      lines: lines.map((line) => ({
        menuItemId: String(line.menuItemId ?? ""),
        qty: Number(line.qty),
      })),
      dropoff: {
        lng: Number(body?.dropoff?.lng),
        lat: Number(body?.dropoff?.lat),
        label: body?.dropoff?.label,
      },
      customerLocation: body?.customerLocation
        ? { lng: Number(body.customerLocation.lng), lat: Number(body.customerLocation.lat) }
        : null,
      dispatchMode: body?.dispatchMode as DispatchMode | undefined,
    });
    return deliveryResult(result);
  });
}
