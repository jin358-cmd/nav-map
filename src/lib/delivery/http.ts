import "server-only";

import { DeliverySchemaMissingError, DeliveryUnavailableError } from "@/lib/delivery/errors";
import type { GatewayFailure } from "@/lib/delivery/types";
import { isDeliveryPortalEnabled, readDispatchSettings } from "@/lib/delivery/settings";

const STATUS: Record<GatewayFailure["error"], number> = {
  not_found: 404,
  forbidden: 403,
  invalid: 400,
  conflict: 409,
  schema_missing: 503,
  unavailable: 503,
  disabled: 404,
};

export function deliveryResult(result: GatewayFailure | Record<string, unknown>) {
  if ("ok" in result && result.ok === false && "error" in result && "message" in result) {
    const failure = result as GatewayFailure;
    return Response.json(failure, { status: STATUS[failure.error] ?? 400 });
  }
  return Response.json(result);
}

export async function withDelivery(run: () => Promise<Response>) {
  if (!isDeliveryPortalEnabled()) {
    return Response.json(
      { ok: false, error: "disabled", message: "外送功能尚未開放。" },
      { status: 404 },
    );
  }
  try {
    return await run();
  } catch (error) {
    if (error instanceof DeliverySchemaMissingError || error instanceof DeliveryUnavailableError) {
      const code = error instanceof DeliverySchemaMissingError ? "schema_missing" : "unavailable";
      return Response.json({ ok: false, error: code, message: error.message }, { status: 503 });
    }
    console.error("[delivery]", error instanceof Error ? error.name : "unknown");
    return Response.json(
      { ok: false, error: "unavailable", message: "外送服務暫時無法連線。" },
      { status: 503 },
    );
  }
}

export async function readJson(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

export function deliveryConfigBody() {
  const settings = readDispatchSettings();
  return {
    ok: true as const,
    enabled: true,
    dispatchMode: settings.mode,
    offerTimeoutSeconds: Math.round(settings.offerTimeoutMs / 1000),
    grabRadiusMeters: settings.grabRadiusMeters,
    zoneRadiusMeters: settings.zoneRadiusMeters,
    pollIntervalMs: 3000,
    payment: "skipped" as const,
    provider: process.env.DELIVERY_PROVIDER === "memory" ? "memory" : "supabase",
  };
}
