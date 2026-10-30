import { readDeliveryActor } from "@/lib/delivery/actor";
import { deliveryResult, readJson, withDelivery } from "@/lib/delivery/http";
import { getDeliveryGateway } from "@/lib/delivery/runtime";

export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  return withDelivery(async () => {
    const actor = await readDeliveryActor(request, "customer");
    if (!actor.ok) return actor.response;
    const body = (await readJson(request)) as { lng?: unknown; lat?: unknown } | null;
    const { orderId } = await context.params;
    return deliveryResult(
      await getDeliveryGateway().updateCustomerLocation(actor.actor.id, orderId, {
        lng: Number(body?.lng),
        lat: Number(body?.lat),
      }),
    );
  });
}
