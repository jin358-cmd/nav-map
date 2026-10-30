import { readDeliveryActor } from "@/lib/delivery/actor";
import { deliveryResult, withDelivery } from "@/lib/delivery/http";
import { getDeliveryGateway } from "@/lib/delivery/runtime";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return withDelivery(async () => {
    const actor = await readDeliveryActor(request, "courier");
    if (!actor.ok) return actor.response;
    return deliveryResult(await getDeliveryGateway().listCourierWork(actor.actor.id));
  });
}
