import { readDeliveryActor } from "@/lib/delivery/actor";
import { deliveryResult, withDelivery } from "@/lib/delivery/http";
import { getDeliveryGateway } from "@/lib/delivery/runtime";

export const dynamic = "force-dynamic";

export function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  return withDelivery(async () => {
    const actor = await readDeliveryActor(request, "customer");
    if (!actor.ok) return actor.response;
    const { orderId } = await context.params;
    return deliveryResult(await getDeliveryGateway().getOrder(actor.actor.id, orderId));
  });
}
