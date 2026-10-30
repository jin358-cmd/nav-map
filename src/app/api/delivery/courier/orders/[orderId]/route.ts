import { readDeliveryActor } from "@/lib/delivery/actor";
import { deliveryResult, readJson, withDelivery } from "@/lib/delivery/http";
import { getDeliveryGateway } from "@/lib/delivery/runtime";

export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  return withDelivery(async () => {
    const actor = await readDeliveryActor(request, "courier");
    if (!actor.ok) return actor.response;
    const body = (await readJson(request)) as { action?: unknown } | null;
    const { orderId } = await context.params;
    const gateway = getDeliveryGateway();
    if (body?.action === "accept") return deliveryResult(await gateway.accept(actor.actor.id, orderId));
    if (body?.action === "decline") return deliveryResult(await gateway.decline(actor.actor.id, orderId));
    if (body?.action === "pickup") return deliveryResult(await gateway.pickup(actor.actor.id, orderId));
    if (body?.action === "deliver") return deliveryResult(await gateway.deliver(actor.actor.id, orderId));
    return deliveryResult({ ok: false, error: "invalid", message: "不認識這個操作。" });
  });
}
