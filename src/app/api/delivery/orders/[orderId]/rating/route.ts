import { readDeliveryActor } from "@/lib/delivery/actor";
import { deliveryResult, readJson, withDelivery } from "@/lib/delivery/http";
import { getDeliveryGateway } from "@/lib/delivery/runtime";

export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  return withDelivery(async () => {
    const actor = await readDeliveryActor(request, "customer");
    if (!actor.ok) return actor.response;
    const body = (await readJson(request)) as { stars?: unknown; comment?: unknown } | null;
    const { orderId } = await context.params;
    return deliveryResult(
      await getDeliveryGateway().rateOrder(actor.actor.id, orderId, {
        stars: Number(body?.stars),
        comment: typeof body?.comment === "string" ? body.comment : null,
      }),
    );
  });
}
