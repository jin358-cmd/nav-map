import { readDeliveryActor } from "@/lib/delivery/actor";
import { deliveryResult, readJson, withDelivery } from "@/lib/delivery/http";
import { getDeliveryGateway } from "@/lib/delivery/runtime";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return withDelivery(async () => {
    const actor = await readDeliveryActor(request, "courier");
    if (!actor.ok) return actor.response;
    const body = (await readJson(request)) as {
      online?: unknown;
      lng?: unknown;
      lat?: unknown;
      heading?: unknown;
      displayName?: unknown;
    } | null;
    const lng = body?.lng == null ? undefined : Number(body.lng);
    const lat = body?.lat == null ? undefined : Number(body.lat);
    return deliveryResult(
      await getDeliveryGateway().setCourierPresence({
        courierId: actor.actor.id,
        displayName: typeof body?.displayName === "string" ? body.displayName : undefined,
        online: body?.online !== false,
        lng,
        lat,
        heading: body?.heading == null ? null : Number(body.heading),
      }),
    );
  });
}
