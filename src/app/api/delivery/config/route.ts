import { deliveryConfigBody, withDelivery } from "@/lib/delivery/http";

export const dynamic = "force-dynamic";

export function GET() {
  return withDelivery(async () => Response.json(deliveryConfigBody()));
}
